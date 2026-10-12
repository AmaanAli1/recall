/**
 * Typed API client. Screens import from here and never call fetch directly.
 *
 * NEXT_PUBLIC_USE_MOCK_API=true → every function resolves from ./mock.ts.
 * Otherwise → it calls the real backend. Flip it once the endpoints exist;
 * the function signatures (the contract) stay the same.
 */
import * as mock from "./mock";
import type { Answer, ChatSummary, Course, CourseDocument, DemoSession, DynoProgress, DynoRun } from "./types";

export * from "./types";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";
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
  return USE_MOCK ? mock.createDemoSession() : http("/demo-sessions", { method: "POST" });
}

/** GET /demo-sessions/me: the current session, or null if there isn't one. */
export async function getDemoSession(): Promise<DemoSession | null> {
  if (USE_MOCK) return mock.getDemoSession();
  try {
    return await http<DemoSession>("/demo-sessions/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

/** DELETE /demo-sessions/me: delete the session and everything in it ("Start fresh"). */
export function endDemoSession(): Promise<void> {
  return USE_MOCK ? mock.endDemoSession() : http("/demo-sessions/me", { method: "DELETE" });
}

// ---------- Library ----------

export function listCourses(): Promise<Course[]> {
  return USE_MOCK ? mock.listCourses() : http("/courses");
}

/**
 * POST /courses/{id}/documents: upload one PDF. Progress is reported while the
 * server embeds it. Validation errors come back as ApiError 400/413/415.
 */
export function uploadDocument(
  courseId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CourseDocument> {
  if (USE_MOCK) return mock.uploadDocument(courseId, file, onProgress);
  const body = new FormData();
  body.append("file", file);
  return http(`/courses/${courseId}/documents`, { method: "POST", body });
}

export function deleteDocument(courseId: string, documentId: string): Promise<void> {
  return USE_MOCK ? mock.deleteDocument(courseId, documentId) : http(`/courses/${courseId}/documents/${documentId}`, { method: "DELETE" });
}

// ---------- Ask ----------

/** POST /ask: answer a question from one course's documents, with citations. */
export function ask(courseId: string, question: string): Promise<Answer> {
  return USE_MOCK ? mock.ask(courseId, question) : http("/ask", { method: "POST", body: JSON.stringify({ courseId, question }) });
}

export function listChats(): Promise<ChatSummary[]> {
  return USE_MOCK ? mock.listChats() : http("/chats");
}

export function deleteChat(id: string): Promise<void> {
  return USE_MOCK ? mock.deleteChat(id) : http(`/chats/${id}`, { method: "DELETE" });
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
