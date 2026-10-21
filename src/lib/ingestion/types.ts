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
};

export type IngestionSource = {
  name: string;
  fetchCandidates(): Promise<RawCandidate[]>;
  mapToCandidate(raw: RawCandidate): CandidateFields | null; // null = skip this item (unmappable)
};
