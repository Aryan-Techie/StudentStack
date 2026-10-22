import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";
import { POST } from "./route";

vi.mock("@/db", async () => {
  const { fakeDb } = await import("@/test/fake-db");
  return { db: fakeDb.db, schema: await import("@/db/schema") };
});

function click(id: string) {
  return POST(new Request(`http://localhost/api/resources/${id}/click`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => fakeDb.reset());

describe("POST /api/resources/[id]/click", () => {
  it.each(["0", "-1", "1.5", "abc", ""])("rejects id %j without touching the database", async (id) => {
    const res = await click(id);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid resource id" });
    expect(fakeDb.queries).toHaveLength(0);
  });

  it("records the click event and bumps the resource's counter", async () => {
    const res = await click("12");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fakeDb.methods(0)).toEqual(["insert", "values"]);
    expect(fakeDb.call(0, "values")?.args[0]).toEqual({ resourceId: 12 });
    expect(fakeDb.methods(1)).toEqual(["update", "set", "where"]);
  });
});
