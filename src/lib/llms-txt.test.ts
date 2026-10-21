import { describe, it, expect } from "vitest";
import { buildLlmsTxt } from "@/lib/llms-txt";

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt({
    origin: "https://example.test",
    categories: [{ slug: "cloud-and-hosting", name: "Cloud & Hosting" }],
    presets: [{ slug: "free-for-indian-students", title: "Free tools for Indian students" }],
    comparisons: [{ slug: "cloud-credits", name: "Cloud credits compared" }],
  });

  it("follows the llms.txt layout", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("# StudentStack");
    expect(lines[2].startsWith("> ")).toBe(true);
    expect(text).toContain("## API");
  });

  it("lists endpoints, feeds, presets, comparisons, and categories with absolute URLs", () => {
    expect(text).toContain("https://example.test/api/resources");
    expect(text).toContain("https://example.test/deadlines.ics");
    expect(text).toContain("https://example.test/free-for-indian-students");
    expect(text).toContain("https://example.test/compare/cloud-credits");
    expect(text).toContain("category slug `cloud-and-hosting`");
  });
});
