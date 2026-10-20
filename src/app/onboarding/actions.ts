"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth-redirect";
import { isBranch, YEARS } from "@/lib/personalization";
import { saveProfile } from "@/lib/profiles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Saves (or skips) the optional branch + year step. Skipping still marks
// onboarding complete so the student isn't asked again after every sign-in.
export async function completeOnboarding(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nextRaw = formData.get("next");
  const next = safeNextPath(typeof nextRaw === "string" ? nextRaw : null, "/directory");
  if (!user) redirect(`/my-list`);

  const skip = formData.get("skip") === "1";
  const branchRaw = formData.get("branch");
  const yearRaw = Number(formData.get("year"));
  const branch = !skip && isBranch(branchRaw) ? branchRaw : null;
  const year = !skip && (YEARS as readonly number[]).includes(yearRaw) ? yearRaw : null;

  await saveProfile(user.id, { branch, year });
  redirect(next);
}
