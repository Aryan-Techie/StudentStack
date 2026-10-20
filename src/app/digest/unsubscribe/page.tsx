import type { Metadata } from "next";
import { redirect } from "next/navigation";
import styles from "@/components/home/brand.module.css";
import { SiteFooter, SiteHeader } from "@/components/home/site-chrome";
import { passFontVariables } from "@/lib/fonts";
import { verifyUnsubscribe } from "@/lib/digest";
import { setEmailDigest } from "@/lib/profiles";

export const metadata: Metadata = { title: "Unsubscribe | StudentStack", robots: { index: false } };

async function unsubscribe(formData: FormData) {
  "use server";
  const userId = String(formData.get("u") ?? "");
  const token = String(formData.get("t") ?? "");
  if (!verifyUnsubscribe(userId, token)) redirect("/digest/unsubscribe?status=invalid");
  await setEmailDigest(userId, false);
  redirect("/digest/unsubscribe?status=done");
}

// Confirmation step for the digest's unsubscribe link (issue #38). A button
// instead of unsubscribing on GET, so email link scanners can't trigger it.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; status?: string }>;
}) {
  const { u, t, status } = await searchParams;
  const valid = Boolean(u && t && verifyUnsubscribe(u, t));

  let body: React.ReactNode;
  if (status === "done") {
    body = <p>You’re unsubscribed from the weekly digest. You can turn it back on from My list.</p>;
  } else if (status === "invalid" || !valid) {
    body = <p>This unsubscribe link isn’t valid. Sign in and use My list to change your email settings.</p>;
  } else {
    body = (
      <form action={unsubscribe} className={styles.fieldStack}>
        <input type="hidden" name="u" value={u} />
        <input type="hidden" name="t" value={t} />
        <p>Stop getting the StudentStack weekly digest?</p>
        <button type="submit" className={styles.cta}>
          Unsubscribe
        </button>
      </form>
    );
  }

  return (
    <div className={`${passFontVariables} ${styles.root}`}>
      <SiteHeader />
      <main className={`${styles.wrap} ${styles.formPage}`}>
        <h1 className={styles.pageTitle}>Weekly digest</h1>
        <div className={styles.formPanel}>{body}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
