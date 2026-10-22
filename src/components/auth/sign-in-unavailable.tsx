import Link from "next/link";
import styles from "@/components/home/brand.module.css";

// Shown in place of the sign-in panel when Supabase Auth isn't configured,
// e.g. a fresh checkout without .env.local (issue #127).
export function SignInUnavailable() {
  return (
    <div className={styles.notice} role="status">
      <h2 className={styles.panelTitle}>Sign-in isn’t set up here</h2>
      <p className={styles.hint}>
        This copy of StudentStack has no Supabase project configured, so accounts are off. Browsing the{" "}
        <Link href="/directory" className="underline">
          directory
        </Link>{" "}
        and{" "}
        <Link href="/deadlines" className="underline">
          deadlines
        </Link>{" "}
        still works. To enable sign-in, set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> as described in CONTRIBUTING.md.
      </p>
    </div>
  );
}
