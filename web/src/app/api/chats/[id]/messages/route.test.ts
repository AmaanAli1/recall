import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-supabase";

/*
 * Unit tests for GET/POST /api/chats/[id]/messages, with the fake Supabase
 * client (src/test/fake-supabase.ts). RLS on messages is tested by pgTAP.
 */

vi.mock("@/lib/supabase/server", async () => {
  const { fakeClient } = await import("@/test/fake-supabase");
  return { createClient: async () => fakeClient() };
});

const { GET, POST } = await import("./route");

const CHAT = "11111111-1111-4111-8111-111111111111";
const answer = { claims: ["Use Bellman-Ford instead."] };
const rows = [
  { id: 7, role: "user", content: "And with negative edges?", answer: null, created_at: "2026-11-05T05:00:00+00:00" },
  { id: 8, role: "assistant", content: "Use Bellman-Ford instead.", answer, created_at: "2026-11-05T05:00:00+00:00" },
];

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id: string) => GET(new Request(`http://test/api/chats/${id}/messages`), ctx(id));
const post = (id: string, body: unknown) =>
  POST(new Request(`http://test/api/chats/${id}/messages`, { method: "POST", body: JSON.stringify(body) }), ctx(id));

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/chats/[id]/messages", () => {
  it("returns the messages in order, with the answer only on the assistant's", async () => {
    fake.results = [
      { data: { id: CHAT }, error: null }, // the chat is visible
      { data: rows, error: null }, // its messages
    ];
    const res = await get(CHAT);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 7, role: "user", content: "And with negative edges?", createdAt: "2026-11-05T05:00:00+00:00" },
      { id: 8, role: "assistant", content: "Use Bellman-Ford instead.", answer, createdAt: "2026-11-05T05:00:00+00:00" },
    ]);
    expect(fake.queries[1].calls).toContainEqual(["order", ["id", { ascending: true }]]);
  });

  it("returns 404 when the chat isn't visible (another visitor's or gone)", async () => {
    fake.results = [{ data: null, error: null }];
    const res = await get(CHAT);
    expect(res.status).toBe(404);
    expect(fake.queries).toHaveLength(1); // never asked for the messages
  });

  it("returns 404 for a malformed id and 401 without a session", async () => {
    expect((await get("nope")).status).toBe(404);
    fake.claims = null;
    expect((await get(CHAT)).status).toBe(401);
  });
});

describe("POST /api/chats/[id]/messages", () => {
  it("saves the question and answer in one insert and returns them", async () => {
    fake.results = [{ data: rows, error: null }];
    const res = await post(CHAT, { question: "And with negative edges?", answer });
    expect(res.status).toBe(201);
    expect(await res.json()).toHaveLength(2);
    expect(fake.queries[0].calls[0]).toEqual([
      "insert",
      [[
        { chat_id: CHAT, role: "user", content: "And with negative edges?" },
        { chat_id: CHAT, role: "assistant", content: "Use Bellman-Ford instead.", answer },
      ]],
    ]);
  });

  it("returns 404 (not 403) when RLS refuses: the chat isn't yours", async () => {
    fake.results = [{ data: null, error: { code: "42501", message: "new row violates row-level security policy" } }];
    const res = await post(CHAT, { question: "Hi", answer });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Chat not found." });
  });

  it("returns 409 with the database's message when the chat is full", async () => {
    fake.results = [{ data: null, error: { code: "23514", message: "This chat is full. Start a new chat." } }];
    const res = await post(CHAT, { question: "Hi", answer });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This chat is full. Start a new chat." });
  });

  it("returns 400 for a missing answer, before touching the database", async () => {
    expect((await post(CHAT, { question: "Hi" })).status).toBe(400);
    expect(fake.queries).toHaveLength(0);
  });
});