import { NextResponse } from "next/server";
import { getBookmarkStatuses } from "@/lib/bookmarks";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/bookmarks — the signed-in student's saved statuses, keyed by
// resource id. Cards fetch this client-side (issue #33) so /directory stays
// free of per-user rendering. A Route Handler can also write refreshed
// session cookies, which a Server Component render can't.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  // Local dev without Supabase configured: behave as signed out.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ signedIn: false, bookmarks: {} }, { headers });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ signedIn: false, bookmarks: {} }, { headers });

  try {
    const bookmarks = await getBookmarkStatuses(user.id);
    return NextResponse.json({ signedIn: true, bookmarks }, { headers });
  } catch (error) {
    console.warn("[bookmarks] load failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ signedIn: true, bookmarks: {} }, { headers });
  }
}
