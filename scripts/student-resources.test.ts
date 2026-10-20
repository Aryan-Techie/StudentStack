import { describe, expect, it } from "vitest";
import { coreName, normalizeStudentResources } from "./student-resources";
import { applyFlagship } from "./flagship";
import type { NormalizedResource } from "./normalize-data";
import type { FlagshipOpportunity } from "../src/lib/flagship-opportunities";

const offer = (over: Partial<NormalizedResource>): NormalizedResource => ({
  slug: "x",
  name: "X",
  tagline: null,
  description: "",
  url: null,
  hasStaticClaimUrl: false,
  categorySlug: "development-tools",
  tags: [],
  region: "Global",
  regions: [],
  regionLocked: false,
  costType: "free",
  status: "active",
  ...over,
});

const existing = [
  offer({ slug: "cursor-pro", name: "Cursor", url: "https://cursor.com/students" }),
  offer({ slug: "notion", name: "Notion", url: "https://www.notion.so/product/notion-for-education" }),
];

describe("coreName", () => {
  it("drops words that describe the student deal", () => {
    expect(coreName("Cursor Pro Student")).toBe("cursor");
    expect(coreName("Notion Education Plan")).toBe("notion");
    expect(coreName("Adobe Podcast Studio")).toBe("adobe podcast studio");
  });
});

describe("normalizeStudentResources", () => {
  const result = normalizeStudentResources(
    {
      tools_and_software: [
        { "Program Name": "Cursor Pro Student", "Program Value": "Free 1 year", "Apply Link": "https://cursor.com/x" },
        { "Program Name": "Leonardo.ai", "Program Value": "Free tier", Tags: ["ai", "design"], Description: "AI image generation." },
      ],
      scholarships_and_fellowships: [
        {
          "Program Name": "PM-USP Scholarship",
          "Program Value": "₹12,000-20,000 per annum",
          Tags: ["scholarship", "government"],
          Description: "Central Sector Scheme for students above the 80th percentile.",
          "Apply Link": "https://scholarships.gov.in/",
        },
        { "Program Name": "Rhodes Fellowship", "Program Value": "Fully funded", Tags: ["fellowship"] },
      ],
      internships_and_mentorship: [
        { "Program Name": "ADPList", "Program Value": "Free global mentorship", Tags: ["mentorship"] },
        { "Program Name": "Mitacs Globalink", "Program Value": "CAD $6,000-7,000", Tags: ["research", "internship"] },
        { "Program Name": "Internshala", "Program Value": "120,000+ internships" },
      ],
    },
    existing,
  );

  it("drops rows offers.json already has, matching on the product name", () => {
    expect(result.duplicates).toEqual([{ name: "Cursor Pro Student", matched: "Cursor" }]);
  });

  it("excludes job boards", () => {
    expect(result.excluded).toEqual(["Internshala"]);
  });

  it("maps buckets to kinds, cost types, categories, and regions", () => {
    const by = Object.fromEntries(result.resources.map((r) => [r.name, r]));
    expect(by["Leonardo.ai"]).toMatchObject({ kind: "perk", categorySlug: "ai-and-machine-learning", amount: null });
    expect(by["PM-USP Scholarship"]).toMatchObject({
      kind: "scholarship",
      costType: "scholarship",
      region: "IN",
      regions: ["IN"],
      regionLocked: true,
      amount: "₹12,000-20,000 per annum",
      categorySlug: "learning-and-education",
    });
    expect(by["Rhodes Fellowship"].kind).toBe("fellowship");
    expect(by["ADPList"].kind).toBe("mentorship");
    expect(by["Mitacs Globalink"]).toMatchObject({ kind: "internship", costType: "stipend", region: "Global" });
  });

  it("gives every new row a unique slug", () => {
    const slugs = [...existing, ...result.resources].map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("applyFlagship", () => {
  const gsoc: FlagshipOpportunity = {
    slug: "google-summer-of-code",
    name: "Google Summer of Code",
    aliases: ["GSoC"],
    url: "https://summerofcode.withgoogle.com/",
    provider: "Google",
    kind: "program",
    categorySlug: "development-tools",
    costType: "stipend",
    region: "Global",
    amount: "$1,500–6,600",
    recurrence: "Mar",
    opensAt: "2026-03-16",
    deadline: "2026-03-31",
    description: "Paid open-source contributor program.",
    source: "https://developers.google.com/open-source/gsoc/timeline",
  };

  it("enriches a matching row and keeps its slug", () => {
    const { resources, enriched, added } = applyFlagship([offer({ slug: "gsoc", name: "GSoC" })], [gsoc]);
    expect(enriched).toEqual(["gsoc"]);
    expect(added).toEqual([]);
    expect(resources[0]).toMatchObject({ slug: "gsoc", kind: "program", amount: "$1,500–6,600", recurrence: "Mar" });
    expect(resources[0].deadline?.toISOString()).toBe("2026-03-31T12:00:00.000Z");
  });

  it("adds programs that aren't listed yet", () => {
    const { resources, added } = applyFlagship([], [gsoc]);
    expect(added).toEqual(["google-summer-of-code"]);
    expect(resources[0]).toMatchObject({ hasStaticClaimUrl: true, costType: "stipend" });
  });
});
