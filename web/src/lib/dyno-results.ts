/**
 * Real Dyno runs: the JSON the laptop script (`api/src/recall_api/scripts/dyno_run.py`)
 * appends to `src/data/dyno-runs.json`. It's committed and read at build time, so the
 * public /dyno page never touches a database (decision DV5).
 *
 * The shape is checked when the module loads: if the script and this file ever disagree,
 * the build and the unit tests fail instead of the page quietly showing nothing.
 */
import raw from "@/data/dyno-runs.json";

export interface Estimate {
  value: number;
  /** 95% bootstrap interval. */
  low: number;
  high: number;
}

export interface RetrievedChunk {
  file: string;
  page: number;
  score: number;
}

export interface QuestionResult {
  /** Golden-set id, e.g. "rec-01" (questions live in dyno/golden.toml). */
  id: string;
  /** Rank of the first chunk from a labelled page, 1 = best; null = not in the top 10. */
  rank: number | null;
  /** The top 5 chunks retrieved, best first. */
  top: RetrievedChunk[];
}

export interface RealRun {
  id: string; // "R1"
  date: string; // ISO day, "2026-11-22"
  change: string;
  commit: string;
  n: number;
  metrics: { recall5: Estimate; mrr: Estimate };
  setup: {
    chunking: string;
    retrieval: string;
    topK: number;
    reranker: string;
    rewriting: string;
    embedModel: string;
  };
  tokens: number;
  costUsd: number;
  durationS: number;
  questions: QuestionResult[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isEstimate(v: unknown): v is Estimate {
  return isObj(v) && isNum(v.value) && isNum(v.low) && isNum(v.high) && v.low <= v.value && v.value <= v.high;
}

function isQuestion(v: unknown): v is QuestionResult {
  return (
    isObj(v) &&
    isStr(v.id) &&
    (v.rank === null || (Number.isInteger(v.rank) && (v.rank as number) >= 1)) &&
    Array.isArray(v.top) &&
    v.top.every((c) => isObj(c) && isStr(c.file) && Number.isInteger(c.page) && isNum(c.score))
  );
}

function isRun(v: unknown): v is RealRun {
  if (!isObj(v) || !isObj(v.metrics) || !isObj(v.setup) || !Array.isArray(v.questions)) return false;
  return (
    /^R\d+$/.test(String(v.id)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(v.date)) &&
    isStr(v.change) &&
    isStr(v.commit) &&
    isNum(v.n) &&
    v.n === v.questions.length &&
    isEstimate(v.metrics.recall5) &&
    isEstimate(v.metrics.mrr) &&
    isStr(v.setup.chunking) &&
    isNum(v.setup.topK) &&
    isStr(v.setup.embedModel) &&
    isNum(v.tokens) &&
    isNum(v.costUsd) &&
    isNum(v.durationS) &&
    v.questions.every(isQuestion)
  );
}

/** Throws (failing the build) if the file doesn't match what the script writes. */
export function parseRuns(data: unknown): RealRun[] {
  if (!Array.isArray(data)) throw new Error("dyno-runs.json must be a list of runs");
  data.forEach((run, i) => {
    if (!isRun(run)) throw new Error(`dyno-runs.json: run ${i + 1} doesn't match the Dyno script's shape`);
  });
  return data as RealRun[];
}

/** Every recorded run, oldest first (run 1 is the baseline). */
export const REAL_RUNS: RealRun[] = parseRuns(raw);

// ---------- Display helpers ----------

/** Questions whose right page landed in the top k. */
export const hitsAt = (run: RealRun, k: number) => run.questions.filter((q) => q.rank !== null && q.rank <= k).length;

/** "2026-11-22" → "Nov 22, 2026". Built from the parts, not `new Date(iso)`, which reads a
 * bare date as UTC midnight and shows the day before in Toronto. */
export function formatRunDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return withYear ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

/** A 0–1 score with two decimals, e.g. "0.76". */
export const f2 = (v: number) => v.toFixed(2);

/**
 * The bootstrap can't measure spread when every question scores the same (all hits:
 * every resample is all hits too), so the "interval" collapses to one point. Say so
 * instead of showing "1.00–1.00" as if it were certainty (Q101).
 */
export const collapsed = (e: Estimate) => e.low === e.high;

/**
 * Rule of three: with 0 misses in n questions, a 95% upper bound on the miss rate is
 * about 3/n, so recall could still be as low as 1 − 3/n (0.85 for 20 questions).
 */
export const ruleOfThreeFloor = (n: number) => Math.max(0, 1 - 3 / n);

/** "Erickson_Ch8_ShortestPaths.pdf" → "Ch 8". */
export function chapterOf(file: string): string {
  const m = /_Ch(\d+)_/.exec(file);
  return m ? `Ch ${m[1]}` : file;
}

/** The chapter a golden question is about, from its id prefix (see dyno/golden.toml). */
const QUESTION_CHAPTER: Record<string, string> = { rec: "Ch 1", dp: "Ch 3", greedy: "Ch 4", sssp: "Ch 8" };
export const questionChapter = (id: string) => QUESTION_CHAPTER[id.split("-")[0]] ?? "—";

/** Commit link for a run's Details (the repo is public). */
export const commitUrl = (sha: string) => `https://github.com/AmaanAli1/recall/commit/${sha}`;

/** Where the questions themselves live. */
export const GOLDEN_URL = "https://github.com/AmaanAli1/recall/blob/main/dyno/golden.toml";
