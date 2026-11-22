/**
 * Rules for POST /api/ask (RAG Phase 5b): checking the request, and the
 * settings for calling the answer service (FastAPI on AWS Lambda).
 *
 * Unlike POST /api/chats, the browser sends NO answer here. The server
 * gets the answer from FastAPI and saves it itself, so a visitor can't
 * put words in the assistant's mouth.
 */
import type { Answer } from "./api/types";
import { QUESTION_MAX, cleanQuestion, isUuid, type Parsed } from "./chats";

/** What the browser sends: a course, a question, and the chat to add it to (if any). */
export interface AskRequest {
  courseId: string;
  question: string;
  /** Missing = start a new chat with this question. */
  chatId?: string;
}

/** Check the body of POST /api/ask. Anything else in it (like `answer`) is ignored. */
export function parseAsk(body: unknown): Parsed<AskRequest> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Send a question." };
  const { courseId, question, chatId } = body as Record<string, unknown>;

  if (!isUuid(courseId)) return { ok: false, error: "Pick a course." };
  if (typeof question !== "string") return { ok: false, error: "Send a question." };
  const q = cleanQuestion(question);
  if (!q) return { ok: false, error: "The question is empty." };
  if (q.length > QUESTION_MAX) return { ok: false, error: `Questions can be up to ${QUESTION_MAX} characters.` };

  // chatId is optional, but if it's there it must be a real id.
  if (chatId !== undefined && chatId !== null && !isUuid(chatId)) return { ok: false, error: "Chat not found." };

  return { ok: true, value: { courseId, question: q, ...(isUuid(chatId) ? { chatId } : {}) } };
}

/** Shown (and saved) when the course's documents don't answer the question. */
export const NOT_FOUND_TEXT = "I couldn't find this in this course's documents.";

/** The text saved in messages.content: the claims, or the not-found line. */
export function answerText(answer: Answer): string {
  const text = answer.claims.join(" ").trim();
  return text || NOT_FOUND_TEXT;
}

/**
 * Where the answer service is, read on every request (not at import), so
 * a missing setting gives a clear 503 instead of a crash.
 *
 * Both are SERVER-ONLY Vercel env vars (no NEXT_PUBLIC_): the internal key
 * must never reach the browser. Preview points at the staging Lambda,
 * Production at the production one.
 */
export function answerService(): { url: string; key: string } | null {
  const url = process.env.FASTAPI_URL?.trim();
  const key = process.env.FASTAPI_INTERNAL_KEY?.trim();
  if (!url || !key) return null;
  // Accept the Function URL with or without its trailing slash.
  return { url: `${url.replace(/\/+$/, "")}/v1/answer`, key };
}

/**
 * The answer service's error statuses whose short `detail` is written for
 * visitors (see api/src/recall_api/main.py) and safe to pass on as-is:
 * 401 session expired, 429 too fast / budget spent, 503 monthly AI budget.
 * Everything else becomes our own generic message.
 */
export const PASS_THROUGH = new Set([401, 429, 503]);
