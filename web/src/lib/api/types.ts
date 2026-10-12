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
  /** What "embedding" is doing right now: reading a scan (OCR) or embedding passages. */
  stage?: "ocr" | "embed";
  /** Display label for when it was added, e.g. "Oct 2" or "Today". */
  added: string;
  /** Why it failed, when status is "failed". */
  error?: string;
}

/** Muted course colours, so they never compete with the red accent. */
export type CourseColor = "blue" | "teal" | "green" | "ochre" | "rust" | "plum";

export interface Course {
  id: string;
  name: string;
  /** Optional short code shown before the name, e.g. "CP213". */
  code?: string;
  /** Optional term, e.g. "Fall 2026". */
  term?: string;
  color: CourseColor;
  /** Archived courses are hidden from Ask and the tabs, but keep their PDFs. */
  archived?: boolean;
  /** Sample courses ship with every demo session and are read-only. */
  sample: boolean;
  documents: CourseDocument[];
}

/** What the "New course" / "Edit course" dialog sends. */
export interface CourseInput {
  name: string;
  code?: string;
  term?: string;
  color: CourseColor;
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
  /** Chats belong to one course; Ask shows the open course's chats. */
  courseId: string;
  title: string;
  group: "Today" | "This week" | "Earlier";
  /** Pinned chats sit in a "Pinned" group at the top. */
  pinned?: boolean;
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
  /** The full setup, shown in the run's Details panel (what MLflow logs as params). */
  config?: RunConfig;
}

/** One run's setup. `changed` names the one setting this run changed from the run before. */
export interface RunConfig {
  chunking: string;
  retrieval: string;
  topK: number;
  reranker: string;
  rewriting: string;
  prompt: string;
  embedModel: string;
  answerModel: string;
  judgeModel: string;
  commit: string;
  durationS: number;
  costUsd: number;
  changed: RunSetting[];
}

export type RunSetting = "chunking" | "retrieval" | "topK" | "reranker" | "rewriting" | "prompt";

/** Progress events streamed while a Dyno run is in flight. */
export interface DynoProgress {
  done: number;
  total: number;
  stage: "retrieve" | "generate" | "judge" | "gate" | "done";
}
