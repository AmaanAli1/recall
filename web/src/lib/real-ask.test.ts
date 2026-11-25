/**
 * The browser side of real answers: the REAL_ASK flag, askAndSave() and the
 * real documents Library shows. The flags are read when the module loads, so
 * each test sets env vars first and then imports a fresh copy.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { askErrorText, SESSION_ENDED } from "./ask-errors";
import { SAMPLE_COURSE_IDS } from "./sample-courses";

// client() re-imports the whole API client after vi.resetModules(). On a cold,
// slow machine (antivirus scanning each file) a test with several of those can
// pass the 5 s default, so this file gets 20 s. It changes nothing when fast.
vi.setConfig({ testTimeout: 20_000 });

const ALGO = SAMPLE_COURSE_IDS.algorithms;
const MATH = SAMPLE_COURSE_IDS.everydayMath;

/** A fresh copy of the API client with these flags. */
async function client(flags: { sessions?: boolean; chats?: boolean; ask?: boolean }) {
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "true");
  vi.stubEnv("NEXT_PUBLIC_REAL_SESSIONS", String(!!flags.sessions));
  vi.stubEnv("NEXT_PUBLIC_REAL_CHATS", String(!!flags.chats));
  vi.stubEnv("NEXT_PUBLIC_REAL_ASK", String(!!flags.ask));
  vi.resetModules();
  return import("./api");
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("REAL_ASK", () => {
  it("is on only when sessions, chats and ask are all real", async () => {
    expect((await client({ sessions: true, chats: true, ask: true })).REAL_ASK).toBe(true);
    // Real answers are saved into real chats, so it needs both below it.
    expect((await client({ sessions: true, chats: false, ask: true })).REAL_ASK).toBe(false);
    expect((await client({ sessions: false, chats: true, ask: true })).REAL_ASK).toBe(false);
    expect((await client({ sessions: true, chats: true, ask: false })).REAL_ASK).toBe(false);
  });
});

describe("askAndSave", () => {
  it("posts the question (no chatId for a new chat) and returns the answer and saved chat", async () => {
    const fetch = vi.fn().mockResolvedValue(
      reply(201, {
        answer: { question: "Q?", claims: ["c"] },
        chat: { id: "c1", courseId: ALGO, title: "Q?", pinned: false, updatedAt: new Date().toISOString() },
        saved: true,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const { askAndSave } = await client({ sessions: true, chats: true, ask: true });

    const r = await askAndSave(ALGO, "Q?", null);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/ask");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ courseId: ALGO, question: "Q?" }); // no answer sent, no chatId
    expect(r.saved).toBe(true);
    expect(r.chat).toMatchObject({ id: "c1", title: "Q?", group: "Today" }); // grouped for the sidebar
  });

  it("sends the chatId for a follow-up, and passes chat: null through", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, { answer: { question: "Q2?" }, chat: null, saved: false }));
    vi.stubGlobal("fetch", fetch);
    const { askAndSave } = await client({ sessions: true, chats: true, ask: true });

    const r = await askAndSave(ALGO, "Q2?", "c1");

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ courseId: ALGO, question: "Q2?", chatId: "c1" });
    expect(r).toMatchObject({ chat: null, saved: false });
  });

  it("throws ApiError with the server's message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(429, { error: "Too many questions in a minute. Wait a moment and try again." })));
    const api = await client({ sessions: true, chats: true, ask: true });

    const err = await api.askAndSave(ALGO, "Q?", null).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(api.ApiError);
    expect(err).toMatchObject({ status: 429, message: "Too many questions in a minute. Wait a moment and try again." });
  });
});

describe("listCourses with real answers", () => {
  const realCourses = [
    { id: ALGO, name: "Algorithms", color: "blue", sample: true, documents: [] },
    { id: MATH, name: "Everyday Math", color: "green", sample: true, documents: [] },
  ];

  it("lists the four real Erickson chapters for Algorithms, and leaves other courses alone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, realCourses)));
    const { listCourses } = await client({ sessions: true, chats: true, ask: true });

    const [algo, math] = await listCourses();

    expect(algo.documents.map((d) => d.name)).toEqual([
      "Erickson_Ch1_Recursion.pdf",
      "Erickson_Ch3_DynamicProgramming.pdf",
      "Erickson_Ch4_GreedyAlgorithms.pdf",
      "Erickson_Ch8_ShortestPaths.pdf",
    ]);
    // The chunk counts the ingest loaded (build log, PR #33).
    expect(algo.documents.reduce((n, d) => n + (d.passages ?? 0), 0)).toBe(327);
    // Each chapter links to the author's own PDF ("Open the original PDF").
    expect(algo.documents.every((d) => d.sourceUrl?.startsWith("https://jeffe.cs.illinois.edu/teaching/algorithms/book/"))).toBe(true);
    expect(math.documents).toEqual([]); // no real PDFs yet: still the mock's (empty) list
  });

  it("keeps a real chapter hidden after it's deleted in this tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, realCourses)));
    const api = await client({ sessions: true, chats: true, ask: true });

    await api.deleteDocument(ALGO, "erickson-8");
    const [algo] = await api.listCourses();

    expect(algo.documents.map((d) => d.id)).toEqual(["erickson-1", "erickson-3", "erickson-4"]);
  });

  it("mock mode lists the same Erickson chapters as the real site (local matches the Preview)", async () => {
    const { listCourses } = await client({});
    const algo = (await listCourses()).find((c) => c.id === ALGO);

    expect(algo?.documents.map((d) => d.name)).toEqual([
      "Erickson_Ch1_Recursion.pdf",
      "Erickson_Ch3_DynamicProgramming.pdf",
      "Erickson_Ch4_GreedyAlgorithms.pdf",
      "Erickson_Ch8_ShortestPaths.pdf",
    ]);
    expect(algo?.documents.every((d) => d.status === "ready" && d.sourceUrl)).toBe(true);
  });
});

describe("askErrorText", () => {
  it("shows the server's visitor-facing reasons as they are", () => {
    for (const status of [400, 429, 502, 503, 504]) {
      expect(askErrorText(new ApiError(status, `reason ${status}`))).toBe(`reason ${status}`);
    }
  });

  it("gives every 401 the same plain wording", () => {
    for (const m of ["No demo session.", "Unauthorized.", "Your demo session has expired. Start a new one."]) {
      expect(askErrorText(new ApiError(401, m))).toBe(SESSION_ENDED);
    }
  });

  it("falls back to the generic line for anything else", () => {
    expect(askErrorText(new ApiError(404, "Chat not found."))).toBeNull();
    expect(askErrorText(new ApiError(500, "Couldn't load this chat."))).toBeNull();
    expect(askErrorText(new TypeError("Failed to fetch"))).toBeNull();
  });
});
