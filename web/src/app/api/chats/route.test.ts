import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-supabase";

/*
 * Unit tests for GET/POST /api/chats, with the fake Supabase client from
 * src/test/fake-supabase.ts (it explains how FakeQuery works). The real
 * database rules (RLS, grants, limits) are tested by pgTAP in chats.test.sql.
 */

vi.mock("@/lib/supabase/server", async () => {
  const { fakeClient } = await import("@/test/fake-supabase");
  return { createClient: async () => fakeClient() };
});

// Import AFTER vi.mock, so the route gets the fake client.
const { GET, POST } = await import("./route");

const COURSE = "00000000-0000-0000-0000-00000000c001";
const CHAT = "11111111-1111-4111-8111-111111111111";
const chatRow = {
  id: CHAT,
  course_id: COURSE,
  title: "When does DP beat greedy?",
  pinned: false,
  updated_at: "2026-11-05T02:00:00+00:00",
};
const answer = { claims: ["When choices overlap."] };

const get = (query: string) => GET(new Request(`http://test/api/chats${query}`));
const post = (body: unknown) =>
  POST(new Request("http://test/api/chats", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

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
  it("returns 400 for a body that isn't JSON", async () => {
    expect((await post("not json")).status).toBe(400);
  });

  it("returns 400 for an empty question, before touching the database", async () => {
    const res = await post({ courseId: COURSE, question: "  ", answer });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "The question is empty." });
    expect(fake.queries).toHaveLength(0);
  });

  it("returns 401 without a session", async () => {
    fake.claims = null;
    expect((await post({ courseId: COURSE, question: "Hi", answer })).status).toBe(401);
  });

  it("creates the chat, titled from the question, and saves both messages", async () => {
    fake.results = [
      { data: chatRow, error: null }, // insert chat
      { data: null, error: null }, // insert messages
    ];
    const res = await post({ courseId: COURSE, question: "When does DP beat greedy?", answer });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe(CHAT);

    const [chats, messages] = fake.queries;
    expect(chats.calls[0]).toEqual(["insert", [{ course_id: COURSE, title: "When does DP beat greedy?" }]]);
    expect(messages.table).toBe("messages");
    expect(messages.calls[0]).toEqual([
      "insert",
      [[
        { chat_id: CHAT, role: "user", content: "When does DP beat greedy?" },
        { chat_id: CHAT, role: "assistant", content: "When choices overlap.", answer },
      ]],
    ]);
  });

  it("returns 403 when RLS refuses the course (not yours, not a sample)", async () => {
    fake.results = [{ data: null, error: { code: "42501", message: "new row violates row-level security policy" } }];
    const res = await post({ courseId: COURSE, question: "Hi", answer });
    expect(res.status).toBe(403);
  });

  it("returns 409 with the database's message at the chat limit", async () => {
    fake.results = [{ data: null, error: { code: "23514", message: "A demo can hold 100 chats." } }];
    const res = await post({ courseId: COURSE, question: "Hi", answer });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "A demo can hold 100 chats." });
  });

  it("deletes the new chat again if saving the messages fails", async () => {
    fake.results = [
      { data: chatRow, error: null }, // insert chat: ok
      { data: null, error: { code: "XX000", message: "boom" } }, // insert messages: fails
      { data: null, error: null }, // delete chat
    ];
    const res = await post({ courseId: COURSE, question: "Hi", answer });
    expect(res.status).toBe(500);
    const undo = fake.queries[2];
    expect(undo.table).toBe("chats");
    expect(undo.calls).toEqual([["delete", []], ["eq", ["id", CHAT]]]);
  });
});