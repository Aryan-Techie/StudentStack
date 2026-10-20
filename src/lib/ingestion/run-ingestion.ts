import type { Resource } from "@/lib/resources";
import type { CandidateFields, IngestionSource } from "./types";
import { classifyMatch } from "./classify-match";
import { urlMatchKey } from "@/lib/submissions";

export type CandidateRow = CandidateFields & {
  sourceName: string;
  matchType: "new" | "possible_duplicate";
  matchedResourceId: number | null;
  rawPayload: string;
};

export type SourceRunSummary = {
  sourceName: string;
  fetched: number;
  queued: number;
  duplicates: number;
  mappingErrors: number;
  // Candidates dropped because their deadline already passed (issue #83).
  expired: number;
  // Upstream fingerprint seen this run, and whether it matched last run's
  // so the source was skipped (issue #83).
  version?: string | null;
  unchanged?: boolean;
  error?: string;
};

export type RunOptions = {
  nowMs?: number;
  previousVersions?: Map<string, string | null>;
  // urlMatchKey()s of candidates already waiting for review, from any
  // source, so two sources listing the same offer queue it once (#40).
  pendingUrlKeys?: Set<string>;
};

export type IngestionRunResult = {
  toInsert: CandidateRow[];
  summary: SourceRunSummary[];
};

// No DB access in here — only `source.fetchCandidates()` is async/external.
// Keeping this pure (aside from that) makes it unit-testable with a fake
// source and fixture arrays, no network or database needed.
export async function runIngestion(
  sources: IngestionSource[],
  existingResources: Resource[],
  alreadySeenKeys: Set<string>, // `${sourceName}:${externalId}`
  { nowMs = Date.now(), previousVersions = new Map(), pendingUrlKeys = new Set() }: RunOptions = {},
): Promise<IngestionRunResult> {
  const toInsert: CandidateRow[] = [];
  const summary: SourceRunSummary[] = [];
  const queuedUrlKeys = new Set(pendingUrlKeys);
  const bySlug = new Map(existingResources.map((r) => [r.slug, r]));

  for (const source of sources) {
    const result: SourceRunSummary = {
      sourceName: source.name,
      fetched: 0,
      queued: 0,
      duplicates: 0,
      mappingErrors: 0,
      expired: 0,
    };

    try {
      if (source.version) {
        result.version = await source.version();
        const previous = previousVersions.get(source.name);
        if (result.version && previous === result.version) {
          result.unchanged = true;
          summary.push(result);
          continue;
        }
        if (source.baselineFirstRun && result.version && !previousVersions.has(source.name)) {
          summary.push(result);
          continue;
        }
      }

      const raw = await source.fetchCandidates();
      result.fetched = raw.length;

      for (const item of raw) {
        const candidate = source.mapToCandidate(item);
        if (!candidate || !candidate.name || !candidate.description) {
          result.mappingErrors++;
          continue;
        }
        if (candidate.externalId && alreadySeenKeys.has(`${source.name}:${candidate.externalId}`)) {
          continue;
        }
        // Issue #83: never queue an opportunity that has already closed.
        if (candidate.deadline && candidate.deadline.getTime() < nowMs) {
          result.expired++;
          continue;
        }

        const urlKey = candidate.url ? urlMatchKey(candidate.url) : null;
        const target = candidate.updateOf ? bySlug.get(candidate.updateOf) : undefined;
        if (!target && urlKey && queuedUrlKeys.has(urlKey)) {
          result.duplicates++;
          continue;
        }

        const match = target
          ? ({ kind: "possible_duplicate", matchedResourceId: target.id } as const)
          : classifyMatch(candidate, existingResources);
        if (match.kind === "duplicate") {
          result.duplicates++;
          continue;
        }
        if (urlKey) queuedUrlKeys.add(urlKey);

        toInsert.push({
          ...candidate,
          sourceName: source.name,
          matchType: match.kind === "possible_duplicate" ? "possible_duplicate" : "new",
          matchedResourceId: match.kind === "possible_duplicate" ? match.matchedResourceId : null,
          rawPayload: JSON.stringify(item),
        });
        result.queued++;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    summary.push(result);
  }

  return { toInsert, summary };
}
