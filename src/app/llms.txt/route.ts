import { getCategories } from "@/lib/resources";
import { COMPARISON_SETS } from "@/lib/comparisons";
import { PRESETS } from "@/lib/presets";
import { getSiteUrl } from "@/lib/site";
import { buildLlmsTxt } from "@/lib/llms-txt";

// /llms.txt for AI agents (issue #82). Categories come from the DB, so
// render per request and let the CDN cache it.
export const dynamic = "force-dynamic";

export async function GET() {
  const body = buildLlmsTxt({
    origin: getSiteUrl(),
    categories: await getCategories(),
    presets: PRESETS,
    comparisons: COMPARISON_SETS,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
