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

const routeModule = await import("./route");
const { GET } = routeModule;

const answer = { claims: ["Use Bellman-Ford instead."] };

const CHAT = "11111111-1111-4111-8111-111111111111";
const rows = [
  { id: 7, role: "user", content: "And with negative edges?", answer: null, created_at: "2026-11-05T05:00:00+00:00" },
  { id: 8, role: "assistant", content: "Use Bellman-Ford instead.", answer, created_at: "2026-11-05T05:00:00+00:00" },
];

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id: string) => GET(new Request(`http://test/api/chats/${id}/messages`), ctx(id));
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
  // Removed in the security pass (2026-11-27): follow-ups are saved by
  // POST /api/ask on the server, never from an answer the browser sends.
  it("no longer exists, so a browser can't save an answer of its own", () => {
    expect("POST" in routeModule).toBe(false);
  });
});
