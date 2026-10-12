/**
 * Sample data for the mocked API. It mirrors the 3 sample courses that every
 * demo session ships with (Algorithms, Operating Systems, Statistics).
 */
import type { Answer, ChatSummary, Course, DynoRun } from "./types";

export const COURSES: Course[] = [
  {
    id: "algo",
    name: "Algorithms",
    sample: true,
    documents: [
      { id: "algo-6", name: "Week6_DynamicProgramming.pdf", pages: 32, passages: 118, status: "ready", added: "Oct 2" },
      { id: "algo-5", name: "Week5_GreedyAlgorithms.pdf", pages: 28, passages: 101, status: "ready", added: "Sep 25" },
      { id: "algo-4", name: "Week4_DivideAndConquer.pdf", pages: 30, passages: 109, status: "ready", added: "Sep 18" },
      { id: "algo-3", name: "Week3_GraphSearch.pdf", pages: 41, passages: 152, status: "ready", added: "Sep 11" },
      { id: "algo-clrs", name: "CLRS_Ch15_Reading.pdf", pages: 64, passages: null, status: "embedding", progress: 62, added: "Today" },
      { id: "algo-mid", name: "Midterm_Review_Scan.pdf", pages: 12, passages: null, status: "failed", added: "Today", error: "No text layer. Run OCR first." },
    ],
  },
  {
    id: "os",
    name: "Operating Systems",
    sample: true,
    documents: [
      { id: "os-8", name: "Lec08_Synchronization.pdf", pages: 40, passages: 147, status: "ready", added: "Oct 6" },
      { id: "os-7", name: "Lec07_Scheduling.pdf", pages: 36, passages: 131, status: "ready", added: "Oct 1" },
      { id: "os-26", name: "OSTEP_Ch26_Concurrency.pdf", pages: 18, passages: 66, status: "ready", added: "Sep 29" },
      { id: "os-6", name: "Lec06_Processes.pdf", pages: 29, passages: 104, status: "ready", added: "Sep 24" },
    ],
  },
  {
    id: "stats",
    name: "Statistics",
    sample: true,
    documents: [
      { id: "st-5", name: "Ch5_Regression.pdf", pages: 51, passages: null, status: "embedding", progress: 18, added: "Today" },
      { id: "st-t3", name: "Tutorial3_Solutions.pdf", pages: 9, passages: 33, status: "ready", added: "Oct 4" },
      { id: "st-4", name: "Ch4_Hypothesis_Testing.pdf", pages: 44, passages: 160, status: "ready", added: "Sep 30" },
      { id: "st-3", name: "Ch3_Sampling.pdf", pages: 38, passages: 139, status: "ready", added: "Sep 23" },
      { id: "st-fs", name: "Formula_Sheet.pdf", pages: 2, passages: 7, status: "ready", added: "Sep 10" },
    ],
  },
  { id: "linalg", name: "Linear Algebra", sample: false, documents: [] },
];

export const CHATS: ChatSummary[] = [
  { id: "dp", title: "DP vs greedy", group: "Today" },
  { id: "ks", title: "Knapsack table walkthrough", group: "Today" },
  { id: "mt", title: "Master theorem cases", group: "This week" },
  { id: "dj", title: "Dijkstra with negative edges", group: "This week" },
  { id: "am", title: "Amortized cost of dynamic arrays", group: "This week" },
  { id: "bo", title: "Big-O vs Big-Theta", group: "Earlier" },
];

/** Starter questions shown on an empty Ask screen, keyed to canned answers. */
export const STARTERS: { id: string; question: string }[] = [
  { id: "dp", question: "When does dynamic programming beat a greedy approach?" },
  { id: "dj", question: "Why does Dijkstra fail with negative edges?" },
  { id: "ms", question: "What’s the recurrence for merge sort, and how do I solve it?" },
];

export const ANSWERS: Record<string, Answer> = {
  dp: {
    question: STARTERS[0].question,
    courseId: "algo",
    claims: [
      "Use dynamic programming when a problem has overlapping subproblems and optimal substructure, but the greedy choice can rule out the best answer",
      "The lecture’s example is 0/1 knapsack: taking the best value-per-weight item first can miss the optimal set",
      "Greedy still wins when the greedy-choice property holds, as in fractional knapsack",
    ],
    sources: [
      { n: 1, file: "Week6_DP.pdf", page: 4, score: 0.82, pre: "Greedy algorithms commit to the locally best choice. ", hit: "When that choice can rule out the optimal solution, we must consider every subproblem", post: "…" },
      { n: 2, file: "Week6_DP.pdf", page: 11, score: 0.77, pre: "0/1 knapsack: ", hit: "sorting by value/weight and taking items greedily fails", post: " on W = 50 with items (60,10), (100,20), (120,30)…" },
      { n: 3, file: "Week5_Greedy.pdf", page: 18, score: 0.71, pre: "Fractional knapsack ", hit: "has the greedy-choice property", post: ": taking the highest value-per-weight item first is always safe…" },
    ],
    dropped: [
      { file: "Week5_Greedy.pdf", page: 22, score: 0.41 },
      { file: "Week4_DivideConquer.pdf", page: 9, score: 0.33 },
    ],
    timing: { embed: 0.1, search: 0.3, rerank: 0.6, generate: 0.4 },
    followUps: ["Walk me through the knapsack table", "Quiz me on this"],
  },
  dj: {
    question: STARTERS[1].question,
    courseId: "algo",
    claims: [
      "Dijkstra finalizes a vertex the moment it leaves the priority queue, assuming no later path to it can be shorter",
      "A negative edge breaks that assumption: a path that looks longer can pass through it and end up cheaper, after the vertex is already final",
      "Use Bellman-Ford instead, which relaxes every edge |V| − 1 times and also detects negative cycles",
    ],
    sources: [
      { n: 1, file: "Week3_GraphSearch.pdf", page: 27, score: 0.84, pre: "Extract-Min returns u; ", hit: "once a vertex is extracted, its distance is final", post: " because all edge weights are non-negative…" },
      { n: 2, file: "Week3_GraphSearch.pdf", page: 29, score: 0.79, pre: "Counterexample: ", hit: "with a negative edge, an already-finalized vertex can be improved later", post: ", so the invariant fails…" },
      { n: 3, file: "Week3_GraphSearch.pdf", page: 33, score: 0.73, pre: "Bellman-Ford ", hit: "relaxes all edges |V| − 1 times", post: ", then one more pass to detect a negative cycle…" },
    ],
    dropped: [{ file: "Week4_DivideConquer.pdf", page: 21, score: 0.38 }],
    timing: { embed: 0.1, search: 0.3, rerank: 0.5, generate: 0.4 },
    followUps: ["Show me a counterexample graph", "Quiz me on this"],
  },
  ms: {
    question: STARTERS[2].question,
    courseId: "algo",
    claims: [
      "Merge sort splits the array in half, sorts both halves, then merges them in linear time, so T(n) = 2T(n/2) + Θ(n)",
      "That fits case 2 of the master theorem with a = 2, b = 2 and f(n) = Θ(n), so T(n) = Θ(n log n)",
      "The recursion tree says the same thing: log n levels, each doing Θ(n) work in total",
    ],
    sources: [
      { n: 1, file: "Week4_DivideConquer.pdf", page: 6, score: 0.86, pre: "Merge sort: divide, conquer, combine. ", hit: "T(n) = 2T(n/2) + Θ(n)", post: " for n > 1…" },
      { n: 2, file: "Week4_DivideConquer.pdf", page: 14, score: 0.8, pre: "Master theorem, case 2: ", hit: "if f(n) = Θ(n^(log_b a)), then T(n) = Θ(n^(log_b a) · log n)", post: "…" },
      { n: 3, file: "Week4_DivideConquer.pdf", page: 9, score: 0.72, pre: "Recursion tree: ", hit: "each of the log n levels costs cn", post: ", for a total of cn log n…" },
    ],
    dropped: [
      { file: "Week6_DP.pdf", page: 2, score: 0.4 },
      { file: "Week3_GraphSearch.pdf", page: 4, score: 0.31 },
    ],
    timing: { embed: 0.1, search: 0.2, rerank: 0.5, generate: 0.4 },
    followUps: ["Draw the recursion tree", "Quiz me on this"],
  },
};

/** Dyno runs, oldest first. R8 is the baseline. */
export const DYNO_RUNS: DynoRun[] = [
  { id: "R8", date: "Sep 30", change: "Baseline: vector only, 800-token chunks", short: "baseline", metrics: { recall: 0.72, mrr: 0.63, faith: 0.87, correct: 0.78, relev: 0.87 }, p95: 1.4, n: 80 },
  { id: "R9", date: "Oct 2", change: "Prompt v3: trimmed context", short: "prompt v3", metrics: { recall: 0.71, mrr: 0.62, faith: 0.83, correct: 0.77, relev: 0.86 }, p95: 1.3, n: 80 },
  { id: "R10", date: "Oct 3", change: "Chunk size 800 → 400 tokens", short: "400-token chunks", metrics: { recall: 0.74, mrr: 0.65, faith: 0.87, correct: 0.79, relev: 0.87 }, p95: 1.4, n: 80 },
  { id: "R11", date: "Oct 5", change: "Hybrid search: keyword + vector", short: "hybrid search", metrics: { recall: 0.81, mrr: 0.7, faith: 0.88, correct: 0.82, relev: 0.88 }, p95: 1.6, n: 80 },
  { id: "R12", date: "Oct 7", change: "Reranker: cross-encoder on top 20", short: "reranker", metrics: { recall: 0.86, mrr: 0.74, faith: 0.91, correct: 0.85, relev: 0.89 }, p95: 1.9, n: 80 },
];

/** The run that "Run Dyno" produces in the mock. */
export const NEXT_RUN: DynoRun = {
  id: "R13", date: "Oct 8", change: "Query rewriting: HyDE", short: "HyDE",
  metrics: { recall: 0.88, mrr: 0.76, faith: 0.92, correct: 0.86, relev: 0.9 }, p95: 2.1, n: 80,
};
