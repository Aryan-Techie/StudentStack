import { NextResponse } from "next/server";
import { getProfile, profileToEligibility } from "@/lib/profiles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/profile — the signed-in student's personalization signals
// (issue #34) and synced eligibility profile (issue #84), fetched
// client-side by the directory.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ signedIn: false, profile: null, eligibility: null }, { headers });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false, profile: null, eligibility: null }, { headers });

  try {
    const profile = await getProfile(user.id);
    return NextResponse.json(
      {
        signedIn: true,
        profile: profile ? { branch: profile.branch, year: profile.year } : null,
        eligibility: profileToEligibility(profile),
      },
      { headers },
    );
  } catch (error) {
    console.warn("[profile] load failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ signedIn: true, profile: null, eligibility: null }, { headers });
  }
}
