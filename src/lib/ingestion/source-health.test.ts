import { describe, it, expect } from "vitest";
import { sourceHealth, STALE_AFTER_MS } from "./source-health";

const now = Date.UTC(2026, 9, 20);
const state = (name: string, over: Partial<Parameters<typeof sourceHealth>[1][number]> = {}) => ({
  name,
  lastRunAt: new Date(now - 1000),
  lastStatus: "ok" as const,
  lastError: null,
  lastFetched: 10,
  lastQueued: 2,
  lastSuccessAt: new Date(now - 1000),
  ...over,
});

describe("sourceHealth", () => {
  it("classifies healthy, failing, stale, and never-run sources", () => {
    const result = sourceHealth(
      ["a", "b", "c", "d"],
      [
        state("a"),
        state("b", { lastStatus: "error", lastError: "HTTP 500" }),
        state("c", { lastSuccessAt: new Date(now - STALE_AFTER_MS - 1) }),
      ],
      now,
    );
    expect(result.map((r) => [r.name, r.health])).toEqual([
      ["a", "healthy"],
      ["b", "failing"],
      ["c", "stale"],
      ["d", "never_run"],
    ]);
  });

  it("lists state rows for sources that were removed", () => {
    expect(sourceHealth(["a"], [state("old")], now).map((r) => r.name)).toEqual(["a", "old"]);
  });
});
