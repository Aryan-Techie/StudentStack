import { describe, it, expect } from "vitest";
import {
  parseEligibility,
  parseKind,
  parseOpportunityFields,
  toDateInputValue,
} from "@/lib/admin/opportunity-fields";

function form(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe("parseKind", () => {
  it("accepts known kinds", () => {
    expect(parseKind("scholarship")).toBe("scholarship");
  });

  it("falls back to perk for empty or unknown values", () => {
    expect(parseKind(null)).toBe("perk");
    expect(parseKind("grant")).toBe("perk");
  });
});

describe("parseEligibility", () => {
  it("returns null when nothing is filled", () => {
    expect(parseEligibility(form([["eligibilityCountries", " "]]))).toBeNull();
  });

  it("parses lists, numbers, and levels", () => {
    const result = parseEligibility(
      form([
        ["eligibilityLevels", "UG"],
        ["eligibilityLevels", "PG"],
        ["eligibilityLevels", "Postdoc"],
        ["eligibilityCountries", "in, us"],
        ["eligibilityStates", "Kerala"],
        ["eligibilityFields", "CS, ECE"],
        ["eligibilityMinYear", "2"],
        ["eligibilityMaxAge", "abc"],
        ["eligibilityIncomeCapInr", "800000"],
        ["eligibilityGender", "female"],
      ]),
    );
    expect(result).toEqual({
      levels: ["UG", "PG"],
      countries: ["IN", "US"],
      states: ["Kerala"],
      fields: ["CS", "ECE"],
      minYear: 2,
      incomeCapInr: 800000,
      gender: "female",
    });
  });
});

describe("parseOpportunityFields", () => {
  it("nulls empty text and date fields", () => {
    const result = parseOpportunityFields(form([["deadline", ""], ["amount", "  "]]));
    expect(result).toEqual({
      kind: "perk",
      deadline: null,
      opensAt: null,
      recurrence: null,
      amount: null,
      provider: null,
      eligibility: null,
    });
  });

  it("parses dates and metadata", () => {
    const result = parseOpportunityFields(
      form([
        ["kind", "fellowship"],
        ["opensAt", "2026-02-01"],
        ["deadline", "2026-03-15"],
        ["recurrence", "annual, opens Feb"],
        ["amount", "₹31,000/month"],
        ["provider", "AICTE"],
      ]),
    );
    expect(result.kind).toBe("fellowship");
    expect(result.opensAt?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(result.deadline?.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(result.amount).toBe("₹31,000/month");
    expect(result.provider).toBe("AICTE");
    expect(result.recurrence).toBe("annual, opens Feb");
  });
});

describe("toDateInputValue", () => {
  it("formats epoch ms as YYYY-MM-DD", () => {
    expect(toDateInputValue(Date.UTC(2026, 2, 15))).toBe("2026-03-15");
  });

  it("returns empty string for null", () => {
    expect(toDateInputValue(null)).toBe("");
  });
});
