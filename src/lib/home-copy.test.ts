import { describe, expect, it } from "vitest";
import { heroLede } from "./home-copy";

describe("heroLede", () => {
  it("names every live cost type with proper list grammar", () => {
    const lede = heroLede({ free: 10, credits: 5, discount: 3 });
    expect(lede.startsWith("Free software, cloud credits and discounts,")).toBe(true);
  });

  it("omits cost types with zero live rows (issue #77)", () => {
    const lede = heroLede({ free: 10, credits: 5, scholarship: 0, stipend: 0, discount: 3 });
    expect(lede).not.toContain("scholarship");
    expect(lede).not.toContain("stipend");
    expect(lede.startsWith("Free software, cloud credits and discounts,")).toBe(true);
  });

  it("includes scholarships and stipends once Phase 1 data lands", () => {
    const lede = heroLede({ free: 10, credits: 5, scholarship: 2, stipend: 1, discount: 3 });
    expect(
      lede.startsWith("Free software, cloud credits, scholarships, stipends and discounts,"),
    ).toBe(true);
  });

  it("handles a single live cost type", () => {
    const lede = heroLede({ free: 10 });
    expect(lede.startsWith("Free software,")).toBe(true);
  });

  it("falls back gracefully when nothing is live", () => {
    const lede = heroLede({});
    expect(lede.startsWith("Student offers,")).toBe(true);
  });
});
