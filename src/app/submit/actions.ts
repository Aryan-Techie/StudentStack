"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/db";
import { countPendingByUser, getCategories, isUrlListed } from "@/lib/resources";
import { slugify, validateSubmission, type SubmissionErrors } from "@/lib/submissions";
import { assertPublicUrl } from "@/lib/ssrf";
import { safeNextPath } from "@/lib/auth-redirect";
import { notifyNewSubmission } from "@/lib/admin-notify";
import { getSiteUrl } from "@/lib/site";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_PENDING_PER_STUDENT = 5;
const SUBMISSION_FIELDS = ["name", "url", "tagline", "description", "categoryId", "costType", "region", "credit"] as const;

// Supabase only redirects to URLs on the project's allow list, so building the
// callback from the request's own origin can't send anyone off-site. `next`
// lets /my-list reuse this sign-in flow (issue #33); safeNextPath keeps it
// same-site.
async function callbackUrl(next: FormDataEntryValue | null): Promise<string> {
  const h = await headers();
  const origin =
    h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const path = safeNextPath(typeof next === "string" ? next : null);
  return `${origin}/auth/callback?next=${encodeURIComponent(path)}`;
}

export type EmailSignInState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function signInWithEmail(_prev: EmailSignInState, formData: FormData): Promise<EmailSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter the email address you want the sign-in link sent to.", email };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl(formData.get("next")) },
  });

  if (error) {
    const message =
      error.status === 429
        ? "A link was sent to this address a moment ago. Wait a minute, then try again."
        : "We couldn’t send the link. Check the address and try again.";
    return { status: "error", message, email };
  }
  return { status: "sent", email };
}

export async function signInWithGoogle(formData: FormData) {
  const next = formData.get("next");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(next) },
  });
  if (error || !data.url) {
    const back = new URL(safeNextPath(typeof next === "string" ? next : null), "http://localhost").pathname;
    redirect(`${back}?error=google`);
  }
  redirect(data.url);
}

export async function signOut(formData?: FormData) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const next = formData?.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null));
}

export type SubmitState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: SubmissionErrors;
  values?: Record<string, string>;
  submittedName?: string;
};

export async function submitResource(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your sign-in expired. Reload the page and sign in again." };

  const values = Object.fromEntries(SUBMISSION_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]));
  const categories = await getCategories();
  const result = validateSubmission(
    values,
    categories.map((c) => c.id),
  );
  if (!result.ok) return { status: "error", message: "A few fields need a fix.", errors: result.errors, values };

  // SSRF: never store (and later cron-fetch) a link that doesn't resolve to a
  // public IP. Redirect chains are re-validated hop-by-hop in checkUrl too.
  try {
    await assertPublicUrl(result.value.url);
  } catch {
    return {
      status: "error",
      message: "A few fields need a fix.",
      errors: { url: "That link doesn't resolve to a public website. Paste the offer's public page URL." },
      values,
    };
  }

  if ((await countPendingByUser(user.id)) >= MAX_PENDING_PER_STUDENT) {
    return {
      status: "error",
      message: `You already have ${MAX_PENDING_PER_STUDENT} offers waiting for review. You can add more once those are checked.`,
      values,
    };
  }

  // ponytail: check-then-insert, so two simultaneous sends of the same link can
  // both land. Admin review catches that; add a unique index on the normalized
  // URL if duplicates show up in the queue.
  if (await isUrlListed(result.value.url)) {
    return {
      status: "error",
      message: "A few fields need a fix.",
      errors: { url: "That link is already in the directory or waiting for review." },
      values,
    };
  }

  const offer = result.value;
  await db.insert(schema.resources).values({
    slug: `${slugify(offer.name)}-${crypto.randomUUID().slice(0, 6)}`,
    name: offer.name,
    tagline: offer.tagline,
    description: offer.description,
    url: offer.url,
    hasStaticClaimUrl: true,
    categoryId: offer.categoryId,
    region: offer.region,
    costType: offer.costType,
    status: "active",
    approved: false,
    submittedBy: user.id,
    contributorCredit: offer.credit,
  });

  // Tell the admin a submission is waiting (opt-in webhook). Runs after the
  // response so a slow or failing webhook never delays the student.
  const categoryName = categories.find((c) => c.id === offer.categoryId)?.name;
  after(async () => {
    const result = await notifyNewSubmission(
      { name: offer.name, url: offer.url, categoryName },
      `${getSiteUrl()}/admin`,
    );
    if (!result.sent) console.log(`[submit] admin notification skipped: ${result.reason}`);
  });

  revalidatePath("/admin");
  revalidatePath("/submit");
  return { status: "success", submittedName: offer.name };
}
