import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CandidateRow, SourceRunSummary } from "./run-ingestion";

export async function getExistingCandidateKeys(): Promise<Set<string>> {
  const rows = await db
    .select({
      sourceName: schema.ingestionCandidates.sourceName,
      externalId: schema.ingestionCandidates.externalId,
    })
    .from(schema.ingestionCandidates);
  return new Set(
    rows.filter((r): r is { sourceName: string; externalId: string } => Boolean(r.externalId)).map(
      (r) => `${r.sourceName}:${r.externalId}`,
    ),
  );
}

export async function insertCandidates(rows: CandidateRow[]): Promise<void> {
  if (!rows.length) return;
  await db.insert(schema.ingestionCandidates).values(
    rows.map((r) => ({
      sourceName: r.sourceName,
      externalId: r.externalId ?? null,
      name: r.name,
      tagline: r.tagline ?? null,
      description: r.description,
      url: r.url ?? null,
      categorySlug: r.categorySlug ?? null,
      tags: r.tags ?? [],
      region: r.region ?? null,
      costType: r.costType ?? null,
      kind: r.kind ?? null,
      deadline: r.deadline ?? null,
      opensAt: r.opensAt ?? null,
      amount: r.amount ?? null,
      provider: r.provider ?? null,
      matchType: r.matchType,
      matchedResourceId: r.matchedResourceId,
      rawPayload: r.rawPayload,
      status: "pending" as const,
    })),
  );
}

export type PendingCandidate = typeof schema.ingestionCandidates.$inferSelect;

export async function getPendingCandidates(): Promise<{
  fresh: PendingCandidate[];
  possibleDuplicates: PendingCandidate[];
}> {
  if (!process.env.POSTGRES_URL) return { fresh: [], possibleDuplicates: [] };
  try {
    const rows = await db
      .select()
      .from(schema.ingestionCandidates)
      .where(eq(schema.ingestionCandidates.status, "pending"));
    return {
      fresh: rows.filter((r) => r.matchType === "new"),
      possibleDuplicates: rows.filter((r) => r.matchType === "possible_duplicate"),
    };
  } catch (error) {
    console.warn("[StudentStack DB] getPendingCandidates query failed:", error instanceof Error ? error.message : error);
    return { fresh: [], possibleDuplicates: [] };
  }
}

export async function getPendingCandidatesCount(): Promise<number> {
  if (!process.env.POSTGRES_URL) return 0;
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.ingestionCandidates)
      .where(eq(schema.ingestionCandidates.status, "pending"));
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function getCandidateById(id: number): Promise<PendingCandidate | undefined> {
  const [row] = await db.select().from(schema.ingestionCandidates).where(eq(schema.ingestionCandidates.id, id));
  return row;
}

export async function markCandidateReviewed(id: number, status: "approved" | "rejected"): Promise<void> {
  await db
    .update(schema.ingestionCandidates)
    .set({ status, reviewedAt: new Date() })
    .where(eq(schema.ingestionCandidates.id, id));
}

// Source state (issues #83, #40): fingerprints for change detection and
// the last run's outcome for source health.
export type SourceState = typeof schema.ingestionSources.$inferSelect;

export async function getSourceStates(): Promise<SourceState[]> {
  if (!process.env.POSTGRES_URL) return [];
  try {
    return await db.select().from(schema.ingestionSources);
  } catch (error) {
    console.warn("[StudentStack DB] getSourceStates query failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function saveSourceRuns(summary: SourceRunSummary[], now: Date = new Date()): Promise<void> {
  for (const run of summary) {
    const status = run.error ? "error" : run.unchanged ? "unchanged" : "ok";
    const fields = {
      lastRunAt: now,
      lastStatus: status as SourceState["lastStatus"],
      lastError: run.error ?? null,
      lastFetched: run.fetched,
      lastQueued: run.queued,
      // Keep the old fingerprint when a run fails, so the next run retries.
      ...(run.error ? {} : { lastVersion: run.version ?? null, lastSuccessAt: now }),
    };
    await db
      .insert(schema.ingestionSources)
      .values({ name: run.sourceName, ...fields })
      .onConflictDoUpdate({ target: schema.ingestionSources.name, set: fields });
  }
}
