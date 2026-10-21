import { buildIcsFeed } from "@/lib/deadline-feeds";
import { getBookmarkedDeadlines } from "@/lib/resources";
import { getUserIdByCalendarToken } from "@/lib/profiles";

// Per-user iCalendar feed of bookmarked deadlines (issue #84). Calendar
// apps can't sign in, so the unguessable token in the URL is the
// credential; /my-list can reset it. Private caching only: the feed is
// one student's list.
export const dynamic = "force-dynamic";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_PATTERN.test(token)) return new Response("Not found", { status: 404 });

  const userId = await getUserIdByCalendarToken(token).catch(() => null);
  if (!userId) return new Response("Not found", { status: 404 });

  const resources = await getBookmarkedDeadlines(userId);
  return new Response(buildIcsFeed(resources, { calendarName: "My StudentStack deadlines" }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
