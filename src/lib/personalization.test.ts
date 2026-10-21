import { describe, it, expect } from "vitest";
import {
  hasSignals,
  isBranch,
  personalizationScore,
  resourceBranches,
  sortForYou,
} from "@/lib/personalization";

type R = Parameters<typeof personalizationScore>[0];

const r = (over: Partial<R>): R => ({
  name: "Thing",
  tags: [],
  categorySlug: "productivity",
  eligibility: null,
  ...over,
});

describe("resourceBranches", () => {
  it("maps categories, tags, and flagship tool names", () => {
    expect([...resourceBranches(r({ categorySlug: "development-tools" }))]).toEqual(["CSE"]);
    expect(resourceBranches(r({ tags: ["PCB & Electronics Design"] })).has("ECE")).toBe(true);
    expect(resourceBranches(r({ name: "SolidWorks Student" })).has("Mechanical")).toBe(true);
    expect(resourceBranches(r({ name: "Lumion" })).has("Civil")).toBe(true);
  });

  it("returns nothing for unrelated resources", () => {
    expect(resourceBranches(r({ name: "Spotify", tags: ["Entertainment"] })).size).toBe(0);
  });
});

describe("personalizationScore", () => {
  it("boosts branch matches", () => {
    const matlab = r({ name: "MATLAB" });
    expect(personalizationScore(matlab, { branch: "ECE", year: null })).toBe(2);
    expect(personalizationScore(matlab, { branch: "CSE", year: null })).toBe(0);
  });

  it("never boosts for the Other branch", () => {
    expect(personalizationScore(r({ categorySlug: "development-tools" }), { branch: "Other", year: null })).toBe(0);
  });

  it("uses year only against a minimum-year requirement", () => {
    const thirdYearPlus = r({ eligibility: { minYear: 3 } });
    expect(personalizationScore(thirdYearPlus, { branch: null, year: 4 })).toBe(1);
    expect(personalizationScore(thirdYearPlus, { branch: null, year: 1 })).toBe(-1);
    expect(personalizationScore(r({}), { branch: null, year: 1 })).toBe(0);
  });
});

describe("sortForYou", () => {
  it("moves matches up but keeps every resource, in stable order", () => {
    const a = r({ name: "A" });
    const b = r({ name: "SolidWorks" });
    const c = r({ name: "C" });
    const d = r({ name: "Ansys" });
    const sorted = sortForYou([a, b, c, d], { branch: "Mechanical", year: null });
    expect(sorted.map((x) => x.name)).toEqual(["SolidWorks", "Ansys", "A", "C"]);
  });
});

describe("helpers", () => {
  it("isBranch and hasSignals", () => {
    expect(isBranch("ECE")).toBe(true);
    expect(isBranch("Physics")).toBe(false);
    expect(hasSignals(null)).toBe(false);
    expect(hasSignals({ branch: null, year: null })).toBe(false);
    expect(hasSignals({ branch: null, year: 2 })).toBe(true);
  });
});
