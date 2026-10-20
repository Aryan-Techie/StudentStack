import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/home/brand.module.css";
import { SiteFooter, SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import { getSavedResources } from "@/lib/bookmarks";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "../submit/actions";
import { SignInPanel } from "../submit/sign-in-panel";
import { MyListClient } from "./my-list-client";
import { PendingSave } from "./pending-save";

export const metadata: Metadata = {
  title: "My list | StudentStack",
  description: "Offers and opportunities you saved, with where you are on each one.",
  robots: { index: false },
};

const SIGN_IN_ERRORS: Record<string, string> = {
  link: "That sign-in link didn’t work. Links expire after an hour and only open in the browser that asked for them. Request a new one below.",
  google: "Google sign-in didn’t start. Try again, or get a link by email instead.",
};

// Auth is checked here, not only in proxy.ts: the proxy refreshes the
// session but is not the security boundary.
export default async function MyListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; save?: string }>;
}) {
  const { error, save } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pendingSave = Number(save);
  const nextPath = Number.isInteger(pendingSave) && pendingSave > 0 ? `/my-list?save=${pendingSave}` : "/my-list";

  if (!user) {
    const signInError = error ? SIGN_IN_ERRORS[error] : undefined;
    return (
      <div className={`${passFontVariables} ${styles.root}`}>
        <SiteHeader />
        <main className={`${styles.wrap} ${styles.formPage}`}>
          <div>
            <h1 className={styles.pageTitle}>My list</h1>
            <p className={styles.lede}>
              Save offers and opportunities as you browse, then track each one: interested, applied, got it, or
              rejected.
            </p>
          </div>
          <div className={styles.formPanel}>
            {signInError && (
              <p role="alert" className={styles.formError}>
                {signInError}
              </p>
            )}
            <SignInPanel
              next={nextPath}
              title="Sign in to save offers"
              hint="Your list is private. Your name and email aren’t shown anywhere on the site."
            />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const saved = await getSavedResources(user.id);

  return (
    <div className={`${passFontVariables} ${styles.root}`}>
      <SiteHeader />
      <main className={styles.wrap}>
        <div className={styles.signedIn}>
          <span>
            Signed in as <strong>{user.email}</strong>
          </span>
          <form action={signOut}>
            <input type="hidden" name="next" value="/my-list" />
            <button type="submit" className={styles.linkButton}>
              Sign out
            </button>
          </form>
        </div>
        <h1 className={styles.pageTitle}>My list</h1>
        <p className={styles.hint}>
          <Link href="/onboarding?next=/my-list" className="underline">
            Set your branch and year
          </Link>{" "}
          to get a “For you” sort in the directory.
        </p>
        {nextPath !== "/my-list" && <PendingSave resourceId={pendingSave} />}
        <MyListClient
          items={saved.map((item) => ({
            ...item,
            deadline: item.deadline ? item.deadline.getTime() : null,
            savedAt: item.savedAt.getTime(),
          }))}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
