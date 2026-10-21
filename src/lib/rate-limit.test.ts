import { describe, it, expect } from "vitest";
import { clientKey, createRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then blocks", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("a", 0).ok).toBe(true);
    expect(check("a", 10).ok).toBe(true);
    const third = check("a", 20);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    expect(check("b", 20).ok).toBe(true);
  });

  it("resets after the window", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    check("a", 0);
    expect(check("a", 500).ok).toBe(false);
    expect(check("a", 1000).ok).toBe(true);
  });

  it("caps memory by evicting old keys", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
    check("a", 0);
    check("b", 0);
    check("c", 0); // evicts "a"
    expect(check("a", 1).ok).toBe(true);
  });
});

describe("rateLimitHeaders", () => {
  it("adds Retry-After only when blocked", () => {
    expect(rateLimitHeaders({ ok: true, limit: 60, remaining: 59, resetMs: 60_000 }, 0)).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "59",
    });
    expect(rateLimitHeaders({ ok: false, limit: 60, remaining: 0, resetMs: 30_500 }, 0)["Retry-After"]).toBe("31");
  });
});

describe("clientKey", () => {
  it("uses the first x-forwarded-for address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(clientKey(req)).toBe("1.2.3.4");
    expect(clientKey(new Request("http://x"))).toBe("anonymous");
  });
});
