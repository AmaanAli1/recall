/**
 * Dyno domain helpers shared by the components: labels, the redline gate and
 * the live run's derived state. Pure functions so they are easy to test.
 */
import type { DynoProgress, DynoRun, MetricKey } from "@/lib/api";
import { redline } from "@/lib/stats";
import { liveEstimate } from "./chart";

export const KEYS: MetricKey[] = ["recall", "mrr", "faith", "correct", "relev"];

export const LABEL: Record<MetricKey, string> = {
  recall: "Recall@5",
  mrr: "MRR",
  faith: "Faithfulness",
  correct: "Correctness",
  relev: "Answer relevancy",
};

/** Metrics with a chart tab. Relevancy is gauge/table only, as designed. */
export type ChartMetric = "recall" | "mrr" | "faith" | "correct";
export const CHART_METRICS: ChartMetric[] = ["recall", "mrr", "faith", "correct"];
export const GAUGE_METRICS: MetricKey[] = ["recall", "mrr", "faith", "relev"];
export const ESTIMATE_METRICS: ChartMetric[] = ["recall", "mrr", "faith", "correct"];

export const f2 = (v: number) => v.toFixed(2);

export type Gate = "base" | "pass" | "fail";

/** The baseline gates nothing; any other run fails if one metric dips into the redline. */
export function gateOf(run: DynoRun, base: DynoRun): Gate {
  if (run.id === base.id) return "base";
  return failedMetrics(run, base).length > 0 ? "fail" : "pass";
}

export function failedMetrics(run: DynoRun, base: DynoRun): MetricKey[] {
  return KEYS.filter((k) => run.metrics[k] < redline(base.metrics[k]));
}

/** "R12" → 12. Used for "Run 12" copy. */
export const runNum = (id: string) => id.replace(/^R/i, "");

/** Id the next run will get, so the UI can label it before the backend reports back. */
export function nextRunId(runs: DynoRun[]): string {
  const max = runs.reduce((m, r) => Math.max(m, Number(runNum(r.id)) || 0), 0);
  return `R${max + 1}`;
}

/** Fixed phase offsets so each metric wobbles differently. */
const SEED: Record<MetricKey, number> = { recall: 0.3, mrr: 1.7, faith: 2.9, correct: 4.1, relev: 5.3 };

/** "So far" estimate for one metric, anchored on the latest finished run. */
export function estimateOf(anchor: DynoRun, k: MetricKey, done: number, total: number): number {
  return liveEstimate(anchor.metrics[k], done, total, SEED[k]);
}

/** The interval is computed as if at least 4 questions were in, so it never starts absurdly wide. */
export const liveN = (done: number) => Math.max(done, 4);

/** What the chart, gauges and table need to draw the in-flight run as a dashed "ghost". */
export interface LiveView {
  id: string;
  date: string;
  done: number;
  total: number;
  /** Questions to size the interval with (see liveN). */
  n: number;
  est: (k: MetricKey) => number;
}

/** The most recent run started from this page (kept after it ends so the panel can show its summary). */
export interface RunState {
  id: string;
  date: string;
  progress: DynoProgress;
  status: "running" | "cancelled" | "done";
  /** The run the backend delivered on done. */
  finished: DynoRun | null;
  elapsedMs: number;
  /** Latest finished run when this one started: the estimates wobble around it. */
  anchor: DynoRun;
}

/** A/B role of a run in the open compare panel. */
export type Role = "A" | "B" | null;

/** Join class names, skipping falsy ones. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Pipeline stages, and which one is current (4 = all done). */
export const STAGES = ["Retrieve passages", "Generate answers", "Judge answers", "Check the redline"] as const;

export function stageIndex(stage: DynoProgress["stage"] | undefined): number {
  switch (stage) {
    case "generate":
      return 1;
    case "judge":
      return 2;
    case "gate":
      return 3;
    case "done":
      return 4;
    default:
      return 0;
  }
}

/** Insert a run, or replace one with the same id (the mock returns the same run every time). */
export function upsertRun(runs: DynoRun[], run: DynoRun): DynoRun[] {
  const i = runs.findIndex((r) => r.id === run.id);
  if (i < 0) return [...runs, run];
  const copy = runs.slice();
  copy[i] = run;
  return copy;
}

/** "4 min 12 s" / "5 s". */
export function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}
