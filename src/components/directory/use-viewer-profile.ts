"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { syncEligibility } from "@/app/onboarding/actions";
import { parseEligibilityProfile, type EligibilityProfile } from "@/lib/eligibility";
import type { ProfileSignals } from "@/lib/personalization";

const ELIGIBILITY_KEY = "studentstack:eligibility:v1";
const ELIGIBLE_ONLY_KEY = "studentstack:eligible-only:v1";

function readLocal<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private browsing, quota): works for this visit only
  }
}

// One /api/profile load for the directory: branch + year for the "For you"
// sort (issue #34) and the eligibility profile (issue #84). Eligibility is
// localStorage-first so it works without an account; when the student is
// signed in, the local copy is pushed to `profiles`, or pulled from it on a
// new device.
export function useViewerProfile() {
  const [signals, setSignals] = useState<ProfileSignals | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityProfile | null>(null);
  const [eligibleOnly, setEligibleOnlyState] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    const local = readLocal(ELIGIBILITY_KEY, parseEligibilityProfile);
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is only readable after hydration */
    if (local) setEligibility(local);
    if (readLocal(ELIGIBLE_ONLY_KEY, (v) => (v === true ? true : null)) && local) setEligibleOnlyState(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { signedIn: boolean; profile: ProfileSignals | null; eligibility: unknown } | null) => {
        if (cancelled || !data) return;
        signedIn.current = data.signedIn;
        if (data.profile) setSignals(data.profile);
        if (!data.signedIn) return;
        if (local) {
          void syncEligibility(local).catch(() => {});
        } else {
          const remote = parseEligibilityProfile(data.eligibility);
          if (remote) {
            setEligibility(remote);
            writeLocal(ELIGIBILITY_KEY, remote);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const saveEligibility = useCallback((next: EligibilityProfile | null) => {
    setEligibility(next);
    writeLocal(ELIGIBILITY_KEY, next);
    if (!next) {
      setEligibleOnlyState(false);
      writeLocal(ELIGIBLE_ONLY_KEY, null);
    } else if (signedIn.current) {
      void syncEligibility(next).catch(() => {});
    }
  }, []);

  const setEligibleOnly = useCallback((on: boolean) => {
    setEligibleOnlyState(on);
    writeLocal(ELIGIBLE_ONLY_KEY, on ? true : null);
  }, []);

  // Signed-out students still get "For you" from the field/year they
  // entered in the eligibility sheet.
  const effectiveSignals: ProfileSignals | null =
    signals ?? (eligibility && (eligibility.field || eligibility.year)
      ? { branch: eligibility.field ?? null, year: eligibility.year ?? null }
      : null);

  return { signals: effectiveSignals, eligibility, saveEligibility, eligibleOnly, setEligibleOnly };
}
