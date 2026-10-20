// Best-effort fixed-window rate limiter for the public API (issue #82).
// State lives in the function instance's memory, so limits are per
// instance rather than global. That is enough to blunt a single noisy
// client; the CDN cache (s-maxage) absorbs most repeat traffic anyway.

export type RateLimitResult = { ok: boolean; limit: number; remaining: number; resetMs: number };

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const windows = new Map<string, { start: number; count: number }>();

  return function check(key: string, now: number = Date.now()): RateLimitResult {
    let w = windows.get(key);
    if (!w || now - w.start >= windowMs) {
      if (!w && windows.size >= maxKeys) {
        // Drop expired windows; if still full, drop the oldest entry.
        for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
      }
      w = { start: now, count: 0 };
      windows.set(key, w);
    }
    w.count += 1;
    return {
      ok: w.count <= limit,
      limit,
      remaining: Math.max(0, limit - w.count),
      resetMs: w.start + windowMs,
    };
  };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";
}

export const PUBLIC_API_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

// Shared limiter for every public read endpoint: 60 requests per minute.
export const publicApiLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export function rateLimitHeaders(result: RateLimitResult, now: number = Date.now()): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
  if (!result.ok) headers["Retry-After"] = String(Math.max(1, Math.ceil((result.resetMs - now) / 1000)));
  return headers;
}
