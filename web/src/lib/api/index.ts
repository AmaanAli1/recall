/**
 * Typed API client. Screens import from here and never call fetch directly.
 *
 * NEXT_PUBLIC_USE_MOCK_API=true → every function resolves from ./mock.ts.
 * Otherwise → it calls the real backend. Flip it once the endpoints exist;
 * the function signatures (the contract) stay the same.
 */
import * as mock from "./mock";
import { chatGroup } from "../chat-group";
import { REAL_DOCUMENTS } from "../real-documents";
import type { Answer, ChatMessage, ChatRecord, ChatSummary, Course, DemoSession, DynoProgress, DynoRun } from "./types";

export * from "./types";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";

/**
 * Per-feature switch: "true" = demo sessions and the course list use the real
 * API (Next.js route handlers + Supabase), while documents, Ask, chats and
 * Dyno stay mocked until their phase ships. Off in CI, so e2e tests keep
 * running on the mock. Set in Vercel (Preview + Production).
 */
export const REAL_SESSIONS = process.env.NEXT_PUBLIC_REAL_SESSIONS === "true";
const MOCK_SESSIONS = USE_MOCK && !REAL_SESSIONS;

/**
 * Per-feature switch: "true" = saved chats (the Ask sidebar) use the real API.
 * Needs REAL_SESSIONS too: chats belong to a real session. Answers themselves
 * stay mocked until the RAG phase. Off in CI.
 */
export const REAL_CHATS = REAL_SESSIONS && process.env.NEXT_PUBLIC_REAL_CHATS === "true";
const MOCK_CHATS = USE_MOCK && !REAL_CHATS;

/**
 * Per-feature switch: "true" = Ask gets real answers from POST /api/ask (the
 * RAG service), and the server saves them into the chat. Needs REAL_CHATS
 * too: real answers are saved into real chats. Off in CI, so e2e tests keep
 * running on the mock. Set in Vercel (Preview first, then Production).
 */
export const REAL_ASK = REAL_CHATS && process.env.NEXT_PUBLIC_REAL_ASK === "true";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include", // the demo session lives in an httpOnly cookie
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.detail ?? body.error ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---------- Demo sessions ----------

/** POST /demo-sessions: create an anonymous session (sets the session cookie). */
export function createDemoSession(): Promise<DemoSession> {
  return MOCK_SESSIONS ? mock.createDemoSession() : http("/demo-sessions", { method: "POST" });
}

/** GET /demo-sessions/me: the current session, or null if there isn't one. */
export async function getDemoSession(): Promise<DemoSession | null> {
  if (MOCK_SESSIONS) return mock.getDemoSession();
  try {
    return await http<DemoSession>("/demo-sessions/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** DELETE /demo-sessions/me: delete the session and everything in it ("Start fresh"). */
export function endDemoSession(): Promise<void> {
  return MOCK_SESSIONS ? mock.endDemoSession() : http("/demo-sessions/me", { method: "DELETE" });
}

// ---------- Library ----------

export async function listCourses(): Promise<Course[]> {
  if (MOCK_SESSIONS) return mock.listCourses();
  const courses = await http<Course[]>("/courses");
  // Real courses, mocked documents (until visitor uploads)...
  const withDocs = USE_MOCK ? mock.withMockDocuments(courses) : courses;
  // ...except where answers are real: there, list what they really come from.
  if (!REAL_ASK) return withDocs;
  return withDocs.map((c) => {
    const real = REAL_DOCUMENTS[c.id];
    return real ? { ...c, documents: real } : c;
  });
}

// ---------- Ask ----------

/** POST /ask: answer a question from one course's documents, with citations. */
export function ask(courseId: string, question: string): Promise<Answer> {
  return USE_MOCK ? mock.ask(courseId, question) : http("/ask", { method: "POST", body: JSON.stringify({ courseId, question }) });
}

/** What POST /api/ask returns: the answer, and the chat it was saved into. */
export interface AskResult {
  answer: Answer;
  /** The chat the exchange was saved into; null if saving failed. */
  chat: ChatSummary | null;
  /** false = the answer is real but couldn't be saved (show a quiet note). */
  saved: boolean;
}

/**
 * POST /api/ask: a real, cited answer from the course's documents (RAG). The
 * SERVER saves the question and the answer: into `chatId`, or into a new chat
 * when it's null. The browser never sends an answer to store.
 */
export async function askAndSave(courseId: string, question: string, chatId: string | null): Promise<AskResult> {
  const r = await http<{ answer: Answer; chat: ChatRecord | null; saved: boolean }>("/ask", {
    method: "POST",
    body: JSON.stringify({ courseId, question, ...(chatId ? { chatId } : {}) }),
  });
  return { answer: r.answer, chat: r.chat ? toSummary(r.chat) : null, saved: r.saved };
}

/** A chat from the API, with its sidebar group worked out in the browser's timezone. */
function toSummary(c: ChatRecord): ChatSummary {
  return { id: c.id, courseId: c.courseId, title: c.title, pinned: c.pinned, updatedAt: c.updatedAt, group: chatGroup(c.updatedAt) };
}

/** GET /chats?courseId=…: saved chats for one course, pinned first, then newest. */
export async function listChats(courseId: string): Promise<ChatSummary[]> {
  if (MOCK_CHATS) return mock.listChats(courseId);
  const chats = await http<ChatRecord[]>(`/chats?courseId=${encodeURIComponent(courseId)}`);
  return chats.map(toSummary);
}

/**
 * POST /chats: save a new chat with its first question and answer.
 * Temporary: the browser sends the (mocked) answer. In the RAG phase the
 * server that writes the answer saves it, and `answer` leaves this call.
 */
export async function createChat(courseId: string, question: string, answer: Answer): Promise<ChatSummary> {
  if (MOCK_CHATS) return mock.createChat(courseId, question, answer);
  const chat = await http<ChatRecord>("/chats", { method: "POST", body: JSON.stringify({ courseId, question, answer }) });
  return toSummary(chat);
}

/** POST /chats/{id}/messages: a follow-up question and its answer, in an open chat. */
export async function addExchange(chatId: string, question: string, answer: Answer): Promise<void> {
  if (MOCK_CHATS) return mock.addExchange(chatId, question, answer);
  await http(`/chats/${chatId}/messages`, { method: "POST", body: JSON.stringify({ question, answer }) });
}

/** GET /chats/{id}/messages: everything in one chat, oldest first. */
export function listMessages(chatId: string): Promise<ChatMessage[]> {
  return MOCK_CHATS ? mock.listMessages(chatId) : http(`/chats/${chatId}/messages`);
}

/** PATCH /chats/{id}: rename. */
export function renameChat(id: string, title: string): Promise<void> {
  return MOCK_CHATS ? mock.renameChat(id, title) : http(`/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
}

/** PATCH /chats/{id}: pin to the top, or unpin. */
export function setChatPinned(id: string, pinned: boolean): Promise<void> {
  return MOCK_CHATS ? mock.setChatPinned(id, pinned) : http(`/chats/${id}`, { method: "PATCH", body: JSON.stringify({ pinned }) });
}

/**
 * DELETE /chats/{id}. Sent when the sidebar's Undo window closes, which can be
 * while the tab is closing: keepalive lets the request finish after the page
 * is gone (a normal fetch would be cancelled).
 */
export function deleteChat(id: string): Promise<void> {
  return MOCK_CHATS ? mock.deleteChat(id) : http(`/chats/${id}`, { method: "DELETE", keepalive: true });
}

// ---------- Dyno ----------

export function listDynoRuns(): Promise<DynoRun[]> {
  return USE_MOCK ? mock.listDynoRuns() : http("/dyno/runs");
}

/**
 * Start a Dyno run and report progress until it finishes.
 * Real backend: POST /dyno/runs, then Server-Sent Events from /dyno/runs/{id}/events.
 * Returns a cancel function.
 */
export function startDynoRun(
  onProgress: (p: DynoProgress) => void,
  onDone: (run: DynoRun) => void,
): () => void {
  if (USE_MOCK) return mock.startDynoRun(onProgress, onDone);
  let source: EventSource | null = null;
  let cancelled = false;
  http<{ id: string }>("/dyno/runs", { method: "POST" }).then(({ id }) => {
    if (cancelled) return;
    source = new EventSource(`${BASE}/dyno/runs/${id}/events`, { withCredentials: true });
    source.addEventListener("progress", (e) => onProgress(JSON.parse((e as MessageEvent).data)));
    source.addEventListener("done", (e) => {
      onDone(JSON.parse((e as MessageEvent).data));
      source?.close();
    });
  });
  return () => {
    cancelled = true;
    source?.close();
  };
}
