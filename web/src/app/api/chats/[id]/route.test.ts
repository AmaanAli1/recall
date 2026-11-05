import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-supabase";

/*
 * Unit tests for PATCH/DELETE /api/chats/[id], with the fake Supabase
 * client (src/test/fake-supabase.ts). RLS and the column grant itself are
 * tested by pgTAP in chats.test.sql.
 */

vi.mock("@/lib/supabase/server", async () => {
  const { fakeClient } = await import("@/test/fake-supabase");
  return { createClient: async () => fakeClient() };
});

const { PATCH, DELETE } = await import("./route");

const CHAT = "11111111-1111-4111-8111-111111111111";

// The second argument is what Next.js passes: params as a Promise.
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) =>
  PATCH(new Request(`http://test/api/chats/${id}`, { method: "PATCH", body: JSON.stringify(body) }), ctx(id));
const del = (id: string) => DELETE(new Request(`http://test/api/chats/${id}`, { method: "DELETE" }), ctx(id));

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PATCH /api/chats/[id]", () => {
  it("renames a chat with the cleaned title and only that field", async () => {
    fake.results = [{ data: [{ id: CHAT }], error: null }];
    const res = await patch(CHAT, { title: "  Exam  prep ", session_id: "someone-else" });
    expect(res.status).toBe(204);
    const q = fake.queries[0];
    expect(q.table).toBe("chats");
    expect(q.calls[0]).toEqual(["update", [{ title: "Exam prep" }]]);
    expect(q.calls).toContainEqual(["eq", ["id", CHAT]]);
  });

  it("pins a chat", async () => {
    fake.results = [{ data: [{ id: CHAT }], error: null }];
    expect((await patch(CHAT, { pinned: true })).status).toBe(204);
    expect(fake.queries[0].calls[0]).toEqual(["update", [{ pinned: true }]]);
  });

  it("returns 404 when no row changed (missing, or another visitor's chat)", async () => {
    fake.results = [{ data: [], error: null }];
    const res = await patch(CHAT, { pinned: true });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Chat not found." });
  });

  it("returns 400 for an empty title, and 404 for a malformed id, without touching the database", async () => {
    expect((await patch(CHAT, { title: "   " })).status).toBe(400);
    expect((await patch("not-a-uuid", { pinned: true })).status).toBe(404);
    expect(fake.queries).toHaveLength(0);
  });

  it("returns 401 without a session", async () => {
    fake.claims = null;
    expect((await patch(CHAT, { pinned: true })).status).toBe(401);
  });
});

describe("DELETE /api/chats/[id]", () => {
  it("deletes the chat", async () => {
    fake.results = [{ data: null, error: null }];
    const res = await del(CHAT);
    expect(res.status).toBe(204);
    expect(fake.queries[0].calls).toEqual([["delete", []], ["eq", ["id", CHAT]]]);
  });

  it("is idempotent: a malformed id is a harmless 204 with no database call", async () => {
    expect((await del("not-a-uuid")).status).toBe(204);
    expect(fake.queries).toHaveLength(0);
  });

  it("returns 500 with a short message when the database fails", async () => {
    fake.results = [{ data: null, error: { code: "XX000", message: "boom" } }];
    const res = await del(CHAT);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Couldn't delete this chat." });
  });
});