import { describe, it, expect } from "vitest";
import { classifyMatch, hostOf } from "./classify-match";
import type { Resource } from "@/lib/resources";

const r = (id: number, name: string, url: string | null): Resource => ({
  id,
  slug: `r${id}`,
  name,
  tagline: null,
  description: "",
  url,
  hasStaticClaimUrl: Boolean(url),
  categoryId: 1,
  categorySlug: "dev",
  categoryName: "Dev",
  categoryIcon: "dev",
  tags: [],
  region: "Global",
  regions: [],
  regionLocked: false,
  costType: "free",
  verificationNeeded: null,
  creditCardRequired: null,
  duration: null,
  status: "active",
  lastVerifiedAt: null,
  deadline: null,
});

const existing = [
  r(1, "GitHub Copilot", "https://github.com/copilot"),
  r(2, "Figma", "https://www.figma.com/education/"),
  r(3, "Google Summer of Code", "https://summerofcode.withgoogle.com/"),
];

describe("classifyMatch", () => {
  it("treats URL variants of a listed offer as duplicates", () => {
    expect(classifyMatch({ name: "Anything", description: "", url: "http://figma.com/education" }, existing).kind).toBe("duplicate");
    expect(classifyMatch({ name: "X", description: "", url: "https://GitHub.com/copilot#plans" }, existing).kind).toBe("duplicate");
  });

  it("treats the same name on the same site as a duplicate", () => {
    expect(
      classifyMatch({ name: "Google Summer of Code (GSoC)", description: "", url: "https://summerofcode.withgoogle.com/how-it-works" }, existing).kind,
    ).toBe("duplicate");
  });

  it("flags close names as possible duplicates", () => {
    expect(classifyMatch({ name: "Github Co-pilot", description: "", url: "https://different.example.com" }, existing)).toEqual({
      kind: "possible_duplicate",
      matchedResourceId: 1,
    });
  });

  it("flags a different page on an offer-specific host", () => {
    expect(classifyMatch({ name: "Design seats for clubs", description: "", url: "https://figma.com/clubs" }, existing)).toEqual({
      kind: "possible_duplicate",
      matchedResourceId: 2,
    });
  });

  it("ignores shared hosts like github.com", () => {
    expect(classifyMatch({ name: "Totally Unrelated Tool", description: "", url: "https://github.com/someone/tool" }, existing).kind).toBe("new");
  });

  it("classifies unrelated offers as new", () => {
    expect(classifyMatch({ name: "Totally Unrelated Tool", description: "", url: "https://unrelated.example.com" }, existing).kind).toBe("new");
  });
});

describe("hostOf", () => {
  it("strips www and tolerates bad URLs", () => {
    expect(hostOf("https://www.Figma.com/x")).toBe("figma.com");
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});
