import { describe, it, expect } from "vitest";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Every table must have row-level security on (issue #42). The app reads
// and writes as the table owner, which bypasses RLS; with RLS on and no
// policies, the tables stay unreachable through Supabase's Data API with
// the public (publishable) key. A table without it is open to anyone.
describe("schema RLS", () => {
  const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));

  it("finds the tables", () => {
    expect(tables.length).toBeGreaterThanOrEqual(8);
  });

  it.each(tables.map((t) => [getTableConfig(t).name, t] as const))("%s has RLS enabled", (_name, table) => {
    expect(getTableConfig(table).enableRLS).toBe(true);
  });
});
