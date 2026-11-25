/**
 * Course display helpers (Ask's sidebar).
 *
 * Since 2026-11-25 the demo is Algorithms only: visitors can't create, edit or
 * upload to courses, so the limit, name checks and term list were removed with
 * the course dialog (see recall-algorithms-only-checklist.md).
 */
import type { CourseColor } from "./api/types";

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

/** "CP213 · Data Structures", or just the name when there's no code. */
export const courseLabel = (c: { name: string; code?: string }) => (c.code ? `${c.code} · ${c.name}` : c.name);
