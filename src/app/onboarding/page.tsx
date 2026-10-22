import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/components/home/brand.module.css";
import { SiteFooter, SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import { safeNextPath } from "@/lib/auth-redirect";
import { BRANCHES, YEARS } from "@/lib/personalization";
import { getProfile } from "@/lib/profiles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { completeOnboarding } from "./actions";

export const metadata: Metadata = {
  title: "Personalize | StudentStack",
  robots: { index: false },
};

// Optional, skippable branch + year step (PRD §8.8, issue #34). Shown once
// after first sign-in, and reachable later to change the answers.
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: nextRaw } = await searchParams;
  const next = safeNextPath(nextRaw, "/directory");
  // No Supabase means no signed-in student; /my-list explains why (#127).
  if (!isSupabaseConfigured()) redirect("/my-list");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/my-list");

  const profile = await getProfile(user.id);

  return (
    <div className={`${passFontVariables} ${styles.root}`}>
      <SiteHeader />
      <main className={`${styles.wrap} ${styles.formPage}`}>
        <div>
          <h1 className={styles.pageTitle}>Show me what fits</h1>
          <p className={styles.lede}>
            Tell us your branch and year and the directory’s “For you” sort puts the most relevant offers first. Nothing
            is hidden, and you can skip this.
          </p>
        </div>
        <div className={styles.formPanel}>
          <form action={completeOnboarding} className={styles.fieldStack}>
            <input type="hidden" name="next" value={next} />
            <div className={styles.field}>
              <label htmlFor="onboarding-branch" className={styles.label}>
                Branch
              </label>
              <select id="onboarding-branch" name="branch" defaultValue={profile?.branch ?? ""} className={styles.input}>
                <option value="">Prefer not to say</option>
                {BRANCHES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="onboarding-year" className={styles.label}>
                Year of study
              </label>
              <select id="onboarding-year" name="year" defaultValue={profile?.year ?? ""} className={styles.input}>
                <option value="">Prefer not to say</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y === 5 ? "5th year or later" : `Year ${y}`}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={styles.cta}>
              Save
            </button>
            <button type="submit" name="skip" value="1" className={styles.linkButton}>
              Skip for now
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
