// In-memory stand-in for the Drizzle `db` export, for unit tests that
// exercise DB-backed helpers without Postgres. Every query chain
// (db.select().from()...where().limit()) is recorded and, when awaited,
// resolves to the next queued result in call order. Queue an Error to make
// that query reject.
//
//   vi.mock("@/db", async () => {
//     const { fakeDb } = await import("@/test/fake-db");
//     return { db: fakeDb.db, schema: await import("@/db/schema") };
//   });

export type FakeCall = { method: string; args: unknown[] };

function createFakeDb() {
  const results: unknown[] = [];
  const queries: FakeCall[][] = [];

  function chain(log: FakeCall[]): unknown {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            const next = results.length > 0 ? results.shift() : [];
            const settled = next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
            return settled.then.bind(settled);
          }
          return (...args: unknown[]) => {
            log.push({ method: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const db = new Proxy(
    {},
    {
      get(_target, prop) {
        return (...args: unknown[]) => {
          const log: FakeCall[] = [{ method: String(prop), args }];
          queries.push(log);
          return chain(log);
        };
      },
    },
  );

  return {
    db,
    /** Results for the next awaited queries, in order. Unqueued queries resolve to []. */
    queue(...next: unknown[]) {
      results.push(...next);
    },
    /** Every query chain started so far, as method/argument lists. */
    queries,
    /** Method names of query `i`, e.g. ["insert", "values", "onConflictDoUpdate"]. */
    methods(i: number): string[] {
      return (queries[i] ?? []).map((c) => c.method);
    },
    /** First call of `method` in query `i`. */
    call(i: number, method: string): FakeCall | undefined {
      return queries[i]?.find((c) => c.method === method);
    },
    reset() {
      results.length = 0;
      queries.length = 0;
    },
  };
}

export const fakeDb = createFakeDb();
