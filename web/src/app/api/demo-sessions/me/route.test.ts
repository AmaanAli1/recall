import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Unit tests for GET/DELETE /api/demo-sessions/me.
 *
 * We don't call real Supabase here. vi.mock swaps createClient() for a fake
 * client, so each test controls exactly what "Supabase" answers and we can
 * check how the route reacts. (The real database rules are tested by pgTAP.)
 */

const fake = {
  claims: null as null | { sub: string },
  row: null as null | Record<string, string>,
  rpc: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: fake.claims ? { claims: fake.claims } : null,
        error: null,
      }),
      signOut: fake.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: fake.row, error: null }),
        }),
      }),
    }),
    rpc: fake.rpc,
  }),
}));

// Import AFTER vi.mock, so the route gets the fake client.
const { GET, DELETE } = await import("./route");

beforeEach(() => {
  fake.claims = null;
  fake.row = null;
  fake.rpc.mockReset().mockResolvedValue({ error: null });
  fake.signOut.mockReset().mockResolvedValue({ error: null });
});

describe("GET /api/demo-sessions/me", () => {
  it("returns 401 when there's no session cookie", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when the session row was already deleted", async () => {
    fake.claims = { sub: "user-1" };
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the session with the demo code as its id", async () => {
    fake.claims = { sub: "user-1" };
    fake.row = {
      code: "demo-UFB5-LR",
      created_at: "2026-11-03T05:00:00+00:00",
      last_active_at: "2026-11-03T05:10:00+00:00",
    };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "demo-UFB5-LR",
      createdAt: "2026-11-03T05:00:00+00:00",
      lastActiveAt: "2026-11-03T05:10:00+00:00",
    });
  });
});

describe("DELETE /api/demo-sessions/me", () => {
  it("ends the session, then signs out", async () => {
    fake.claims = { sub: "user-1" };
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(fake.rpc).toHaveBeenCalledWith("end_session");
    expect(fake.signOut).toHaveBeenCalled();
  });

  it("is a harmless no-op without a session", async () => {
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("returns 500 and keeps the cookies if the database call fails", async () => {
    fake.claims = { sub: "user-1" };
    fake.rpc.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await DELETE();
    expect(res.status).toBe(500);
    expect(fake.signOut).not.toHaveBeenCalled();
  });
});