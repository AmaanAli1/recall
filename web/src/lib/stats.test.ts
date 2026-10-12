import { describe, expect, it } from "vitest";
import { ci95, diffNoise, redline, signed, verdict } from "./stats";

describe("ci95", () => {
  it("matches the normal approximation for 80 questions", () => {
    expect(ci95(0.8, 80)).toBeCloseTo(0.0877, 3);
  });
  it("is widest at p = 0.5 and zero at the extremes", () => {
    expect(ci95(0.5, 80)).toBeGreaterThan(ci95(0.9, 80));
    expect(ci95(1, 80)).toBe(0);
  });
  it("narrows as more questions are evaluated", () => {
    expect(ci95(0.8, 20)).toBeGreaterThan(ci95(0.8, 80));
  });
});

describe("verdict", () => {
  it("calls the reranker's Recall@5 gain over baseline real", () => {
    expect(verdict(0.86, 0.72, 80)).toBe("gain");
  });
  it("calls a +0.02 change on 80 questions noise", () => {
    expect(verdict(0.88, 0.86, 80)).toBe("noise");
  });
  it("detects a real drop", () => {
    expect(verdict(0.6, 0.85, 80)).toBe("drop");
  });
  it("uses the combined interval of both runs", () => {
    expect(diffNoise(0.8, 0.8, 80)).toBeCloseTo(Math.SQRT2 * ci95(0.8, 80), 6);
  });
});

describe("formatting", () => {
  it("uses a real minus sign", () => {
    expect(signed(-0.04)).toBe("−0.04");
    expect(signed(0.05)).toBe("+0.05");
    expect(signed(0)).toBe("±0.00");
  });
  it("puts the redline 0.02 below the baseline", () => {
    expect(redline(0.87)).toBe(0.85);
  });
});
