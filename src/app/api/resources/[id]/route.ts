import { getResourceBySlug } from "@/lib/resources";
import {
  PUBLIC_API_CACHE_CONTROL,
  clientKey,
  publicApiLimiter,
  rateLimitHeaders,
} from "@/lib/rate-limit";

// GET /api/resources/{slug} — one approved resource (issue #82), same
// resolver as /r/[slug]; unknown or unapproved slugs return 404. The
// segment is named [id] only because Next.js requires one dynamic segment
// name per level and the sibling /api/resources/[id]/click already uses it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = publicApiLimiter(clientKey(request));
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: rateHeaders });
  }

  const { id: slug } = await params;
  const resource = /^[a-z0-9-]{1,120}$/.test(slug) ? await getResourceBySlug(slug) : null;
  if (!resource) {
    return Response.json({ error: "Resource not found" }, { status: 404, headers: rateHeaders });
  }
  return Response.json(resource, {
    headers: { ...rateHeaders, "Cache-Control": PUBLIC_API_CACHE_CONTROL },
  });
}
