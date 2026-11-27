/**
 * Sample data for the mocked API. It mirrors the sample course that every
 * demo session ships with (Algorithms).
 *
 * The canned answers below are mock-mode only (local runs and CI, never the
 * Preview or Production): their excerpts are written for the tests, not
 * quoted from the book, even though they name Erickson's chapter files.
 */
import { REAL_DOCUMENTS } from "../real-documents";
import { SAMPLE_COURSE_IDS } from "../sample-courses";
import type { Answer, ChatSummary, Course, DynoRun, RunConfig } from "./types";

export const COURSES: Course[] = [
  {
    id: SAMPLE_COURSE_IDS.algorithms,
    name: "Algorithms",
    color: "blue",
    sample: true,
    // The same 4 Erickson chapters the real site lists (lib/real-documents.ts),
    // so local runs and CI show what the Preview and Production show.
    documents: REAL_DOCUMENTS[SAMPLE_COURSE_IDS.algorithms].map((d) => ({ ...d })),
  },
];

export const CHATS: ChatSummary[] = [
  { id: "dp", courseId: SAMPLE_COURSE_IDS.algorithms, title: "DP vs greedy", group: "Today" },
  { id: "ks", courseId: SAMPLE_COURSE_IDS.algorithms, title: "Knapsack table walkthrough", group: "Today" },
  { id: "mt", courseId: SAMPLE_COURSE_IDS.algorithms, title: "Master theorem cases", group: "This week" },
  { id: "dj", courseId: SAMPLE_COURSE_IDS.algorithms, title: "Dijkstra with negative edges", group: "This week" },
  { id: "am", courseId: SAMPLE_COURSE_IDS.algorithms, title: "Amortized cost of dynamic arrays", group: "This week" },
  { id: "bo", courseId: SAMPLE_COURSE_IDS.algorithms, title: "Big-O vs Big-Theta", group: "Earlier" },
];

/** Starter questions shown on an empty Ask screen, keyed to canned answers. */
export interface Starter {
  id: string;
  question: string;
}

/** Algorithms starters (also the default course). */
export const STARTERS: Starter[] = [
  { id: "dp", question: "When does dynamic programming beat a greedy approach?" },
  { id: "dj", question: "Why does Dijkstra fail with negative edges?" },
  { id: "ms", question: "What’s the recurrence for merge sort, and how do I solve it?" },
];

/** Starter questions per course. A course with no documents has none. */
export const COURSE_STARTERS: Record<string, Starter[]> = {
  [SAMPLE_COURSE_IDS.algorithms]: STARTERS,
};

export const ANSWERS: Record<string, Answer> = {
  dp: {
    question: STARTERS[0].question,
    courseId: SAMPLE_COURSE_IDS.algorithms,
    claims: [
      "Use dynamic programming when a problem has overlapping subproblems and optimal substructure, but the greedy choice can rule out the best answer",
      "The book’s example is 0/1 knapsack: taking the best value-per-weight item first can miss the optimal set",
      "Greedy still wins when the greedy-choice property holds, as in fractional knapsack",
    ],
    sources: [
      { n: 1, file: "Erickson_Ch3_DynamicProgramming.pdf", page: 4, score: 0.82, pre: "Greedy algorithms commit to the locally best choice. ", hit: "When that choice can rule out the optimal solution, we must consider every subproblem", post: "…" },
      { n: 2, file: "Erickson_Ch3_DynamicProgramming.pdf", page: 11, score: 0.77, pre: "0/1 knapsack: ", hit: "sorting by value/weight and taking items greedily fails", post: " on W = 50 with items (60,10), (100,20), (120,30)…" },
      { n: 3, file: "Erickson_Ch4_GreedyAlgorithms.pdf", page: 18, score: 0.71, pre: "Fractional knapsack ", hit: "has the greedy-choice property", post: ": taking the highest value-per-weight item first is always safe…" },
    ],
    dropped: [
      { file: "Erickson_Ch4_GreedyAlgorithms.pdf", page: 22, score: 0.41 },
      { file: "Erickson_Ch1_Recursion.pdf", page: 9, score: 0.33 },
    ],
    timing: { embed: 0.1, search: 0.3, rerank: 0, generate: 0.4 },
    followUps: ["Walk me through the knapsack table", "Quiz me on this"],
  },
  dj: {
    question: STARTERS[1].question,
    courseId: SAMPLE_COURSE_IDS.algorithms,
    claims: [
      "Dijkstra finalizes a vertex the moment it leaves the priority queue, assuming no later path to it can be shorter",
      "A negative edge breaks that assumption: a path that looks longer can pass through it and end up cheaper, after the vertex is already final",
      "Use Bellman-Ford instead, which relaxes every edge |V| − 1 times and also detects negative cycles",
    ],
    sources: [
      { n: 1, file: "Erickson_Ch8_ShortestPaths.pdf", page: 27, score: 0.84, pre: "Extract-Min returns u; ", hit: "once a vertex is extracted, its distance is final", post: " because all edge weights are non-negative…" },
      { n: 2, file: "Erickson_Ch8_ShortestPaths.pdf", page: 29, score: 0.79, pre: "Counterexample: ", hit: "with a negative edge, an already-finalized vertex can be improved later", post: ", so the invariant fails…" },
      { n: 3, file: "Erickson_Ch8_ShortestPaths.pdf", page: 33, score: 0.73, pre: "Bellman-Ford ", hit: "relaxes all edges |V| − 1 times", post: ", then one more pass to detect a negative cycle…" },
    ],
    dropped: [{ file: "Erickson_Ch1_Recursion.pdf", page: 21, score: 0.38 }],
    timing: { embed: 0.1, search: 0.3, rerank: 0, generate: 0.4 },
    followUps: ["Show me a counterexample graph", "Quiz me on this"],
  },
  ms: {
    question: STARTERS[2].question,
    courseId: SAMPLE_COURSE_IDS.algorithms,
    claims: [
      "Merge sort splits the array in half, sorts both halves, then merges them in linear time, so T(n) = 2T(n/2) + Θ(n)",
      "That fits case 2 of the master theorem with a = 2, b = 2 and f(n) = Θ(n), so T(n) = Θ(n log n)",
      "The recursion tree says the same thing: log n levels, each doing Θ(n) work in total",
    ],
    sources: [
      { n: 1, file: "Erickson_Ch1_Recursion.pdf", page: 6, score: 0.86, pre: "Merge sort: divide, conquer, combine. ", hit: "T(n) = 2T(n/2) + Θ(n)", post: " for n > 1…" },
      { n: 2, file: "Erickson_Ch1_Recursion.pdf", page: 14, score: 0.8, pre: "Master theorem, case 2: ", hit: "if f(n) = Θ(n^(log_b a)), then T(n) = Θ(n^(log_b a) · log n)", post: "…" },
      { n: 3, file: "Erickson_Ch1_Recursion.pdf", page: 9, score: 0.72, pre: "Recursion tree: ", hit: "each of the log n levels costs cn", post: ", for a total of cn log n…" },
    ],
    dropped: [
      { file: "Erickson_Ch3_DynamicProgramming.pdf", page: 2, score: 0.4 },
      { file: "Erickson_Ch8_ShortestPaths.pdf", page: 4, score: 0.31 },
    ],
    timing: { embed: 0.1, search: 0.2, rerank: 0, generate: 0.4 },
    followUps: ["Draw the recursion tree", "Quiz me on this"],
  },

};

/**
 * Each run's setup. Every run changes ONE setting from the run before it, so a
 * metric change has one cause. R9's prompt change hit the redline and was
 * reverted, so R10 onwards builds on R8's prompt again.
 */
const BASE_CONFIG: Omit<RunConfig, "commit" | "durationS" | "costUsd" | "changed"> = {
  chunking: "800 tokens · 100 overlap",
  retrieval: "Vector (pgvector)",
  topK: 5,
  reranker: "Off",
  rewriting: "Off",
  prompt: "v2",
  embedModel: "text-embedding-3-small",
  answerModel: "gpt-4o-mini",
  judgeModel: "gpt-4o",
};
const R10 = { ...BASE_CONFIG, chunking: "400 tokens · 50 overlap" };
const R11 = { ...R10, retrieval: "Hybrid: BM25 + vector (RRF)" };
const R12 = { ...R11, reranker: "Cross-encoder, top 20 → 5" };
const CONFIGS: Record<string, RunConfig> = {
  R8: { ...BASE_CONFIG, commit: "a3f9c21", durationS: 228, costUsd: 0.41, changed: [] },
  R9: { ...BASE_CONFIG, prompt: "v3 (trimmed context)", commit: "b71e0d4", durationS: 220, costUsd: 0.38, changed: ["prompt"] },
  R10: { ...R10, commit: "c2d8a97", durationS: 242, costUsd: 0.44, changed: ["chunking"] },
  R11: { ...R11, commit: "d90b3ee", durationS: 245, costUsd: 0.45, changed: ["retrieval"] },
  R12: { ...R12, commit: "e4c71fa", durationS: 252, costUsd: 0.47, changed: ["reranker"] },
  R13: { ...R12, rewriting: "HyDE", commit: "f13a6b2", durationS: 271, costUsd: 0.55, changed: ["rewriting"] },
};

/** Dyno runs, oldest first. R8 is the baseline. */
export const DYNO_RUNS: DynoRun[] = [
  { id: "R8", date: "Sep 30", change: "Baseline: vector only, 800-token chunks", short: "baseline", metrics: { recall: 0.72, mrr: 0.63, faith: 0.87, correct: 0.78, relev: 0.87 }, p95: 1.4, n: 80, config: CONFIGS.R8 },
  { id: "R9", date: "Oct 2", change: "Prompt v3: trimmed context", short: "prompt v3", metrics: { recall: 0.71, mrr: 0.62, faith: 0.83, correct: 0.77, relev: 0.86 }, p95: 1.3, n: 80, config: CONFIGS.R9 },
  { id: "R10", date: "Oct 3", change: "Chunk size 800 → 400 tokens", short: "400-token chunks", metrics: { recall: 0.74, mrr: 0.65, faith: 0.87, correct: 0.79, relev: 0.87 }, p95: 1.4, n: 80, config: CONFIGS.R10 },
  { id: "R11", date: "Oct 5", change: "Hybrid search: keyword + vector", short: "hybrid search", metrics: { recall: 0.81, mrr: 0.7, faith: 0.88, correct: 0.82, relev: 0.88 }, p95: 1.6, n: 80, config: CONFIGS.R11 },
  { id: "R12", date: "Oct 7", change: "Reranker: cross-encoder on top 20", short: "reranker", metrics: { recall: 0.86, mrr: 0.74, faith: 0.91, correct: 0.85, relev: 0.89 }, p95: 1.9, n: 80, config: CONFIGS.R12 },
];

/** The run that "Run Dyno" produces in the mock. */
export const NEXT_RUN: DynoRun = {
  id: "R13", date: "Oct 8", change: "Query rewriting: HyDE", short: "HyDE",
  metrics: { recall: 0.88, mrr: 0.76, faith: 0.92, correct: 0.86, relev: 0.9 }, p95: 2.1, n: 80, config: CONFIGS.R13,
};
