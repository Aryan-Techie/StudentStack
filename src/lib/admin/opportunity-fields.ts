import { RESOURCE_KIND_VALUES, type ResourceEligibility } from "@/db/schema";
import type { ResourceKind } from "@/lib/resources";

// Parses the opportunity fields (issue #78) out of the admin create/edit
// resource form. Kept free of server-only imports so it can be unit tested.

export const ELIGIBILITY_LEVELS = ["HighSchool", "UG", "PG", "PhD"] as const;

function text(formData: FormData, name: string): string | null {
  return String(formData.get(name) ?? "").trim() || null;
}

function list(formData: FormData, name: string, upper = false): string[] {
  return String(formData.get(name) ?? "")
    .split(",")
    .map((v) => (upper ? v.trim().toUpperCase() : v.trim()))
    .filter(Boolean);
}

function positiveInt(formData: FormData, name: string): number | undefined {
  const n = Number(String(formData.get(name) ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function parseDate(raw: FormDataEntryValue | null): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseKind(raw: FormDataEntryValue | null): ResourceKind {
  const value = String(raw ?? "");
  return (RESOURCE_KIND_VALUES as readonly string[]).includes(value)
    ? (value as ResourceKind)
    : "perk";
}

// Returns null when no eligibility field is filled, so perks keep a NULL
// column instead of an empty object.
export function parseEligibility(formData: FormData): ResourceEligibility | null {
  const eligibility: ResourceEligibility = {};

  const levels = formData
    .getAll("eligibilityLevels")
    .map(String)
    .filter((l): l is (typeof ELIGIBILITY_LEVELS)[number] =>
      (ELIGIBILITY_LEVELS as readonly string[]).includes(l),
    );
  if (levels.length) eligibility.levels = levels;

  const countries = list(formData, "eligibilityCountries", true);
  if (countries.length) eligibility.countries = countries;
  const states = list(formData, "eligibilityStates");
  if (states.length) eligibility.states = states;
  const fields = list(formData, "eligibilityFields");
  if (fields.length) eligibility.fields = fields;

  const minYear = positiveInt(formData, "eligibilityMinYear");
  if (minYear !== undefined) eligibility.minYear = minYear;
  const maxAge = positiveInt(formData, "eligibilityMaxAge");
  if (maxAge !== undefined) eligibility.maxAge = maxAge;
  const incomeCapInr = positiveInt(formData, "eligibilityIncomeCapInr");
  if (incomeCapInr !== undefined) eligibility.incomeCapInr = incomeCapInr;
  const gender = text(formData, "eligibilityGender");
  if (gender) eligibility.gender = gender;

  return Object.keys(eligibility).length ? eligibility : null;
}

export function parseOpportunityFields(formData: FormData) {
  return {
    kind: parseKind(formData.get("kind")),
    deadline: parseDate(formData.get("deadline")),
    opensAt: parseDate(formData.get("opensAt")),
    recurrence: text(formData, "recurrence"),
    amount: text(formData, "amount"),
    provider: text(formData, "provider"),
    eligibility: parseEligibility(formData),
  };
}

// <input type="date"> wants YYYY-MM-DD.
export function toDateInputValue(ms: number | null | undefined): string {
  return ms ? new Date(ms).toISOString().slice(0, 10) : "";
}
