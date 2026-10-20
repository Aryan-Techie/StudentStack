import type { Resource } from "@/lib/resources";
import { worksInIndia } from "@/lib/directory-filters";

// Accountless eligibility profile (issue #84). Lives in localStorage first
// and syncs to `profiles` when the student signs in. Every field is
// optional: an unset field never rules a resource out.
export type EligibilityLevel = "HighSchool" | "UG" | "PG" | "PhD";

export type EligibilityProfile = {
  country: string; // ISO 3166-1 alpha-2
  state?: string;
  level?: EligibilityLevel;
  year?: number;
  field?: string; // a BRANCHES value from src/lib/personalization.ts
  hasEduEmail?: boolean;
  hasGithubPack?: boolean;
  hasStudentId?: boolean;
};

export const DEFAULT_ELIGIBILITY: EligibilityProfile = { country: "IN" };

export const ELIGIBILITY_LEVEL_OPTIONS: [EligibilityLevel, string][] = [
  ["HighSchool", "High school"],
  ["UG", "Undergraduate"],
  ["PG", "Postgraduate"],
  ["PhD", "PhD"],
];

// Resource `eligibility.fields` are free text entered by admins ("CS",
// "Computer Science", "ECE"), while profiles use BRANCHES values ("CSE").
// Compare on a shared canonical code.
const FIELD_ALIASES: Record<string, string> = {
  cs: "cs",
  cse: "cs",
  it: "cs",
  "computer science": "cs",
  "computer science / it": "cs",
  ece: "ece",
  eee: "ece",
  ee: "ece",
  electronics: "ece",
  electrical: "ece",
  "electronics / electrical": "ece",
  mechanical: "mech",
  mech: "mech",
  aerospace: "mech",
  "mechanical / aerospace": "mech",
  civil: "civil",
  architecture: "civil",
  "civil / architecture": "civil",
  design: "design",
};

function canonicalField(value: string): string {
  const v = value.trim().toLowerCase();
  return FIELD_ALIASES[v] ?? v;
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function meetsVerification(r: Pick<Resource, "verificationNeeded">, p: EligibilityProfile): boolean {
  switch (r.verificationNeeded) {
    case "edu_email":
      return Boolean(p.hasEduEmail);
    case "github_student_pack":
      return Boolean(p.hasGithubPack);
    case "student_id":
      return Boolean(p.hasStudentId);
    default:
      return true; // "none" or not reviewed yet
  }
}

function meetsRegion(r: Pick<Resource, "region" | "regions" | "regionLocked">, country: string): boolean {
  if (country === "IN") return worksInIndia(r);
  if (r.region === "IN" || r.regions.includes("IN")) return r.regions.includes(country) || !r.regionLocked;
  return !r.regionLocked || r.regions.includes(country);
}

// "Only what I'm eligible for". Checks verification, region, and the
// structured eligibility rules from #78. A rule only excludes a resource
// when both the resource and the profile have a value for it.
export function isEligible(
  r: Pick<Resource, "verificationNeeded" | "region" | "regions" | "regionLocked" | "eligibility">,
  p: EligibilityProfile,
): boolean {
  if (!meetsVerification(r, p)) return false;
  if (p.country && !meetsRegion(r, p.country)) return false;

  const e = r.eligibility;
  if (!e) return true;
  if (e.countries?.length && p.country && !e.countries.some((c) => sameText(c, p.country))) return false;
  if (e.states?.length && p.state && !e.states.some((s) => sameText(s, p.state as string))) return false;
  if (e.levels?.length && p.level && !e.levels.includes(p.level)) return false;
  if (e.minYear && p.year && p.year < e.minYear) return false;
  if (e.fields?.length && p.field && p.field !== "Other") {
    const mine = canonicalField(p.field);
    if (!e.fields.some((f) => canonicalField(f) === mine)) return false;
  }
  return true;
}

// Tolerates anything found in localStorage or sent by a client.
export function parseEligibilityProfile(raw: unknown): EligibilityProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const country = typeof o.country === "string" && /^[A-Za-z]{2}$/.test(o.country) ? o.country.toUpperCase() : "IN";
  const profile: EligibilityProfile = { country };
  if (typeof o.state === "string" && o.state.trim()) profile.state = o.state.trim().slice(0, 60);
  if (ELIGIBILITY_LEVEL_OPTIONS.some(([l]) => l === o.level)) profile.level = o.level as EligibilityLevel;
  if (typeof o.year === "number" && Number.isInteger(o.year) && o.year >= 1 && o.year <= 5) profile.year = o.year;
  if (typeof o.field === "string" && o.field.trim()) profile.field = o.field.trim().slice(0, 40);
  if (o.hasEduEmail === true) profile.hasEduEmail = true;
  if (o.hasGithubPack === true) profile.hasGithubPack = true;
  if (o.hasStudentId === true) profile.hasStudentId = true;
  return profile;
}
