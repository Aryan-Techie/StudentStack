import Link from "next/link";
import { getPendingCandidates, getSourceStates, type PendingCandidate } from "@/lib/ingestion/queries";
import { sourceNames } from "@/lib/ingestion/sources";
import { sourceHealth, type SourceHealth } from "@/lib/ingestion/source-health";
import { getResourcesByIds } from "@/lib/resources";
import { rejectAllFromSource, rejectCandidate } from "./actions";

const PAGE_LIMIT = 50;

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const HEALTH_LABEL: Record<SourceHealth["health"], string> = {
  healthy: "Healthy",
  failing: "Failing",
  stale: "Stale",
  never_run: "Not run yet",
};

const HEALTH_CLASS: Record<SourceHealth["health"], string> = {
  healthy: "text-emerald-700 dark:text-emerald-400",
  failing: "text-destructive",
  stale: "text-amber-700 dark:text-amber-400",
  never_run: "text-muted-foreground",
};

export default async function IngestionReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  const [{ fresh: allFresh, possibleDuplicates: allDuplicates }, states] = await Promise.all([
    getPendingCandidates(),
    getSourceStates(),
  ]);
  const health = sourceHealth(sourceNames(), states);

  const pendingBySource = new Map<string, number>();
  for (const c of [...allFresh, ...allDuplicates]) {
    pendingBySource.set(c.sourceName, (pendingBySource.get(c.sourceName) ?? 0) + 1);
  }

  const inSource = (c: PendingCandidate) => !source || c.sourceName === source;
  const fresh = allFresh.filter(inSource);
  const possibleDuplicates = allDuplicates.filter(inSource);
  const matched = await getResourcesByIds(
    possibleDuplicates.slice(0, PAGE_LIMIT).flatMap((c) => (c.matchedResourceId ? [c.matchedResourceId] : [])),
  );
  const resourceById = new Map(matched.map((r) => [r.id, r]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-xl font-bold">Ingestion review</h1>
        <p className="text-muted-foreground text-sm">
          {fresh.length} new, {possibleDuplicates.length} possible duplicates
          {source ? (
            <>
              {" "}
              from <strong>{source}</strong> ·{" "}
              <Link href="/admin/ingestion" className="underline">
                show all sources
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <section aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="mb-3 font-semibold">
          Sources
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-line border-b">
                <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                <th scope="col" className="py-2 pr-3 font-medium">Health</th>
                <th scope="col" className="py-2 pr-3 font-medium">Last run</th>
                <th scope="col" className="py-2 pr-3 font-medium">Last success</th>
                <th scope="col" className="py-2 pr-3 font-medium">Fetched / queued</th>
                <th scope="col" className="py-2 pr-3 font-medium">Pending</th>
                <th scope="col" className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {health.map((s) => {
                const pending = pendingBySource.get(s.name) ?? 0;
                return (
                  <tr key={s.name} className="border-line border-b align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{s.name}</td>
                    <td className={`py-2 pr-3 ${HEALTH_CLASS[s.health]}`}>
                      {HEALTH_LABEL[s.health]}
                      {s.lastStatus === "unchanged" ? <span className="text-muted-foreground"> (unchanged)</span> : null}
                      {s.lastError ? <p className="text-muted-foreground max-w-xs truncate text-xs" title={s.lastError}>{s.lastError}</p> : null}
                    </td>
                    <td className="py-2 pr-3">{s.lastRunAt ? dateTime.format(s.lastRunAt) : "—"}</td>
                    <td className="py-2 pr-3">{s.lastSuccessAt ? dateTime.format(s.lastSuccessAt) : "—"}</td>
                    <td className="py-2 pr-3">
                      {s.lastRunAt ? `${s.lastFetched} / ${s.lastQueued}` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {pending > 0 ? (
                        <Link href={`/admin/ingestion?source=${encodeURIComponent(s.name)}`} className="underline">
                          {pending}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="py-2">
                      {pending > 0 ? (
                        <form action={rejectAllFromSource.bind(null, s.name)}>
                          <button type="submit" className="text-destructive text-xs underline">
                            Reject all {pending}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">New candidates</h2>
        {fresh.length === 0 && <p className="text-muted-foreground text-sm">Nothing pending.</p>}
        <div className="flex flex-col gap-3">
          {fresh.slice(0, PAGE_LIMIT).map((c) => (
            <CandidateCard key={c.id} candidate={c} />
          ))}
        </div>
        {fresh.length > PAGE_LIMIT && (
          <p className="text-muted-foreground mt-3 text-sm">
            Showing {PAGE_LIMIT} of {fresh.length}. Review or reject these to see more, or filter by source above.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Possible duplicates and updates</h2>
        {possibleDuplicates.length === 0 && <p className="text-muted-foreground text-sm">None.</p>}
        <div className="flex flex-col gap-3">
          {possibleDuplicates.slice(0, PAGE_LIMIT).map((c) => {
            const existing = c.matchedResourceId ? resourceById.get(c.matchedResourceId) : undefined;
            return (
              <div key={c.id} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CandidateCard candidate={c} />
                <div className="border-line rounded border p-3 text-sm">
                  <p className="text-muted-foreground mb-1 text-xs">Matched existing resource</p>
                  {existing ? (
                    <>
                      <p className="font-medium">{existing.name}</p>
                      {existing.tagline && <p className="text-muted-foreground">{existing.tagline}</p>}
                      {existing.url && <p className="text-muted-foreground truncate text-xs">{existing.url}</p>}
                      <Link href={`/admin/resources/${existing.id}`} className="mt-2 inline-block underline">
                        Edit existing
                      </Link>
                    </>
                  ) : (
                    <p className="font-medium">Unknown</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {possibleDuplicates.length > PAGE_LIMIT && (
          <p className="text-muted-foreground mt-3 text-sm">
            Showing {PAGE_LIMIT} of {possibleDuplicates.length}.
          </p>
        )}
      </section>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: PendingCandidate }) {
  const facts = [
    candidate.kind && candidate.kind !== "perk" ? candidate.kind : null,
    candidate.amount,
    candidate.provider ? `by ${candidate.provider}` : null,
    candidate.opensAt ? `opens ${dateOnly.format(candidate.opensAt)}` : null,
    candidate.deadline ? `deadline ${dateOnly.format(candidate.deadline)}` : null,
  ].filter(Boolean);
  return (
    <div className="border-line flex items-start justify-between gap-3 rounded border p-3">
      <div className="min-w-0">
        <p className="font-medium">{candidate.name}</p>
        {candidate.tagline && <p className="text-muted-foreground text-sm">{candidate.tagline}</p>}
        <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{candidate.description}</p>
        {facts.length > 0 && <p className="mt-1 text-xs">{facts.join(" · ")}</p>}
        <p className="text-muted-foreground mt-1 text-xs">from {candidate.sourceName}</p>
        {candidate.url && (
          <a href={candidate.url} target="_blank" rel="noreferrer" className="block truncate text-xs underline">
            {candidate.url}
          </a>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-sm">
        <Link href={`/admin/resources/new?candidateId=${candidate.id}`} className="underline">
          Review &amp; approve
        </Link>
        <form action={rejectCandidate.bind(null, candidate.id)}>
          <button type="submit" className="text-destructive underline">
            Reject
          </button>
        </form>
      </div>
    </div>
  );
}
