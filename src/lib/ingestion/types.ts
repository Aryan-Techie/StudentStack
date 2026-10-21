export type RawCandidate = unknown; // shape is source-specific

export type CandidateFields = {
  externalId?: string;
  name: string;
  tagline?: string | null;
  description: string;
  url?: string | null;
  categorySlug?: string | null;
  tags?: string[];
  region?: "IN" | "Global";
  costType?: "free" | "discount" | "stipend" | "scholarship" | "credits" | "trial";
  // Opportunity fields (issue #78), for sources that list scholarships,
  // internships, and programs rather than perks.
  kind?: "perk" | "scholarship" | "fellowship" | "internship" | "mentorship" | "program";
  deadline?: Date | null;
  opensAt?: Date | null;
  amount?: string | null;
  provider?: string | null;
  // Slug of the listed resource this candidate is an update for (issue
  // #40, vendor page watching). Queued next to that resource for review
  // instead of going through duplicate matching.
  updateOf?: string;
};

export type IngestionSource = {
  name: string;
  fetchCandidates(): Promise<RawCandidate[]>;
  mapToCandidate(raw: RawCandidate): CandidateFields | null; // null = skip this item (unmappable)
  // Optional change detection (issue #83): a cheap fingerprint of the
  // upstream data, e.g. the latest commit SHA of a GitHub file. When it
  // matches the previous run's, the source is skipped.
  version?(): Promise<string | null>;
  // With version(): on the very first run (no stored fingerprint) record
  // the fingerprint without queuing anything, so watching starts from
  // today's state instead of flagging every page as changed.
  baselineFirstRun?: boolean;
};
