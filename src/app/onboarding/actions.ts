"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth-redirect";
import { isBranch, YEARS } from "@/lib/personalization";
import { saveEligibility, saveProfile } from "@/lib/profiles";
import { parseEligibilityProfile } from "@/lib/eligibility";
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

// Syncs the localStorage eligibility profile for a signed-in student (issue
// #84). Signed-out callers get { ok: false } and keep their local copy.
export async function syncEligibility(raw: unknown): Promise<{ ok: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = parseEligibilityProfile(raw);
  if (!user || !profile) return { ok: false };
  try {
    await saveEligibility(user.id, profile);
    return { ok: true };
  } catch (error) {
    console.warn("[profile] eligibility sync failed:", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}
