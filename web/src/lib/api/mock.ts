/**
 * In-browser mock of the backend. Same signatures as the real client, with
 * small realistic delays so loading states get exercised.
 * The demo session is kept in localStorage here; the real one is an httpOnly cookie.
 */
import { ANSWERS, CHATS, COURSES, DYNO_RUNS, NEXT_RUN, STARTERS } from "./mock-data";
import type { Answer, ChatSummary, Course, CourseDocument, DemoSession, DynoProgress, DynoRun } from "./types";

const SESSION_KEY = "recall-demo";
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

const uploaded: Record<string, CourseDocument[]> = {};
const deletedDocs = new Set<string>();

export async function listCourses(): Promise<Course[]> {
  await wait(120);
  return clone(COURSES).map((c) => ({
    ...c,
    documents: [...(uploaded[c.id] ?? []), ...c.documents].filter((d) => !deletedDocs.has(d.id)),
  }));
}

export async function uploadDocument(courseId: string, file: File, onProgress?: (pct: number) => void): Promise<CourseDocument> {
  let pct = 0;
  while (pct < 100) {
    await wait(160);
    pct = Math.min(100, pct + 3 + (file.name.length % 3));
    onProgress?.(pct);
  }
  const pages = 8 + ((file.name.length * 7) % 37);
  const doc: CourseDocument = {
    id: `${courseId}-${Date.now()}`,
    name: file.name,
    pages,
    passages: pages * 3 + 7,
    status: "ready",
    added: "Just now",
  };
  uploaded[courseId] = [doc, ...(uploaded[courseId] ?? [])];
  return doc;
}

export async function deleteDocument(_courseId: string, documentId: string): Promise<void> {
  deletedDocs.add(documentId);
}

// ---------- ask ----------

export async function ask(_courseId: string, question: string): Promise<Answer> {
  await wait(450);
  const starter = STARTERS.find((s) => s.question === question || s.id === question);
  return clone(ANSWERS[starter?.id ?? "dp"]);
}

const deletedChats = new Set<string>();

export async function listChats(): Promise<ChatSummary[]> {
  return CHATS.filter((c) => !deletedChats.has(c.id));
}

export async function deleteChat(id: string): Promise<void> {
  deletedChats.add(id);
}

// ---------- dyno ----------

export async function listDynoRuns(): Promise<DynoRun[]> {
  await wait(80);
  return clone(DYNO_RUNS);
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
