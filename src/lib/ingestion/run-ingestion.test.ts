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
});
