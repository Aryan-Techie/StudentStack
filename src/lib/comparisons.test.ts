import { describe, it, expect } from "vitest";
import {
  COMPARISON_SETS,
  comparisonSetsForResource,
  getComparisonSet,
  orderForSet,
} from "@/lib/comparisons";
import { MOCK_RESOURCES } from "@/lib/mock-data";

describe("comparison sets", () => {
  it("ships three hand-picked sets with unique slugs", () => {
    expect(COMPARISON_SETS).toHaveLength(3);
    const slugs = COMPARISON_SETS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("never lists a resource twice in one set", () => {
    for (const set of COMPARISON_SETS) {
      expect(new Set(set.resourceSlugs).size).toBe(set.resourceSlugs.length);
    }
  });

  it("looks up a set by slug", () => {
    expect(getComparisonSet("cloud-credits")?.name).toMatch(/cloud/i);
    expect(getComparisonSet("nope")).toBeUndefined();
  });

  it("finds the sets a resource belongs to", () => {
    expect(comparisonSetsForResource("github-copilot").map((s) => s.slug)).toEqual([
      "ai-coding-assistants",
    ]);
    expect(comparisonSetsForResource("spotify-premium-student")).toEqual([]);
  });

  it("orders resources by the set and skips missing slugs", () => {
    const set = {
      slug: "t",
      name: "T",
      description: "",
      resourceSlugs: ["figma", "missing", "github-copilot"],
    };
    const ordered = orderForSet(set, MOCK_RESOURCES);
    expect(ordered.map((r) => r.slug)).toEqual(["figma", "github-copilot"]);
  });
});
