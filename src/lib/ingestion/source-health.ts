// Source health for /admin/ingestion (issue #40). Pure so it's testable.

export type SourceStateLike = {
  name: string;
  lastRunAt: Date | null;
  lastStatus: "ok" | "unchanged" | "error" | null;
  lastError: string | null;
  lastFetched: number;
  lastQueued: number;
  lastSuccessAt: Date | null;
};

export type SourceHealth = SourceStateLike & {
  health: "healthy" | "failing" | "stale" | "never_run";
};

// No successful run for this long means the source is stale, even if the
// last attempt didn't error (e.g. the cron stopped running).
export const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export function sourceHealth(names: string[], states: SourceStateLike[], nowMs: number = Date.now()): SourceHealth[] {
  const byName = new Map(states.map((s) => [s.name, s]));
  // Registered sources first, then any state rows for removed sources.
  const all = [...names, ...states.map((s) => s.name).filter((n) => !names.includes(n))];
  return all.map((name) => {
    const s: SourceStateLike = byName.get(name) ?? {
      name,
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
      lastFetched: 0,
      lastQueued: 0,
      lastSuccessAt: null,
    };
    let health: SourceHealth["health"];
    if (!s.lastRunAt) health = "never_run";
    else if (s.lastStatus === "error") health = "failing";
    else if (!s.lastSuccessAt || nowMs - s.lastSuccessAt.getTime() > STALE_AFTER_MS) health = "stale";
    else health = "healthy";
    return { ...s, health };
  });
}
