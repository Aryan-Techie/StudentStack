import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { fakeDb } from "@/test/fake-db";
import { POST } from "./route";

vi.mock("@/db", async () => {
  const { fakeDb } = await import("@/test/fake-db");
  return { db: fakeDb.db, schema: await import("@/db/schema") };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const target = {
  id: 3,
  slug: "figma",
  name: "Figma",
  url: "https://figma.com/education",
  categoryId: 3,
  region: "Global",
  costType: "free",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

// The inserted report row (query 1 = insert after the lookup).
function insertedRow() {
  return fakeDb.call(1, "values")?.args[0] as Record<string, unknown>;
}

beforeEach(() => {
  fakeDb.reset();
  vi.clearAllMocks();
});

describe("POST /api/reports validation", () => {
  it("rejects a body that isn't JSON", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it.each([null, {}, { resourceId: 0 }, { resourceId: -2 }, { resourceId: 1.5 }, { resourceId: "abc" }])(
    "rejects body %j without a positive integer resource id",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid resource id" });
    },
  );

  it("rejects an unknown report kind", async () => {
    const res = await post({ resourceId: 3, kind: "spam" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/dead-link, offer-expired, wrong-info/);
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("404s when the resource doesn't exist", async () => {
    fakeDb.queue([]);
    const res = await post({ resourceId: 99, kind: "dead-link" });
    expect(res.status).toBe(404);
    expect(fakeDb.queries).toHaveLength(1);
  });
});

describe("POST /api/reports", () => {
  it("queues an unapproved report row for admin review", async () => {
    fakeDb.queue([target]);
    const res = await post({ resourceId: "3", kind: "offer-expired", note: "  Ended last month.  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = insertedRow();
    expect(row).toMatchObject({
      name: "Report: Offer expired — Figma",
      url: target.url,
      categoryId: 3,
      tags: ["report", "offer-expired"],
      approved: false,
      hasStaticClaimUrl: false,
      description: "Ended last month.\n\n[Reported for resource: figma]",
    });
    expect(row.slug).toMatch(/^report-figma-\d+$/);
    expect(row.tagline).toContain("(figma)");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("omits an empty or non-string note and caps long ones", async () => {
    fakeDb.queue([target]);
    await post({ resourceId: 3, kind: "dead-link", note: 42 });
    expect(insertedRow().description).toBe("[Reported for resource: figma]");

    fakeDb.reset();
    fakeDb.queue([target]);
    await post({ resourceId: 3, kind: "wrong-info", note: "x".repeat(800) });
    expect(insertedRow().description).toBe(`${"x".repeat(500)}\n\n[Reported for resource: figma]`);
  });

  it("keeps the report name within 80 characters", async () => {
    fakeDb.queue([{ ...target, name: "A".repeat(120) }]);
    await post({ resourceId: 3, kind: "dead-link" });
    expect((insertedRow().name as string).length).toBe(80);
  });
});
