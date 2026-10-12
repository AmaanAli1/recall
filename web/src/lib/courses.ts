/**
 * Course rules shared by the New/Edit course dialog and the mock API.
 *
 * These checks are for UX only (instant, friendly errors). The backend must
 * enforce the same limits, because anyone can skip the frontend.
 */
import type { CourseColor } from "./api/types";

/** Most courses a demo session can hold. Archived courses count: they still hold PDFs. */
export const COURSE_LIMIT = 10;
export const NAME_MAX = 60;
export const CODE_MAX = 12;
/** Most PDFs the dialog takes in one go. */
export const FILES_PER_BATCH = 20;

/** [id, accessible name, swatch]. Muted so they never fight the red accent. */
export const COURSE_COLORS: readonly (readonly [CourseColor, string, string])[] = [
  ["blue", "Blue", "#3557A6"],
  ["teal", "Teal", "#1F7A86"],
  ["green", "Green", "#0B7046"],
  ["ochre", "Ochre", "#B07A12"],
  ["rust", "Rust", "#B4471E"],
  ["plum", "Plum", "#7A3E8E"],
];

export const colorHex = (c: CourseColor) => (COURSE_COLORS.find((x) => x[0] === c) ?? COURSE_COLORS[0])[2];

/** Term choices; "" means no term. */
export const TERMS = ["", "Fall 2026", "Winter 2027", "Spring/Summer 2027", "Winter 2026", "Fall 2025"] as const;

/** Trim and collapse runs of whitespace, so "  Data   Structures " and "Data Structures" are the same name. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** A course code: trimmed, upper case, inner spaces removed ("cp 213" → "CP213"). */
export function cleanCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase().slice(0, CODE_MAX);
}

/**
 * The error to show for a course name, or null when it's fine.
 * `existing` is every other course's name; pass the course's own id via `selfName`
 * when editing, so a course doesn't clash with itself.
 */
export function courseNameError(raw: string, existing: readonly string[], selfName?: string): string | null {
  const name = cleanName(raw);
  if (!name) return "Give the course a name.";
  if (name.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`;
  const lower = name.toLowerCase();
  const clash = existing.some((n) => n.toLowerCase() === lower && n.toLowerCase() !== selfName?.toLowerCase());
  if (clash) return `You already have a course called ${name}.`;
  return null;
}

/** "CP213 · Data Structures", or just the name when there's no code. */
export const courseLabel = (c: { name: string; code?: string }) => (c.code ? `${c.code} · ${c.name}` : c.name);
