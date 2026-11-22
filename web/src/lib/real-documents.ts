/**
 * The documents that really are in the database (RAG Phase 3, PR #33): four
 * chapters of Jeff Erickson's *Algorithms* (CC BY 4.0), loaded into the
 * Algorithms sample course on staging and production.
 *
 * Shown instead of the mock documents when real answers are on, so Library
 * and Ask list what answers actually come from. Static on purpose: sample
 * documents only change when someone runs the ingest script. A real
 * documents endpoint comes with visitor uploads (December).
 */
import type { CourseDocument } from "./api/types";
import { SAMPLE_COURSE_IDS } from "./sample-courses";

/** Chunk counts per chapter, as loaded (90 + 115 + 55 + 67 = 327 passages). */
export const REAL_DOCUMENTS: Record<string, CourseDocument[]> = {
  [SAMPLE_COURSE_IDS.algorithms]: [
    { id: "erickson-1", name: "Erickson_Ch1_Recursion.pdf", pages: 50, passages: 90, status: "ready", added: "Nov 7" },
    { id: "erickson-3", name: "Erickson_Ch3_DynamicProgramming.pdf", pages: 62, passages: 115, status: "ready", added: "Nov 7" },
    { id: "erickson-4", name: "Erickson_Ch4_GreedyAlgorithms.pdf", pages: 28, passages: 55, status: "ready", added: "Nov 7" },
    { id: "erickson-8", name: "Erickson_Ch8_ShortestPaths.pdf", pages: 36, passages: 67, status: "ready", added: "Nov 7" },
  ],
};

/** Does this course have real documents (so its answers are real)? */
export function hasRealDocuments(courseId: string): boolean {
  return (REAL_DOCUMENTS[courseId]?.length ?? 0) > 0;
}

/** CC BY 4.0 requires attribution wherever the material is shown (see CreditLine). */
export const ERICKSON_CREDIT = {
  href: "https://jeffe.cs.illinois.edu/teaching/algorithms/",
};
