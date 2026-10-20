import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getResourcesPaginated,
} from "@/lib/resources";
import { parseApiFilters } from "@/lib/api-filters";
import {
  PUBLIC_API_CACHE_CONTROL,
  clientKey,
  publicApiLimiter,
  rateLimitHeaders,
} from "@/lib/rate-limit";

function parsePageParam(raw: string | null): number | null {
  if (raw === null) return 1;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

function parseLimitParam(raw: string | null): number | null {
  if (raw === null) return DEFAULT_PAGE_SIZE;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, MAX_PAGE_SIZE);
}

/**
 * GET /api/resources?page=&limit=&kind=&category=&region=&deadline_before=
 *
 * Public read API over approved resources: offset pagination (#28) plus
 * filters (#82). Documented on /api-docs and in /llms.txt.
 *
 * Query params:
 *   page            — 1-based page number, default 1. Positive integer.
 *   limit           — items per page, default 30, capped at 100.
 *   kind            — comma-separated: perk, scholarship, fellowship,
 *                     internship, mentorship, program.
 *   category        — category slug, e.g. cloud-and-hosting.
 *   region          — IN (works in India) or Global (not region-locked).
 *   deadline_before — ISO date; active resources still open now and
 *                     closing on or before it.
 *
 * Responds with `{ resources, total, page, limit, totalPages }`. Cached at
 * the CDN for 60s and rate limited to 60 requests/minute per client.
 */
export async function GET(request: Request) {
  const rate = publicApiLimiter(clientKey(request));
  const rateHeaders = rateLimitHeaders(rate);
  if (!rate.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: rateHeaders });
  }

  const { searchParams } = new URL(request.url);

  const page = parsePageParam(searchParams.get("page"));
  if (page === null) {
    return Response.json(
      { error: "Invalid 'page' query parameter: expected a positive integer" },
      { status: 400, headers: rateHeaders },
    );
  }

  const limit = parseLimitParam(searchParams.get("limit"));
  if (limit === null) {
    return Response.json(
      { error: "Invalid 'limit' query parameter: expected a positive integer" },
      { status: 400, headers: rateHeaders },
    );
  }

  const parsed = parseApiFilters(searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400, headers: rateHeaders });
  }

  return Response.json(await getResourcesPaginated(page, limit, parsed.filters), {
    headers: { ...rateHeaders, "Cache-Control": PUBLIC_API_CACHE_CONTROL },
  });
}
