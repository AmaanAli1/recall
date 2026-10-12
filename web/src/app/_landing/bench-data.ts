/**
 * Dyno numbers for the landing page's marketing sections (the receipt and the bench).
 * This is static showcase content, so it reads the same sample runs the mock API serves
 * instead of calling the API: the page stays static and the numbers can't drift apart.
 */
import { DYNO_RUNS } from "@/lib/api/mock-data";

/** A run may sit at most this far below the baseline before Dyno blocks the merge. */
export const REDLINE_GAP = 0.02;

export type BenchMetric = "recall" | "faith";
export const BENCH_METRICS: Record<BenchMetric, { name: string; label: string }> = {
  recall: { name: "recall@5", label: "Recall@5" },
  faith: { name: "faithfulness", label: "Faithfulness" },
};

export type Gate = "base" | "pass" | "fail";

export interface BenchRun {
  /** Numeric run id for display ("Run 12"). */
  id: number;
  date: string;
  change: string;
  recall: number;
  faith: number;
  /** p95 latency, formatted ("1.9 s"). */
  p95: string;
  gate: Gate;
  /** The metric that crossed its redline, when the gate failed. */
  failed?: BenchMetric;
}

const base = DYNO_RUNS[0];
export const redlineOf = (m: BenchMetric) => +(base.metrics[m] - REDLINE_GAP).toFixed(2);
export const baselineOf = (m: BenchMetric) => base.metrics[m];

export const BENCH_RUNS: BenchRun[] = DYNO_RUNS.map((r, i) => {
  const failed = i === 0 ? undefined : (["faith", "recall"] as const).find((m) => r.metrics[m] < redlineOf(m));
  return {
    id: Number(r.id.replace(/\D/g, "")),
    date: r.date,
    change: r.change,
    recall: r.metrics.recall,
    faith: r.metrics.faith,
    p95: `${r.p95.toFixed(1)} s`,
    gate: i === 0 ? "base" : failed ? "fail" : "pass",
    failed,
  };
});

/** Signed difference with a real minus sign, e.g. "+0.14" / "−0.04". */
export const delta = (x: number, b: number, digits = 2) => (x - b >= 0 ? "+" : "−") + Math.abs(x - b).toFixed(digits);

type Tone = "good" | "mid" | "bad";

/** The latest run against the baseline, for the "Dyno printout" receipt. */
const latest = DYNO_RUNS[DYNO_RUNS.length - 1];
export const RECEIPT = {
  run: Number(latest.id.replace(/\D/g, "")),
  date: latest.date,
  rows: [
    { k: "recall@5", key: "recall" as const },
    { k: "mrr", key: "mrr" as const },
    { k: "faithfulness", key: "faith" as const },
    { k: "relevancy", key: "relev" as const },
  ].map(({ k, key }) => ({
    k,
    v: latest.metrics[key].toFixed(2),
    d: delta(latest.metrics[key], base.metrics[key]),
    // Quality metrics: higher is better.
    tone: (latest.metrics[key] >= base.metrics[key] ? "good" : "bad") as Tone,
  })),
  latency: {
    v: `${latest.p95.toFixed(1)} s`,
    d: `${delta(latest.p95, base.p95, 1)} s`,
    // Slower isn't a failure, but it's worth flagging in amber.
    tone: (latest.p95 > base.p95 ? "mid" : "good") as Tone,
  },
} as const;
