"use client";

import { useEffect, useState } from "react";
import type { ProfileSignals } from "@/lib/personalization";

// Loads the signed-in student's branch + year (issue #34) for the "For
// you" sort. null while loading, when signed out, or with no profile.
export function useProfileSignals(): ProfileSignals | null {
  const [profile, setProfile] = useState<ProfileSignals | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: ProfileSignals | null } | null) => {
        if (!cancelled && data?.profile) setProfile(data.profile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return profile;
}
