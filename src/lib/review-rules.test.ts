import { describe, it, expect } from "vitest";
import { formatRating, isAcademicEmail, validateReview } from "@/lib/review-rules";

describe("validateReview", () => {
  it("accepts 1-5 integer ratings and trims the comment", () => {
    expect(validateReview("4", "  Great  ")).toEqual({ ok: true, value: { rating: 4, comment: "Great" } });
    expect(validateReview(5, "")).toEqual({ ok: true, value: { rating: 5, comment: null } });
  });

  it("rejects out-of-range or fractional ratings", () => {
    for (const r of [0, 6, 2.5, "x", null]) expect(validateReview(r, "").ok).toBe(false);
  });

  it("rejects comments over the limit", () => {
    expect(validateReview(3, "x".repeat(1001)).ok).toBe(false);
  });
});

describe("isAcademicEmail", () => {
  it.each(["a@mit.edu", "a@cs.stanford.edu", "a@iitb.ac.in", "a@ox.ac.uk", "a@du.edu.in", "a@x.ernet.in"])(
    "accepts %s",
    (email) => expect(isAcademicEmail(email)).toBe(true),
  );

  it.each(["a@gmail.com", "a@education.com", "a@edu.example.com", null, ""])("rejects %s", (email) =>
    expect(isAcademicEmail(email)).toBe(false),
  );
});

describe("formatRating", () => {
  it("formats the aggregate", () => {
    expect(formatRating({ average: 4.25, count: 23 })).toBe("4.3 ★ (23 reviews)");
    expect(formatRating({ average: 5, count: 1 })).toBe("5.0 ★ (1 review)");
  });
});
