import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  slugify,
  urlMatchKey,
  validateSubmission,
  type SubmissionField,
} from "@/lib/submissions";

const cats = [1, 2];
const good = {
  name: " Figma ",
  url: "https://www.figma.com/education/#pricing",
  tagline: "Free Pro plan",
  description: "Free Figma Professional for verified students.",
  categoryId: "2",
  costType: "free",
  region: "Global",
};

function fieldError(patch: Record<string, string>, field: SubmissionField): boolean {
  const result = validateSubmission({ ...good, ...patch }, cats);
  return !result.ok && Boolean(result.errors[field]);
}

describe("validateSubmission", () => {
  it("accepts a complete submission and normalizes it", () => {
    const result = validateSubmission(good, cats);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Figma");
    expect(result.value.url).toBe("https://www.figma.com/education/");
    expect(result.value.categoryId).toBe(2);
    expect(result.value.region).toBe("Global");
  });

  it("keeps the IN region and stores an empty tagline as null", () => {
    const result = validateSubmission({ ...good, region: "IN", tagline: "" }, cats);
    expect(result.ok && result.value.region).toBe("IN");
    expect(result.ok && result.value.tagline).toBeNull();
  });

  it.each([
    [{ url: "javascript:alert(1)" }, "url"],
    [{ url: "ftp://files.example.com" }, "url"],
    [{ url: "https://localhost/offer" }, "url"],
    [{ url: "http://169.254.169.254/latest/meta-data/" }, "url"],
    [{ categoryId: "9" }, "categoryId"],
    [{ costType: "expired" }, "costType"],
    [{ description: "too short" }, "description"],
    [{ name: "x".repeat(81) }, "name"],
    [{ tagline: "x".repeat(91) }, "tagline"],
    [{ credit: "x".repeat(41) }, "credit"],
    [{ credit: "see https://spam.example" }, "credit"],
  ] as [Record<string, string>, SubmissionField][])("rejects %o on %s", (patch, field) => {
    expect(fieldError(patch, field)).toBe(true);
  });
});

describe("contributor credit", () => {
  it("is optional and normalizes whitespace", () => {
    const none = validateSubmission(good, cats);
    expect(none.ok && none.value.credit).toBeNull();
    const named = validateSubmission({ ...good, credit: "  Priya,   IIT Madras " }, cats);
    expect(named.ok && named.value.credit).toBe("Priya, IIT Madras");
  });
});

describe("normalizeUrl", () => {
  it("drops a bare trailing slash", () => {
    expect(normalizeUrl("https://Example.com/")).toBe("https://example.com");
  });
});

describe("urlMatchKey", () => {
  it("treats protocol, www, case, fragment, and trailing slash variants as one offer", () => {
    const key = urlMatchKey("https://figma.com/education");
    expect(urlMatchKey("http://www.Figma.com/education/")).toBe(key);
    expect(urlMatchKey("https://figma.com/education#pricing")).toBe(key);
  });

  it("keeps different paths and query strings apart", () => {
    expect(urlMatchKey("https://figma.com/education")).not.toBe(urlMatchKey("https://figma.com/pricing"));
    expect(urlMatchKey("https://x.com/a?ref=1")).not.toBe(urlMatchKey("https://x.com/a"));
  });
});

describe("slugify", () => {
  it("spells out & and strips punctuation", () => {
    expect(slugify("AI & ML Tools!")).toBe("ai-and-ml-tools");
  });

  it("falls back when nothing is left", () => {
    expect(slugify("!!!")).toBe("offer");
  });
});
