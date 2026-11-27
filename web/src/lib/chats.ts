/**
 * Chat rules shared by the chat route handlers (and later the Ask UI).
 *
 * The database checks the same limits (see the chats_and_messages
 * migration). These run first so a visitor gets a clear 400 with a
 * friendly message, instead of a raw Postgres error.
 */
/** Same limits as the database's check constraints. */
export const TITLE_MAX = 80;
export const QUESTION_MAX = 2000;
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
/** Either the checked value, or a message saying what's wrong. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** What PATCH /api/chats/[id] may change: a new title, pinned, or both. */
export interface ChatPatch {
  title?: string;
  pinned?: boolean;
}

/**
 * Check the body of PATCH /api/chats/[id].
 *
 * Only title and pinned are accepted, matching the database's column
 * grant UPDATE (title, pinned). Anything else in the body is ignored,
 * never passed on, so the API can't be used to try other columns.
 */
export function parseChatPatch(body: unknown): Parsed<ChatPatch> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Nothing to change." };
  const { title, pinned } = body as Record<string, unknown>;
  const patch: ChatPatch = {};

  if (title !== undefined) {
    if (typeof title !== "string") return { ok: false, error: "Give the chat a name." };
    const clean = cleanTitle(title);
    if (!clean) return { ok: false, error: "Give the chat a name." };
    patch.title = clean;
  }
  if (pinned !== undefined) {
    if (typeof pinned !== "boolean") return { ok: false, error: "pinned must be true or false." };
    patch.pinned = pinned;
  }

  if (patch.title === undefined && patch.pinned === undefined) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: patch };
}