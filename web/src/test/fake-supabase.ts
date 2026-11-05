/*
 * A fake Supabase client for route-handler unit tests.
 *
 * Route handlers chain query calls: from("chats").select(…).eq(…).order(…).
 * FakeQuery records every call, returns itself so the chain keeps going,
 * and when the route awaits it, hands back the next result from
 * fake.results (first in, first out). Tests then check fake.queries to
 * see exactly what the route asked the database for.
 *
 * Used like this (vi.mock is hoisted above imports, so the fake is
 * imported inside the factory):
 *
 *   vi.mock("@/lib/supabase/server", async () => {
 *     const { fakeClient } = await import("@/test/fake-supabase");
 *     return { createClient: async () => fakeClient() };
 *   });
 *
 * Not a test file itself (no .test.ts), so Vitest doesn't run it.
 */

export type FakeResult = { data?: unknown; error?: { code?: string; message?: string } | null };

export const fake = {
  /** The signed-in visitor, or null for "no session cookie". */
  claims: null as null | { sub: string },
  /** What each awaited query returns, in order. */
  results: [] as FakeResult[],
  /** Every query the route started, in order. */
  queries: [] as FakeQuery[],
  /** Start each test from a clean state (call it in beforeEach). */
  reset() {
    this.claims = { sub: "user-1" };
    this.results = [];
    this.queries = [];
  },
};

export class FakeQuery {
  calls: [string, unknown[]][] = [];
  constructor(public table: string) {}

  private record(name: string, args: unknown[]) {
    this.calls.push([name, args]);
    return this;
  }
  select(...a: unknown[]) { return this.record("select", a); }
  insert(...a: unknown[]) { return this.record("insert", a); }
  update(...a: unknown[]) { return this.record("update", a); }
  delete(...a: unknown[]) { return this.record("delete", a); }
  eq(...a: unknown[]) { return this.record("eq", a); }
  order(...a: unknown[]) { return this.record("order", a); }
  limit(...a: unknown[]) { return this.record("limit", a); }
  single(...a: unknown[]) { return this.record("single", a); }
  maybeSingle(...a: unknown[]) { return this.record("maybeSingle", a); }

  // "await query" calls then(). Having a then() method makes FakeQuery
  // awaitable, just like the real query builder.
  then(resolve: (r: FakeResult) => unknown, reject?: (e: unknown) => unknown) {
    const result = fake.results.shift() ?? { data: null, error: null };
    return Promise.resolve(result).then(resolve, reject);
  }
}

/** What createClient() returns in tests: only the parts our routes use. */
export function fakeClient() {
  return {
    auth: {
      getClaims: async () => ({ data: fake.claims ? { claims: fake.claims } : null, error: null }),
    },
    from: (table: string) => {
      const q = new FakeQuery(table);
      fake.queries.push(q);
      return q;
    },
  };
}