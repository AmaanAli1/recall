import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "@/test/fake-supabase";

/*
 * Unit tests for POST /api/ask, with the fake Supabase client (see
 * src/test/fake-supabase.ts) and a fake fetch() standing in for FastAPI.
 * Nothing here touches the network or a database.
 */

vi.mock("@/lib/supabase/server", async () => {
  const { fakeClient } = await import("@/test/fake-supabase");
  return { createClient: async () => fakeClient() };
});

const { POST } = await import("./route");

const COURSE = "00000000-0000-0000-0000-00000000c001";
const CHAT = "11111111-1111-4111-8111-111111111111";
const chatRow = { id: CHAT, course_id: COURSE, title: "Why does Dijkstra fail?", pinned: false, updated_at: "2026-11-21T22:00:00+00:00" };
const chatRecord = { id: CHAT, courseId: COURSE, title: "Why does Dijkstra fail?", pinned: false, updatedAt: "2026-11-21T22:00:00+00:00" };
const answer = {
  question: "Why does Dijkstra fail?",
  courseId: COURSE,
  claims: ["Vertices can be extracted more than once", "Distances stop increasing"],
  sources: [],
  dropped: [],
  timing: { embed: 0.2, search: 0.1, rerank: 0, generate: 2 },
  followUps: [],
};
const notFound = { ...answer, claims: [], notFound: true };

/** A fake FastAPI: returns `reply` and records every call. */
function answerService(reply: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return reply();
  });
  return calls;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ok = (a: unknown = answer) => json(200, { answer: a, usage: { tokens: 2300 } });

const post = (body: unknown) =>
  POST(new Request("http://test/api/ask", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  fake.reset();
  vi.stubEnv("FASTAPI_URL", "https://fn.lambda-url.us-east-1.on.aws/");
  vi.stubEnv("FASTAPI_INTERNAL_KEY", "internal-test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/ask: who and what", () => {
  it.each([
    ["not JSON", "nope"],
    ["no course", { question: "Hi?" }],
    ["bad course id", { courseId: "os", question: "Hi?" }],
    ["blank question", { courseId: COURSE, question: "   " }],
    ["too long", { courseId: COURSE, question: "x".repeat(2001) }],
    ["bad chat id", { courseId: COURSE, question: "Hi?", chatId: "123" }],
  ])("400 for %s, before any work", async (_name, body) => {
    const calls = answerService(() => ok());
    expect((await post(body)).status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(fake.queries).toHaveLength(0);
  });

  it("401 without a session, and FastAPI is never called", async () => {
    fake.claims = null;
    const calls = answerService(() => ok());
    expect((await post({ courseId: COURSE, question: "Hi?" })).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("401 if the session has no access token", async () => {
    fake.accessToken = null;
    const calls = answerService(() => ok());
    expect((await post({ courseId: COURSE, question: "Hi?" })).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("503 with a clear message if the answer service isn't configured", async () => {
    vi.stubEnv("FASTAPI_URL", "");
    const res = await post({ courseId: COURSE, question: "Hi?" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Answers aren't set up here yet." });
  });
});

describe("POST /api/ask: calling FastAPI", () => {
  it("sends the internal key, the visitor's token and only course + question", async () => {
    const calls = answerService(() => ok());
    fake.results = [{ data: chatRow, error: null }, { data: null, error: null }];
    // A browser trying to supply its own answer: it must be ignored.
    await post({ courseId: COURSE, question: "  Why does Dijkstra fail?  ", answer: { claims: ["fake"] } });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://fn.lambda-url.us-east-1.on.aws/v1/answer"); // one slash
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["X-Recall-Internal"]).toBe("internal-test-key");
    expect(headers.Authorization).toBe("Bearer visitor-token");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ courseId: COURSE, question: "Why does Dijkstra fail?" });
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal); // there is a timeout
  });

  it.each([
    [401, "Your demo session has expired. Start a new one."],
    [429, "This demo session has used its token budget."],
    [503, "The demo has reached its monthly AI budget. Please try again next month."],
  ])("passes FastAPI's %i and its visitor-safe message through", async (status, detail) => {
    answerService(() => json(status, { detail }));
    const res = await post({ courseId: COURSE, question: "Hi?" });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: detail });
    expect(fake.queries).toHaveLength(0); // nothing saved
  });

  it.each([500, 502, 422])("hides FastAPI's %i behind a generic 502", async (status) => {
    answerService(() => json(status, { detail: "Traceback… secret stuff" }));
    const res = await post({ courseId: COURSE, question: "Hi?" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/having trouble/);
  });

  it("504 when the answer takes too long", async () => {
    answerService(() => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    });
    expect((await post({ courseId: COURSE, question: "Hi?" })).status).toBe(504);
  });

  it("502 when FastAPI can't be reached at all", async () => {
    answerService(() => {
      throw new TypeError("fetch failed");
    });
    expect((await post({ courseId: COURSE, question: "Hi?" })).status).toBe(502);
  });
});

describe("POST /api/ask: saving", () => {
  it("starts a new chat with the question and the server's answer", async () => {
    answerService(() => ok());
    fake.results = [{ data: chatRow, error: null }, { data: null, error: null }];
    const res = await post({ courseId: COURSE, question: "Why does Dijkstra fail?" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ answer, chat: chatRecord, saved: true });
    const [chatInsert, messageInsert] = fake.queries;
    expect(chatInsert.table).toBe("chats");
    expect(chatInsert.calls).toContainEqual(["insert", [{ course_id: COURSE, title: "Why does Dijkstra fail?" }]]);
    expect(messageInsert.table).toBe("messages");
    expect(messageInsert.calls).toContainEqual([
      "insert",
      [
        [
          { chat_id: CHAT, role: "user", content: "Why does Dijkstra fail?" },
          { chat_id: CHAT, role: "assistant", content: "Vertices can be extracted more than once Distances stop increasing", answer },
        ],
      ],
    ]);
  });

  it("saves a not-found answer with the not-found line as its text", async () => {
    answerService(() => ok(notFound));
    fake.results = [{ data: chatRow, error: null }, { data: null, error: null }];
    const res = await post({ courseId: COURSE, question: "Capital of France?" });
    expect((await res.json()).answer.notFound).toBe(true);
    const saved = fake.queries[1].calls.find(([name]) => name === "insert")?.[1][0] as { content: string }[];
    expect(saved[1].content).toBe("I couldn't find this in this course's documents.");
  });

  it("a follow-up goes into the visitor's own chat", async () => {
    answerService(() => ok());
    fake.results = [{ data: chatRow, error: null }, { data: null, error: null }];
    const res = await post({ courseId: COURSE, question: "And with negative cycles?", chatId: CHAT });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer, chat: chatRecord, saved: true });
    expect(fake.queries[0].calls).toContainEqual(["eq", ["id", CHAT]]);
    expect(fake.queries[1].table).toBe("messages");
    expect(fake.queries).toHaveLength(2); // no new chat
  });

  it("someone else's chat is a 404, checked BEFORE paying for an answer", async () => {
    const calls = answerService(() => ok());
    fake.results = [{ data: null, error: null }]; // RLS: not visible
    expect((await post({ courseId: COURSE, question: "Hi?", chatId: CHAT })).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("if the messages can't be saved, the empty chat is removed and the answer still returned", async () => {
    answerService(() => ok());
    fake.results = [
      { data: chatRow, error: null },
      { error: { code: "23514", message: "A demo can hold 100 chats." } },
      { data: null, error: null },
    ];
    const res = await post({ courseId: COURSE, question: "Hi?" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer, chat: null, saved: false });
    expect(fake.queries[2].table).toBe("chats");
    expect(fake.queries[2].calls).toContainEqual(["delete", []]);
    expect(fake.queries[2].calls).toContainEqual(["eq", ["id", CHAT]]);
  });

  it("if the chat itself can't be created, the answer is still returned", async () => {
    answerService(() => ok());
    fake.results = [{ data: null, error: { code: "23514", message: "A demo can hold 100 chats." } }];
    const res = await post({ courseId: COURSE, question: "Hi?" });
    expect(await res.json()).toEqual({ answer, chat: null, saved: false });
    expect(fake.queries).toHaveLength(1);
  });

  it("a follow-up that can't be saved still returns the answer", async () => {
    answerService(() => ok());
    fake.results = [{ data: chatRow, error: null }, { error: { code: "23514", message: "This chat is full. Start a new chat." } }];
    const res = await post({ courseId: COURSE, question: "Hi?", chatId: CHAT });
    expect(await res.json()).toEqual({ answer, chat: chatRecord, saved: false });
  });
});
