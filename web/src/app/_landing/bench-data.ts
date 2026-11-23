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
