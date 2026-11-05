/**
 * Chat rules shared by the chat route handlers (and later the Ask UI).
 *
 * The database checks the same limits (see the chats_and_messages
 * migration). These run first so a visitor gets a clear 400 with a
 * friendly message, instead of a raw Postgres error.
 */
import type { Answer } from "./api/types";

/** Same limits as the database's check constraints. */
export const TITLE_MAX = 80;
export const QUESTION_MAX = 2000;
export const ANSWER_TEXT_MAX = 8000;
/** The database caps the stored JSON at 64 kB; stop a little earlier. */
export const ANSWER_JSON_MAX = 60_000;
/** Titles made from a question are cut shorter than TITLE_MAX, so they fit the sidebar. */
const AUTO_TITLE_LEN = 60;

/** 8-4-4-4-12 hex digits, e.g. 00000000-0000-0000-0000-00000000c001. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Control characters (tabs, newlines, NUL, and the C1 block Postgres also
 * counts as [[:cntrl:]]) and zero-width characters, which look like
 * nothing but make two titles that look the same compare as different.
 */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/**
 * Type guard: "is this a uuid string?" Check ids from the URL or the body
 * before they reach the database: a malformed id would otherwise come back
 * as a Postgres error (22P02) instead of a clean 400.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * A chat title, cleaned: NFC-normalised (so "é" typed two different ways
 * is one string), control characters turned into spaces, zero-width
 * characters removed, runs of spaces collapsed, trimmed, at most 80.
 * Returns "" when nothing is left; callers treat that as invalid.
 */
export function cleanTitle(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(CONTROL, " ")
    .replace(ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX)
    .trim(); // slicing can leave a space at the end
}

/**
 * The automatic title for a new chat: its first question, shortened to
 * about 60 characters at a word boundary, with "…" when cut.
 */
export function titleFromQuestion(question: string): string {
  const clean = cleanTitle(question);
  if (!clean) return "New chat";
  if (clean.length <= AUTO_TITLE_LEN) return clean;
  const cut = clean.slice(0, AUTO_TITLE_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  // No space in a sensible place (one very long word)? Cut mid-word.
  const head = lastSpace > 20 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s.,;:!?-]+$/, "")}…`;
}

/**
 * A question as it will be saved: normalised, control characters other
 * than newlines removed, trimmed. Newlines stay: a pasted question can
 * have several lines.
 */
export function cleanQuestion(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, "")
    .replace(ZERO_WIDTH, "")
    .trim();
}

/** One question and its answer, ready to save. */
export interface Exchange {
  question: string;
  /** The answer's text (its claims joined), stored in messages.content. */
  answerText: string;
  /** The full answer, stored in messages.answer (jsonb). */
  answer: Answer;
}

/** Either the checked value, or a message saying what's wrong. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Check { question, answer } from a request body.
 *
 * TEMPORARY (Chats phase): answers are still mocked in the browser, so the
 * browser sends the answer to be saved. In the RAG phase the server that
 * writes the answer saves it, and `answer` leaves the request body.
 */
export function parseExchange(body: unknown): Parsed<Exchange> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Send a question and an answer." };
  const { question, answer } = body as Record<string, unknown>;

  if (typeof question !== "string") return { ok: false, error: "Send a question." };
  const q = cleanQuestion(question);
  if (!q) return { ok: false, error: "The question is empty." };
  if (q.length > QUESTION_MAX) return { ok: false, error: `Questions can be up to ${QUESTION_MAX} characters.` };

  // Only the shape we rely on: an object whose claims are strings.
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return { ok: false, error: "Send the answer to save." };
  }
  const claims = (answer as { claims?: unknown }).claims;
  if (!Array.isArray(claims) || claims.length === 0 || !claims.every((c) => typeof c === "string")) {
    return { ok: false, error: "The answer has no text." };
  }
  const answerText = claims.join(" ").trim();
  if (!answerText) return { ok: false, error: "The answer has no text." };
  if (answerText.length > ANSWER_TEXT_MAX || JSON.stringify(answer).length > ANSWER_JSON_MAX) {
    return { ok: false, error: "That answer is too long to save." };
  }

  return { ok: true, value: { question: q, answerText, answer: answer as Answer } };
}

/** Check the body of POST /api/chats: { courseId, question, answer }. */
export function parseNewChat(body: unknown): Parsed<Exchange & { courseId: string }> {
  const courseId = (body as { courseId?: unknown } | null)?.courseId;
  if (!isUuid(courseId)) return { ok: false, error: "Pick a course." };
  const exchange = parseExchange(body);
  if (!exchange.ok) return exchange;
  return { ok: true, value: { courseId, ...exchange.value } };
}