import Fuse from "fuse.js";
import type { Resource } from "@/lib/resources";
import { urlMatchKey } from "@/lib/submissions";
import type { CandidateFields } from "./types";

export type MatchResult =
  | { kind: "duplicate" }
  | { kind: "possible_duplicate"; matchedResourceId: number }
  | { kind: "new" };

// Fuse.js threshold, lower = stricter match required.
const FUZZY_THRESHOLD = 0.3;

// Hosts that list many unrelated offers, so sharing one says nothing about
// whether two offers are the same (issue #40).
const SHARED_HOSTS = new Set([
  "github.com",
  "education.github.com",
  "medium.com",
  "devpost.com",
  "devfolio.co",
  "unstop.com",
  "internshala.com",
  "brabble.ai",
  "docs.google.com",
  "forms.gle",
  "bit.ly",
  "linktr.ee",
  "notion.site",
]);

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Duplicate (dropped) when the link is the same offer under URL
// normalization (protocol, www, case, fragment, trailing slash), or the
// name is identical on the same site. Possible duplicate (queued next to
// the match) on a fuzzy name hit or a shared, offer-specific host.
export function classifyMatch(candidate: CandidateFields, existingResources: Resource[]): MatchResult {
  const candidateHost = hostOf(candidate.url);
  if (candidate.url) {
    const key = urlMatchKey(candidate.url);
    if (existingResources.some((r) => r.url && urlMatchKey(r.url) === key)) return { kind: "duplicate" };
  }

  const name = normalizeName(candidate.name);
  const sameName = existingResources.find((r) => normalizeName(r.name) === name);
  if (sameName && candidateHost && hostOf(sameName.url) === candidateHost) return { kind: "duplicate" };
  if (sameName) return { kind: "possible_duplicate", matchedResourceId: sameName.id };

  const fuse = new Fuse(existingResources, { keys: ["name"], threshold: FUZZY_THRESHOLD });
  const hit = fuse.search(candidate.name)[0];
  if (hit) return { kind: "possible_duplicate", matchedResourceId: hit.item.id };

  if (candidateHost && !SHARED_HOSTS.has(candidateHost)) {
    const sameHost = existingResources.find((r) => hostOf(r.url) === candidateHost);
    if (sameHost) return { kind: "possible_duplicate", matchedResourceId: sameHost.id };
  }

  return { kind: "new" };
}
