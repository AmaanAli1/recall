/**
 * In-browser mock of the backend. Same signatures as the real client, with
 * small realistic delays so loading states get exercised.
 * The demo session is kept in localStorage here; the real one is an httpOnly cookie.
 */
import { ANSWERS, CHATS, COURSE_STARTERS, COURSES, DYNO_RUNS, NEXT_RUN } from "./mock-data";
import type { Answer, ChatMessage, ChatSummary, Course, DemoSession, DynoProgress, DynoRun } from "./types";

const SESSION_KEY = "recall-demo";

/** Trim and collapse whitespace (chat titles), like the real API. */
const oneLine = (raw: string) => raw.trim().replace(/\s+/g, " ");
const DAY_MS = 24 * 60 * 60 * 1000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // private mode / blocked storage
  }
}

function randomCode(n: number) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I lookalikes
  let s = "";
  for (let i = 0; i < n; i++) s += A.charAt(Math.floor(Math.random() * A.length));
  return s;
}

// ---------- sessions ----------

export async function createDemoSession(): Promise<DemoSession> {
  const now = new Date().toISOString();
  const s: DemoSession = { id: `demo-${randomCode(4)}-${randomCode(2)}`, createdAt: now, lastActiveAt: now };
  storage()?.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}

export async function getDemoSession(): Promise<DemoSession | null> {
  const raw = storage()?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as DemoSession;
    if (Date.now() - new Date(s.lastActiveAt).getTime() > DAY_MS) {
      storage()?.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function endDemoSession(): Promise<void> {
  storage()?.removeItem(SESSION_KEY);
}

// ---------- library ----------

/** The demo's course(s): read-only since 2026-11-25 (Algorithms only, no uploads). */
const courses: Course[] = clone(COURSES);

export async function listCourses(): Promise<Course[]> {
  await wait(120);
  return clone(courses);
}

/**
 * Real courses (from the API) + the mock's documents. Documents stay mocked
 * until the RAG phase. Matching by course id works because the mock's sample
 * courses use the same fixed ids as the database (lib/sample-courses.ts).
 */
export function withMockDocuments(real: Course[]): Course[] {
  return real.map((c) => {
    const documents = courses.find((x) => x.id === c.id)?.documents ?? [];
    return { ...c, documents: clone(documents) };
  });
}

// ---------- ask ----------

export async function ask(courseId: string, question: string): Promise<Answer> {
  await wait(450);
  // Canned answers exist for each course's starter questions; anything else in
  // that course gets its first starter's answer (the real backend answers anything).
  const all = Object.values(COURSE_STARTERS).flat();
  const starter = all.find((s) => s.question === question || s.id === question) ?? COURSE_STARTERS[courseId]?.[0];
  if (!starter) throw new Error("This course has no documents yet.");
  return clone(ANSWERS[starter.id]);
}

const deletedChats = new Set<string>();
const chatEdits: Record<string, Partial<Pick<ChatSummary, "title" | "pinned">>> = {};

/** Chats saved during this page visit (newest first) and their messages. */
const createdChats: ChatSummary[] = [];
const chatMessages: Record<string, ChatMessage[]> = {};
let messageSeq = 0;

export async function listChats(courseId: string): Promise<ChatSummary[]> {
  // A chat with a new message moves to the top, like the real API (touch_chat).
  return [...createdChats, ...CHATS]
    .filter((c) => c.courseId === courseId && !deletedChats.has(c.id))
    .map((c) => ({ ...c, ...chatEdits[c.id] }));
}

function exchange(question: string, answer: Answer): ChatMessage[] {
  const createdAt = new Date().toISOString();
  return [
    { id: ++messageSeq, role: "user", content: question, createdAt },
    { id: ++messageSeq, role: "assistant", content: answer.claims.join(" "), answer: clone(answer), createdAt },
  ];
}

export async function createChat(courseId: string, question: string, answer: Answer): Promise<ChatSummary> {
  await wait(120);
  const t = oneLine(question);
  const chat: ChatSummary = {
    id: `chat-${Date.now()}-${createdChats.length}`,
    courseId,
    title: t.length > 60 ? `${t.slice(0, 59)}…` : t || "New chat",
    group: "Today",
  };
  createdChats.unshift(chat);
  chatMessages[chat.id] = exchange(question, answer);
  return { ...chat };
}

export async function addExchange(chatId: string, question: string, answer: Answer): Promise<void> {
  await wait(80);
  chatMessages[chatId] = [...(chatMessages[chatId] ?? []), ...exchange(question, answer)];
  // Move it to the top, as the real API's updated_at ordering would.
  const i = createdChats.findIndex((c) => c.id === chatId);
  if (i > 0) createdChats.unshift(...createdChats.splice(i, 1));
}

export async function listMessages(chatId: string): Promise<ChatMessage[]> {
  await wait(150);
  if (chatMessages[chatId]) return clone(chatMessages[chatId]);
  // The sample chats have no stored messages: show the canned answer that
  // matches (they share ids with the starters), or the course's first one.
  const chat = CHATS.find((c) => c.id === chatId);
  if (!chat) throw new Error("Chat not found.");
  const starter = Object.values(COURSE_STARTERS).flat().find((s) => s.id === chatId) ?? COURSE_STARTERS[chat.courseId]?.[0];
  if (!starter) return [];
  return exchange(starter.question, { ...ANSWERS[starter.id], question: starter.question });
}

export async function renameChat(id: string, title: string): Promise<void> {
  const t = oneLine(title).slice(0, 80);
  if (!t) throw new Error("Give the chat a name.");
  chatEdits[id] = { ...chatEdits[id], title: t };
}

export async function setChatPinned(id: string, pinned: boolean): Promise<void> {
  chatEdits[id] = { ...chatEdits[id], pinned };
}

export async function deleteChat(id: string): Promise<void> {
  deletedChats.add(id);
}

// ---------- dyno ----------

/**
 * No real Dyno runs exist until launch, so the mock returns none and the page shows its
 * empty state. Tests (and design reviews) can opt into the sample runs with
 * localStorage "recall-fixtures" = "dyno", to exercise the full dashboard.
 */
function sampleDyno(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("recall-fixtures") === "dyno";
  } catch {
    return false;
  }
}

export async function listDynoRuns(): Promise<DynoRun[]> {
  await wait(80);
  return sampleDyno() ? clone(DYNO_RUNS) : [];
}

/** Simulates a full Dyno run in about 5 s (a real run takes a few minutes). */
export function startDynoRun(onProgress: (p: DynoProgress) => void, onDone: (run: DynoRun) => void): () => void {
  const total = 80;
  let done = 0;
  let gate: ReturnType<typeof setTimeout> | undefined;
  const stageOf = (d: number): DynoProgress["stage"] => (d < 20 ? "retrieve" : d < 50 ? "generate" : "judge");
  onProgress({ done, total, stage: "retrieve" });
  const tick = setInterval(() => {
    done = Math.min(total, done + 2);
    if (done >= total) {
      clearInterval(tick);
      onProgress({ done, total, stage: "gate" });
      gate = setTimeout(() => {
        onProgress({ done, total, stage: "done" });
        onDone(clone(NEXT_RUN));
      }, 800);
    } else {
      onProgress({ done, total, stage: stageOf(done) });
    }
  }, 110);
  return () => {
    clearInterval(tick);
    if (gate) clearTimeout(gate);
  };
}
