import { describe, it, expect } from "vitest";
import { matchesApiFilters, parseApiFilters } from "@/lib/api-filters";
import type { Resource } from "@/lib/resources";

const now = Date.UTC(2026, 9, 20);
const day = 86_400_000;

const base: Resource = {
  id: 1,
  slug: "a",
  name: "A",
  tagline: null,
  description: "",
  url: null,
  hasStaticClaimUrl: false,
  categoryId: 1,
  categorySlug: "cloud-and-hosting",
  categoryName: "Cloud",
  categoryIcon: "cloud",
  tags: [],
  region: "Global",
  regions: [],
  regionLocked: false,
  costType: "free",
  verificationNeeded: null,
  creditCardRequired: null,
  duration: null,
  deadline: null,
  status: "active",
  lastVerifiedAt: null,
};

describe("parseApiFilters", () => {
  it("returns no filters for an empty query", () => {
    expect(parseApiFilters(new URLSearchParams())).toEqual({ ok: true, filters: {} });
  });
});

describe("matchesApiFilters", () => {
  it("treats a missing kind as perk", () => {
    expect(matchesApiFilters(base, { kind: ["perk"] }, now)).toBe(true);
    expect(matchesApiFilters(base, { kind: ["scholarship"] }, now)).toBe(false);
    expect(matchesApiFilters({ ...base, kind: "scholarship" }, { kind: ["scholarship"] }, now)).toBe(true);
  });

  it("filters by category slug", () => {
    expect(matchesApiFilters(base, { category: "cloud-and-hosting" }, now)).toBe(true);
    expect(matchesApiFilters(base, { category: "productivity" }, now)).toBe(false);
  });

  it("uses directory region semantics", () => {
    const usOnly = { ...base, regions: ["US"], regionLocked: true };
    expect(matchesApiFilters(usOnly, { region: "IN" }, now)).toBe(false);
    expect(matchesApiFilters(usOnly, { region: "Global" }, now)).toBe(false);
    const indiaOnly = { ...base, region: "IN" as const, regions: ["IN"], regionLocked: true };
    expect(matchesApiFilters(indiaOnly, { region: "IN" }, now)).toBe(true);
    expect(matchesApiFilters(base, { region: "IN" }, now)).toBe(true);
  });

  it("keeps only active resources still open and closing before the date", () => {
    const before = new Date(now + 30 * day);
    expect(matchesApiFilters({ ...base, deadline: now + 10 * day }, { deadlineBefore: before }, now)).toBe(true);
    expect(matchesApiFilters({ ...base, deadline: now + 40 * day }, { deadlineBefore: before }, now)).toBe(false);
    expect(matchesApiFilters({ ...base, deadline: now - day }, { deadlineBefore: before }, now)).toBe(false);
    expect(matchesApiFilters(base, { deadlineBefore: before }, now)).toBe(false);
    expect(
      matchesApiFilters({ ...base, deadline: now + day, status: "expired" }, { deadlineBefore: before }, now),
    ).toBe(false);
  });
});
