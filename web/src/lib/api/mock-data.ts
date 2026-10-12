/**
 * Sample data for the mocked API. It mirrors the 3 sample courses that every
 * demo session ships with (Algorithms, Operating Systems, Statistics).
 */
import type { Answer, ChatSummary, Course, DynoRun, RunConfig } from "./types";

export const COURSES: Course[] = [
  {
    id: "algo",
    name: "Algorithms",
    color: "blue",
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
    color: "teal",
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
    color: "ochre",
    sample: true,
    documents: [
      { id: "st-5", name: "Ch5_Regression.pdf", pages: 51, passages: null, status: "embedding", progress: 18, added: "Today" },
      { id: "st-t3", name: "Tutorial3_Solutions.pdf", pages: 9, passages: 33, status: "ready", added: "Oct 4" },
      { id: "st-4", name: "Ch4_Hypothesis_Testing.pdf", pages: 44, passages: 160, status: "ready", added: "Sep 30" },
      { id: "st-3", name: "Ch3_Sampling.pdf", pages: 38, passages: 139, status: "ready", added: "Sep 23" },
      { id: "st-fs", name: "Formula_Sheet.pdf", pages: 2, passages: 7, status: "ready", added: "Sep 10" },
    ],
  },
  { id: "linalg", name: "Linear Algebra", color: "plum", sample: false, documents: [] },
];

export const CHATS: ChatSummary[] = [
  { id: "dp", courseId: "algo", title: "DP vs greedy", group: "Today" },
  { id: "ks", courseId: "algo", title: "Knapsack table walkthrough", group: "Today" },
  { id: "mt", courseId: "algo", title: "Master theorem cases", group: "This week" },
  { id: "dj", courseId: "algo", title: "Dijkstra with negative edges", group: "This week" },
  { id: "am", courseId: "algo", title: "Amortized cost of dynamic arrays", group: "This week" },
  { id: "bo", courseId: "algo", title: "Big-O vs Big-Theta", group: "Earlier" },
  { id: "os-dl", courseId: "os", title: "Deadlock conditions", group: "Today" },
  { id: "os-rr", courseId: "os", title: "Round robin time slices", group: "This week" },
  { id: "os-sem", courseId: "os", title: "Semaphores vs mutexes", group: "Earlier" },
  { id: "st-p", courseId: "stats", title: "What a p-value means", group: "This week" },
  { id: "st-clt", courseId: "stats", title: "Central limit theorem", group: "Earlier" },
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

const OS_STARTERS: Starter[] = [
  { id: "os-dl", question: "What are the four conditions for deadlock?" },
  { id: "os-rr", question: "How does the time slice affect round robin scheduling?" },
];

const STATS_STARTERS: Starter[] = [
  { id: "st-p", question: "What does a p-value actually tell me?" },
  { id: "st-clt", question: "Why does the central limit theorem matter for sampling?" },
];

/** Starter questions per course. A course with no documents has none. */
export const COURSE_STARTERS: Record<string, Starter[]> = {
  algo: STARTERS,
  os: OS_STARTERS,
  stats: STATS_STARTERS,
  linalg: [],
};

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

  "os-dl": {
    question: OS_STARTERS[0].question,
    courseId: "os",
    claims: [
      "Deadlock needs four conditions at once: mutual exclusion, hold and wait, no preemption, and circular wait",
      "Circular wait is the easiest to break in practice: acquire locks in one global order and no cycle can form",
      "The lecture’s dining philosophers example deadlocks because every philosopher grabs the left fork first",
    ],
    sources: [
      { n: 1, file: "Lec08_Synchronization.pdf", page: 21, score: 0.85, pre: "Coffman conditions: ", hit: "mutual exclusion, hold-and-wait, no preemption, circular wait", post: ". All four must hold…" },
      { n: 2, file: "OSTEP_Ch26_Concurrency.pdf", page: 9, score: 0.78, pre: "Prevention: ", hit: "provide a total ordering on lock acquisition", post: " so cycles cannot form…" },
      { n: 3, file: "Lec08_Synchronization.pdf", page: 25, score: 0.72, pre: "Dining philosophers: ", hit: "each philosopher picks up the left fork, then waits forever for the right", post: "…" },
    ],
    dropped: [{ file: "Lec06_Processes.pdf", page: 14, score: 0.39 }],
    timing: { embed: 0.1, search: 0.3, rerank: 0.5, generate: 0.4 },
    followUps: ["Show me a lock ordering example", "Quiz me on this"],
  },
  "os-rr": {
    question: OS_STARTERS[1].question,
    courseId: "os",
    claims: [
      "Round robin gives each ready process one time slice, then moves it to the back of the queue",
      "A short slice improves response time but spends more of the CPU on context switches",
      "A very long slice makes round robin behave like first-come, first-served",
    ],
    sources: [
      { n: 1, file: "Lec07_Scheduling.pdf", page: 12, score: 0.83, pre: "RR: ", hit: "each job runs for a time slice, then the scheduler switches to the next job in the queue", post: "…" },
      { n: 2, file: "Lec07_Scheduling.pdf", page: 14, score: 0.79, pre: "Trade-off: ", hit: "shorter slices improve response time but amortize context-switch cost worse", post: "…" },
      { n: 3, file: "Lec07_Scheduling.pdf", page: 15, score: 0.7, pre: "As the slice grows, ", hit: "RR degenerates into FIFO", post: "…" },
    ],
    dropped: [{ file: "Lec06_Processes.pdf", page: 8, score: 0.42 }],
    timing: { embed: 0.1, search: 0.2, rerank: 0.5, generate: 0.4 },
    followUps: ["Compare round robin with SJF", "Quiz me on this"],
  },
  "st-p": {
    question: STATS_STARTERS[0].question,
    courseId: "stats",
    claims: [
      "A p-value is the probability of seeing data at least this extreme if the null hypothesis were true",
      "It is not the probability that the null hypothesis is true",
      "A small p-value (below the chosen α, often 0.05) is evidence against the null, not proof of the alternative",
    ],
    sources: [
      { n: 1, file: "Ch4_Hypothesis_Testing.pdf", page: 7, score: 0.86, pre: "Definition: ", hit: "the probability, assuming H₀ is true, of a test statistic at least as extreme as the one observed", post: "…" },
      { n: 2, file: "Ch4_Hypothesis_Testing.pdf", page: 9, score: 0.8, pre: "Common mistake: ", hit: "the p-value is not P(H₀ is true)", post: "…" },
      { n: 3, file: "Tutorial3_Solutions.pdf", page: 2, score: 0.71, pre: "Since p = 0.03 < α = 0.05, ", hit: "we reject H₀ at the 5% level", post: "…" },
    ],
    dropped: [{ file: "Formula_Sheet.pdf", page: 1, score: 0.44 }],
    timing: { embed: 0.1, search: 0.3, rerank: 0.5, generate: 0.4 },
    followUps: ["Walk me through Tutorial 3, question 2", "Quiz me on this"],
  },
  "st-clt": {
    question: STATS_STARTERS[1].question,
    courseId: "stats",
    claims: [
      "The central limit theorem says the mean of a large random sample is approximately normally distributed, whatever the population’s shape",
      "That is why we can build confidence intervals for a mean with the normal distribution",
      "The usual rule of thumb in the course is a sample size of at least 30",
    ],
    sources: [
      { n: 1, file: "Ch3_Sampling.pdf", page: 18, score: 0.87, pre: "CLT: ", hit: "the sampling distribution of x̄ is approximately normal for large n", post: ", regardless of the population distribution…" },
      { n: 2, file: "Ch3_Sampling.pdf", page: 22, score: 0.78, pre: "Consequence: ", hit: "x̄ ± z·σ/√n gives an approximate confidence interval", post: "…" },
      { n: 3, file: "Formula_Sheet.pdf", page: 1, score: 0.7, pre: "Rule of thumb: ", hit: "n ≥ 30", post: " for the normal approximation…" },
    ],
    dropped: [{ file: "Ch4_Hypothesis_Testing.pdf", page: 3, score: 0.4 }],
    timing: { embed: 0.1, search: 0.2, rerank: 0.5, generate: 0.4 },
    followUps: ["Show the confidence interval formula", "Quiz me on this"],
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
