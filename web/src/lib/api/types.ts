/**
 * The contract between the frontend and the FastAPI backend.
 *
 * Every screen talks to the backend only through the functions in ./index.ts,
 * which return these types. Each type is something the backend has to produce,
 * so this file doubles as the backend's to-do list.
 */

/** An anonymous demo session (Supabase anonymous auth + a secure cookie). */
export interface DemoSession {
  /** Human-readable ID shown on the library card, e.g. "demo-K7QF-3M". */
  id: string;
  /** ISO time the session was created. */
  createdAt: string;
  /** ISO time of the last activity; the session expires 24 h after this. */
  lastActiveAt: string;
}

export type DocumentStatus = "ready" | "embedding" | "failed";

export interface CourseDocument {
  id: string;
  name: string;
  pages: number | null;
  /** Passages ready to cite; null until embedding finishes. */
  passages: number | null;
  status: DocumentStatus;
  /** Embedding progress 0–100 while status is "embedding". */
  progress?: number;
  /** Display label for when it was added, e.g. "Oct 2" or "Today". */
  added: string;
  /** Why it failed, when status is "failed". */
  error?: string;
}

export interface Course {
  id: string;
  name: string;
  /** Sample courses ship with every demo session and are read-only. */
  sample: boolean;
  documents: CourseDocument[];
}

export interface Source {
  /** Citation number as shown in the answer: [1], [2], [3]. */
  n: number;
  file: string;
  page: number;
  /** Reranker score 0–1. */
  score: number;
  /** Passage text split around the sentence that supports the claim. */
  pre: string;
  hit: string;
  post: string;
}

export interface Answer {
  question: string;
  courseId: string;
  /** Answer split into claims; claim i is supported by source n = i + 1. */
  claims: string[];
  sources: Source[];
  /** Weak matches the reranker dropped. */
  dropped: { file: string; page: number; score: number }[];
  /** Seconds per pipeline step, for the timing bar. */
  timing: { embed: number; search: number; rerank: number; generate: number };
  followUps: string[];
}

export interface ChatSummary {
  id: string;
  title: string;
  group: "Today" | "This week" | "Earlier";
}

export type MetricKey = "recall" | "mrr" | "faith" | "correct" | "relev";

export interface DynoRun {
  id: string; // "R12"
  date: string; // "Oct 7"
  change: string; // what the run tested
  short: string; // short label for the chart axis
  metrics: Record<MetricKey, number>;
  /** p95 latency in seconds. */
  p95: number;
  /** Number of golden questions evaluated. */
  n: number;
}

/** Progress events streamed while a Dyno run is in flight. */
export interface DynoProgress {
  done: number;
  total: number;
  stage: "retrieve" | "generate" | "judge" | "gate" | "done";
}
