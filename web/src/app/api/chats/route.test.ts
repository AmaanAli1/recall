import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-supabase";

/*
 * Unit tests for GET /api/chats (POST was removed: see below), with the fake Supabase client from
 * src/test/fake-supabase.ts (it explains how FakeQuery works). The real
 * database rules (RLS, grants, limits) are tested by pgTAP in chats.test.sql.
 */

vi.mock("@/lib/supabase/server", async () => {
  const { fakeClient } = await import("@/test/fake-supabase");
  return { createClient: async () => fakeClient() };
});

// Import AFTER vi.mock, so the route gets the fake client.
const routeModule = await import("./route");
const { GET } = routeModule;

const COURSE = "00000000-0000-0000-0000-00000000c001";
const CHAT = "11111111-1111-4111-8111-111111111111";
const chatRow = {
  id: CHAT,
  course_id: COURSE,
  title: "When does DP beat greedy?",
  pinned: false,
  updated_at: "2026-11-05T02:00:00+00:00",
};

const get = (query: string) => GET(new Request(`http://test/api/chats${query}`));
beforeEach(() => {
    fake.reset();
  // apiError logs the real error; keep the test output quiet.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/chats", () => {
  it("returns 400 for a missing or malformed course id", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("?courseId=os")).status).toBe(400);
    expect(fake.queries).toHaveLength(0); // never reached the database
  });

  it("returns 401 without a session", async () => {
    fake.claims = null;
    expect((await get(`?courseId=${COURSE}`)).status).toBe(401);
  });

  it("returns the course's chats, pinned first, as ChatRecords", async () => {
    fake.results = [{ data: [chatRow], error: null }];
    const res = await get(`?courseId=${COURSE}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: CHAT, courseId: COURSE, title: "When does DP beat greedy?", pinned: false, updatedAt: "2026-11-05T02:00:00+00:00" },
    ]);
    const q = fake.queries[0];
    expect(q.table).toBe("chats");
    expect(q.calls).toContainEqual(["eq", ["course_id", COURSE]]);
    expect(q.calls).toContainEqual(["order", ["pinned", { ascending: false }]]);
  });

  it("returns 500 with a short message when the database fails", async () => {
    fake.results = [{ data: null, error: { code: "XX000", message: "boom" } }];
    const res = await get(`?courseId=${COURSE}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Couldn't load your chats." });
  });
});

describe("POST /api/chats", () => {
  // Removed in the security pass (2026-11-27): it saved an answer sent by the
  // browser. Real answers are saved by POST /api/ask on the server. With no
  // POST export, Next.js answers a POST with 405 Method Not Allowed.
  it("no longer exists, so a browser can't save an answer of its own", () => {
    expect("POST" in routeModule).toBe(false);
  });
});
