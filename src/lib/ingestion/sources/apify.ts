import type { CandidateFields, IngestionSource } from "../types";

// Apify actor sources (issue #83), enabled only when APIFY_TOKEN is set.
// Each run uses run-sync-get-dataset-items, which starts the actor, waits
// for it, and returns its dataset in one request. Every run is billed to
// the maintainer's Apify account, so inputs are capped with maxItems.

const APIFY_TIMEOUT_MS = 120_000;

export async function runApifyActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T[]> {
  const res = await fetchImpl(
    `https://api.apify.com/v2/acts/${actorId.replace("/", "~")}/run-sync-get-dataset-items?timeout=110`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Apify ${actorId} returned HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clip(text: string | undefined | null, max = 600): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// --- saadithya/scholarships-competitions-internships-extractor
// (Givemechallenge feeds): normalized YYYY-MM-DD deadlines.
export type ChallengeRow = {
  title?: string;
  description?: string;
  deadline?: string;
  awards?: string;
  challengeLink?: string;
  category?: string;
};

const CHALLENGE_KINDS: Record<string, NonNullable<CandidateFields["kind"]>> = {
  Scholarships: "scholarship",
  Fellowships: "fellowship",
  Internships: "internship",
};

export function mapChallengeRow(row: ChallengeRow): CandidateFields | null {
  const kind = row.category ? CHALLENGE_KINDS[row.category] : undefined;
  if (!kind || !row.title || !row.challengeLink) return null;
  const description = clip(row.description);
  if (!description) return null;
  return {
    externalId: row.challengeLink,
    name: clip(row.title, 120),
    description,
    url: row.challengeLink,
    categorySlug: "learning-and-education",
    tags: [row.category as string],
    region: "Global",
    costType: kind === "internship" ? "stipend" : "scholarship",
    kind,
    amount: row.awards ? clip(row.awards, 80) : null,
    deadline: parseDate(row.deadline),
  };
}

function challengeSource(token: string): IngestionSource {
  return {
    name: "apify:givemechallenge",
    fetchCandidates: async () => {
      const runs = await Promise.all(
        Object.keys(CHALLENGE_KINDS).map((category) =>
          runApifyActor<ChallengeRow>(
            "saadithya/scholarships-competitions-internships-extractor",
            { category, maxItems: 30 },
            token,
          ).then((rows) => rows.map((r) => ({ ...r, category: r.category ?? category }))),
        ),
      );
      return runs.flat();
    },
    mapToCandidate: (raw) => mapChallengeRow(raw as ChallengeRow),
  };
}

// --- gabrielaxy/hackathon-aggregator (Devpost + ETHGlobal).
export type HackathonRow = {
  source?: string;
  name?: string;
  url?: string;
  endDate?: string; // e.g. "May 10 - 12, 2026"
  prize?: string;
  status?: string;
  focus?: string[];
};

// "May 10 - 12, 2026" / "Apr 28 - May 3, 2026" → the start date, which is
// the latest a student can still sign up for most hackathons.
export function hackathonStart(dates: string | undefined): Date | null {
  const m = dates?.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:[^,]*),\s*(\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 23:59:59 UTC`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapHackathonRow(row: HackathonRow): CandidateFields | null {
  if (!row.name || !row.url || row.status === "ended") return null;
  const focus = (row.focus ?? []).slice(0, 3);
  const platform = row.source === "ethglobal" ? "ETHGlobal" : row.source === "devpost" ? "Devpost" : row.source;
  return {
    externalId: row.url,
    name: clip(row.name, 120),
    description: clip(
      [`Hackathon${platform ? ` on ${platform}` : ""}${row.endDate ? `, ${row.endDate}` : ""}.`, focus.length ? `Themes: ${focus.join(", ")}.` : ""]
        .filter(Boolean)
        .join(" "),
    ),
    url: row.url,
    categorySlug: "development-tools",
    tags: ["Hackathon", ...focus],
    region: "Global",
    costType: "free",
    kind: "program",
    amount: row.prize ? clip(row.prize, 80) : null,
    provider: platform ?? null,
    deadline: hackathonStart(row.endDate),
  };
}

function hackathonSource(token: string): IngestionSource {
  return {
    name: "apify:hackathon-aggregator",
    fetchCandidates: () =>
      runApifyActor<HackathonRow>("gabrielaxy/hackathon-aggregator", { sources: ["devpost", "ethglobal"], maxPerSource: 50 }, token),
    mapToCandidate: (raw) => mapHackathonRow(raw as HackathonRow),
  };
}

// --- solidcode/unstop-scraper: strictly scholarships and hackathons
// (StudentStack is not a job board).
export type UnstopRow = {
  id?: number;
  title?: string;
  opportunityType?: string;
  organizer?: string;
  url?: string;
  deadline?: string;
  status?: string;
  prize?: string;
  eligibility?: string[];
  tags?: string[];
};

export function mapUnstopRow(row: UnstopRow): CandidateFields | null {
  const type = row.opportunityType;
  if ((type !== "scholarships" && type !== "hackathons") || !row.title || !row.url) return null;
  if (row.status && row.status !== "live") return null;
  const kind = type === "scholarships" ? "scholarship" : "program";
  const eligibility = (row.eligibility ?? []).join(", ");
  return {
    externalId: row.id ? `unstop:${row.id}` : row.url,
    name: clip(row.title, 120),
    description: clip(
      [
        `${kind === "scholarship" ? "Scholarship" : "Hackathon"} listed on Unstop${row.organizer ? `, by ${row.organizer}` : ""}.`,
        eligibility && `Open to: ${eligibility}.`,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    url: row.url,
    categorySlug: kind === "scholarship" ? "learning-and-education" : "development-tools",
    tags: [kind === "scholarship" ? "Scholarship" : "Hackathon", ...(row.tags ?? []).slice(0, 3)],
    region: "IN",
    costType: kind === "scholarship" ? "scholarship" : "free",
    kind,
    amount: row.prize ? clip(row.prize, 80) : null,
    provider: row.organizer ?? null,
    deadline: parseDate(row.deadline),
  };
}

function unstopSource(token: string): IngestionSource {
  return {
    name: "apify:unstop",
    fetchCandidates: () =>
      runApifyActor<UnstopRow>("solidcode/unstop-scraper", { opportunityTypes: ["scholarships", "hackathons"], maxResults: 100 }, token),
    mapToCandidate: (raw) => mapUnstopRow(raw as UnstopRow),
  };
}

// --- blackfalcondata/internshala-scraper: only flagship programs from a
// short allow-list of companies, never the general internship firehose.
export const FLAGSHIP_INTERNSHIP_COMPANIES = ["microsoft", "amazon", "google", "tcs", "tata consultancy", "infosys", "ibm", "adobe", "goldman sachs", "flipkart"];

export type InternshalaRow = {
  jobKey?: string;
  listingType?: string;
  title?: string;
  company?: string;
  canonicalUrl?: string;
  applyUrl?: string;
  sourceUrl?: string;
  description?: string;
  stipendText?: string;
  applyBy?: string;
  location?: string;
  isWorkFromHome?: boolean;
};

export function mapInternshalaRow(row: InternshalaRow): CandidateFields | null {
  if (row.listingType && row.listingType !== "internship") return null;
  const company = row.company?.toLowerCase() ?? "";
  const url = row.canonicalUrl ?? row.sourceUrl ?? row.applyUrl;
  if (!row.title || !url || !FLAGSHIP_INTERNSHIP_COMPANIES.some((c) => company.includes(c))) return null;
  return {
    externalId: row.jobKey ? `internshala:${row.jobKey}` : url,
    name: clip(`${row.company} — ${row.title}`, 120),
    description: clip(row.description) || `Internship at ${row.company}, listed on Internshala.`,
    url,
    categorySlug: "learning-and-education",
    tags: ["Internship", ...(row.isWorkFromHome ? ["Remote"] : [])],
    region: "IN",
    costType: "stipend",
    kind: "internship",
    amount: row.stipendText ? clip(row.stipendText, 80) : null,
    provider: row.company ?? null,
    deadline: parseDate(row.applyBy),
  };
}

function internshalaSource(token: string): IngestionSource {
  return {
    name: "apify:internshala-flagship",
    fetchCandidates: async () => {
      const runs = await Promise.all(
        ["Microsoft", "Amazon", "Google", "TCS"].map((query) =>
          runApifyActor<InternshalaRow>("blackfalcondata/internshala-scraper", { listingType: "internship", query, maxResults: 25 }, token),
        ),
      );
      return runs.flat();
    },
    mapToCandidate: (raw) => mapInternshalaRow(raw as InternshalaRow),
  };
}

export function apifySources(token: string | undefined): IngestionSource[] {
  if (!token) return [];
  return [challengeSource(token), hackathonSource(token), unstopSource(token), internshalaSource(token)];
}
