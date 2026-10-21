import { describe, it, expect, vi } from "vitest";
import { runIngestion } from "./run-ingestion";
import type { IngestionSource } from "./types";

const now = Date.UTC(2026, 9, 20);

function source(items: { name: string; description?: string; deadline?: Date }[], extra: Partial<IngestionSource> = {}): IngestionSource {
  return {
    name: "fake",
    fetchCandidates: async () => items,
    mapToCandidate: (raw) => {
      const r = raw as { name: string; description?: string; deadline?: Date };
      return r.name ? { name: r.name, description: r.description ?? "d", deadline: r.deadline } : null;
    },
    ...extra,
  };
}

describe("runIngestion", () => {
  it("queues new candidates and counts mapping errors and source failures", async () => {
    const broken: IngestionSource = { name: "broken", fetchCandidates: async () => { throw new Error("network error"); }, mapToCandidate: () => null };
    const result = await runIngestion([source([{ name: "Real Tool" }, { name: "" }]), broken], [], new Set(), { nowMs: now });
    expect(result.toInsert).toHaveLength(1);
    expect(result.summary[0]).toMatchObject({ fetched: 2, queued: 1, mappingErrors: 1 });
    expect(result.summary[1].error).toBe("network error");
  });

  it("drops candidates whose deadline already passed", async () => {
    const result = await runIngestion(
      [source([{ name: "Past", deadline: new Date(now - 1000) }, { name: "Future", deadline: new Date(now + 1000) }, { name: "Open" }])],
      [],
      new Set(),
      { nowMs: now },
    );
    expect(result.toInsert.map((c) => c.name)).toEqual(["Future", "Open"]);
    expect(result.summary[0].expired).toBe(1);
  });

  it("skips a source whose upstream fingerprint has not changed", async () => {
    const fetchCandidates = vi.fn(async () => [{ name: "X" }]);
    const s = source([], { version: async () => "sha-1", fetchCandidates });
    const unchanged = await runIngestion([s], [], new Set(), { nowMs: now, previousVersions: new Map([["fake", "sha-1"]]) });
    expect(fetchCandidates).not.toHaveBeenCalled();
    expect(unchanged.summary[0]).toMatchObject({ unchanged: true, version: "sha-1" });

    const changed = await runIngestion([s], [], new Set(), { nowMs: now, previousVersions: new Map([["fake", "sha-0"]]) });
    expect(fetchCandidates).toHaveBeenCalledOnce();
    expect(changed.summary[0]).toMatchObject({ queued: 1, version: "sha-1" });
  });

  it("queues an offer listed by two sources once, and skips offers already pending", async () => {
    const a = { ...source([]), name: "a", fetchCandidates: async () => [{ name: "Same Offer", url: "https://offer.test/x" }] };
    const b = { ...source([]), name: "b", fetchCandidates: async () => [{ name: "Same offer!", url: "http://www.offer.test/x/" }] };
    const map = (raw: unknown) => {
      const r = raw as { name: string; url: string };
      return { name: r.name, description: "d", url: r.url };
    };
    const result = await runIngestion([{ ...a, mapToCandidate: map }, { ...b, mapToCandidate: map }], [], new Set(), { nowMs: now });
    expect(result.toInsert).toHaveLength(1);
    expect(result.summary[1].duplicates).toBe(1);

    const pending = await runIngestion([{ ...a, mapToCandidate: map }], [], new Set(), {
      nowMs: now,
      pendingUrlKeys: new Set(["offer.test/x"]),
    });
    expect(pending.toInsert).toHaveLength(0);
  });

  it("queues updateOf candidates next to the named resource, bypassing URL duplicate checks", async () => {
    const existing = [{ id: 7, slug: "figma", name: "Figma", url: "https://figma.com/education" }] as never[];
    const watch: IngestionSource = {
      name: "watch:figma",
      fetchCandidates: async () => [{}],
      mapToCandidate: () => ({ name: "Figma", description: "changed", url: "https://figma.com/education", updateOf: "figma" }),
    };
    const result = await runIngestion([watch], existing, new Set(), { nowMs: now });
    expect(result.toInsert[0]).toMatchObject({ matchType: "possible_duplicate", matchedResourceId: 7 });
  });

  it("only records a baseline on a watched source's first run", async () => {
    const fetchCandidates = vi.fn(async () => [{ name: "X" }]);
    const s = source([], { version: async () => "v1", fetchCandidates, baselineFirstRun: true });
    const first = await runIngestion([s], [], new Set(), { nowMs: now });
    expect(fetchCandidates).not.toHaveBeenCalled();
    expect(first.summary[0]).toMatchObject({ version: "v1", queued: 0 });

    const second = await runIngestion([s], [], new Set(), { nowMs: now, previousVersions: new Map([["fake", "v0"]]) });
    expect(second.summary[0].queued).toBe(1);
  });
});
