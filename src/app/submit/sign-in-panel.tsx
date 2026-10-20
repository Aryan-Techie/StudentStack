"use client";

import { useActionState } from "react";
import styles from "@/components/home/brand.module.css";
import { signInWithEmail, signInWithGoogle, type EmailSignInState } from "./actions";

const initialState: EmailSignInState = { status: "idle" };

export function SignInPanel({
  next = "/submit",
  title = "Sign in to add a perk",
  hint = "Your account only links a submission to you so we can follow up. Your name and email aren’t shown anywhere on the site.",
}: {
  next?: string;
  title?: string;
  hint?: string;
} = {}) {
  const [state, emailAction, pending] = useActionState(signInWithEmail, initialState);

  if (state.status === "sent") {
    return (
      <div className={styles.notice} role="status">
        <h2 className={styles.panelTitle}>Check your inbox</h2>
        <p>
          We sent a sign-in link to <strong>{state.email}</strong>. Open it in this browser to continue.
        </p>
        <p className={styles.hint}>Nothing after a couple of minutes? Check your spam folder, then reload this page to try again.</p>
      </div>
    );
  }

  const hasError = state.status === "error";

  return (
    <div className={styles.panelStack}>
      <div className={styles.notice}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <p className={styles.hint}>{hint}</p>
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={styles.googleButton}>
          Continue with Google
        </button>
      </form>

      <p className={styles.divider}>or get a link by email</p>

      <form action={emailAction} className={styles.fieldStack} noValidate>
        <input type="hidden" name="next" value={next} />
        <div className={styles.field}>
          <label htmlFor="signin-email" className={styles.label}>
            Email
          </label>
          <input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "signin-email-error" : undefined}
            className={styles.input}
          />
          {hasError && (
            <p id="signin-email-error" className={styles.fieldError}>
              {state.message}
            </p>
          )}
        </div>
        <button type="submit" className={styles.cta} disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
