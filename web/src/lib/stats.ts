/**
 * Small statistics helpers for Dyno.
 *
 * The UI approximates a 95% interval with the normal approximation
 * 1.96·√(p(1−p)/n). The real backend computes bootstrap intervals and sends
 * them; these helpers keep the mock honest and are unit-tested.
 */

/** Half-width of the 95% confidence interval for a proportion p over n items. */
export function ci95(p: number, n: number): number {
  if (n <= 0) return 1;
  const q = Math.min(1, Math.max(0, p));
  return 1.96 * Math.sqrt((q * (1 - q)) / n);
}

/**
 * Half-width of the 95% interval for the difference between two independent
 * proportions. A change bigger than this is called "real", otherwise "noise".
 */
export function diffNoise(a: number, b: number, nA: number, nB = nA): number {
  return 1.96 * Math.sqrt((a * (1 - a)) / nA + (b * (1 - b)) / nB);
}

export type Verdict = "gain" | "drop" | "noise";

export function verdict(a: number, b: number, nA: number, nB = nA): Verdict {
  const d = a - b;
  if (Math.abs(d) <= diffNoise(a, b, nA, nB)) return "noise";
  return d > 0 ? "gain" : "drop";
}

/** Signed delta with a real minus sign: "+0.05", "−0.04", "±0.00". */
export function signed(d: number, digits = 2): string {
  const r = Number(d.toFixed(digits));
  const sign = r > 0 ? "+" : r < 0 ? "−" : "±";
  return sign + Math.abs(r).toFixed(digits);
}

/** The redline: baseline − 0.02. A run below it fails the gate. */
export function redline(baseline: number): number {
  return Number((baseline - 0.02).toFixed(2));
}
