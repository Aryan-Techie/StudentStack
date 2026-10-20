import { NextResponse, type NextRequest } from "next/server";
import { getUserReview, hasBookmarked } from "@/lib/reviews";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/reviews?resourceId= — the signed-in student's own review and
// whether they may write one (issue #37). Public review lists render on
// /r/[slug]; this only drives the per-user form.
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const signedOut = { signedIn: false, canReview: false, review: null };
  const resourceId = Number(request.nextUrl.searchParams.get("resourceId"));
  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    return NextResponse.json({ error: "resourceId is required" }, { status: 400, headers });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json(signedOut, { headers });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(signedOut, { headers });

  try {
    const [canReview, review] = await Promise.all([
      hasBookmarked(user.id, resourceId),
      getUserReview(user.id, resourceId),
    ]);
    return NextResponse.json({ signedIn: true, canReview: canReview || Boolean(review), review }, { headers });
  } catch (error) {
    console.warn("[reviews] mine failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ signedIn: true, canReview: false, review: null }, { headers });
  }
}
