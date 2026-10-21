// Overlays the hand-curated flagship opportunities (issue #79,
// src/lib/flagship-opportunities.ts) onto the normalized dataset: rows that
// already exist get the curated dates, amounts, and eligibility; the rest
// are added as new rows.
import type { NormalizedResource } from "./normalize-data";
import { coreName, normalizeName } from "./student-resources";
import type { FlagshipOpportunity } from "../src/lib/flagship-opportunities";

// Dates are stored at 12:00 UTC so the calendar date reads the same from
// UTC-11 to UTC+11: end-of-day UTC would show an Indian student a deadline
// one day late. Programs often close mid-day, so this errs early, never late.
export function flagshipToResource(f: FlagshipOpportunity): NormalizedResource {
  const india = f.region === "IN";
  return {
    slug: f.slug,
    name: f.name,
    tagline: f.tagline ?? f.amount ?? null,
    description: f.description,
    url: f.url,
    hasStaticClaimUrl: true,
    categorySlug: f.categorySlug,
    tags: f.tags ?? [],
    region: india ? "IN" : "Global",
    regions: india ? ["IN"] : (f.eligibility?.countries ?? []),
    regionLocked: india,
    costType: f.costType,
    verificationNeeded: undefined,
    status: "active",
    kind: f.kind,
    opensAt: f.opensAt ? new Date(`${f.opensAt}T12:00:00Z`) : null,
    deadline: f.deadline ? new Date(`${f.deadline}T12:00:00Z`) : null,
    recurrence: f.recurrence ?? null,
    amount: f.amount ?? null,
    provider: f.provider ?? null,
    eligibility: f.eligibility ?? null,
  };
}

export function applyFlagship(
  resources: NormalizedResource[],
  flagship: FlagshipOpportunity[],
): { resources: NormalizedResource[]; enriched: string[]; added: string[] } {
  const out = [...resources];
  const enriched: string[] = [];
  const added: string[] = [];
  for (const f of flagship) {
    const curated = flagshipToResource(f);
    const keys = new Set([normalizeName(f.name), ...(f.aliases ?? []).map(normalizeName)]);
    const matches = out
      .map((r, i) => ({ r, i }))
      .filter(
        ({ r }) =>
          r.slug === f.slug || keys.has(normalizeName(r.name)) || (f.kind === "perk" && coreName(r.name) === coreName(f.name)),
      );
    if (matches.length === 0) {
      out.push(curated);
      added.push(f.slug);
      continue;
    }
    // A program can be listed under more than one name (e.g. a renamed
    // scheme), so every matching row gets the curated data. Each keeps its
    // identity (slug, copy, tags); the curated opportunity data is the
    // reviewed source of truth.
    for (const { r: existing, i } of matches) {
      out[i] = {
        ...existing,
        url: curated.url ?? existing.url,
        hasStaticClaimUrl: Boolean(curated.url ?? existing.url),
        region: curated.region,
        regions: curated.regions,
        regionLocked: curated.regionLocked,
        costType: curated.costType,
        kind: curated.kind,
        opensAt: curated.opensAt,
        deadline: curated.deadline,
        recurrence: curated.recurrence,
        amount: curated.amount,
        provider: curated.provider,
        eligibility: curated.eligibility,
      };
      enriched.push(existing.slug);
    }
  }
  return { resources: out, enriched, added };
}
