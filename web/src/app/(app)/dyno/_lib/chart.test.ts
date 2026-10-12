import { describe, expect, it } from "vitest";
import type { DynoRun } from "@/lib/api";
import {
  areaPath,
  bandPath,
  baselineTick,
  errorBar,
  gaugeArc,
  gaugeTicks,
  linePoints,
  liveEstimate,
  needleRotation,
  polar,
  stepOf,
  tooltipOrigin,
  xScale,
  yScale,
} from "./chart";
import { estimateOf, formatDuration, gateOf, nextRunId, stageIndex, upsertRun } from "./model";

describe("gauge geometry", () => {
  it("places 0 at lower left, 0.5 at the top and 1 at lower right", () => {
    expect(gaugeArc(0, 0.5, 80)).toBe("M30.7 140 A80 80 0 0 1 100 20");
    expect(gaugeArc(0.5, 1, 80)).toBe("M100 20 A80 80 0 0 1 169.3 140");
  });
  it("uses the large-arc flag once the arc passes 180°", () => {
    expect(gaugeArc(0, 0.7, 80)).toContain(" 0 0 1 ");
    expect(gaugeArc(0, 0.8, 80)).toContain(" 0 1 1 ");
  });
  it("clamps scores outside 0–1", () => {
    expect(gaugeArc(0, 1.4, 80)).toBe(gaugeArc(0, 1, 80));
    expect(needleRotation(-1)).toBe(-120);
  });
  it("draws 21 ticks", () => {
    expect(gaugeTicks().match(/M/g)).toHaveLength(21);
  });
  it("points the needle straight up at 0.5", () => {
    expect(needleRotation(0.5)).toBe(0);
    expect(needleRotation(0.86)).toBe(86.4);
  });
  it("puts the baseline tick on the dial angle", () => {
    expect(baselineTick(0.5)).toEqual({ x1: 100, y1: 12, x2: 100, y2: 28 });
    expect(polar(0, 10)).toEqual([110, 100]);
  });
});

describe("chart scales", () => {
  it("maps the 0.5–1.0 range onto the plot", () => {
    expect(yScale(0.5)).toBe(240);
    expect(yScale(1)).toBe(24);
    expect(yScale(0.75)).toBe(132);
  });
  it("spreads runs across 600 px", () => {
    expect(stepOf(5)).toBe(150);
    expect(xScale(4, 5)).toBe(680);
    expect(xScale(0, 1)).toBe(80);
    expect(stepOf(1)).toBe(600);
  });
  it("clamps error bars and the band to the chart range", () => {
    expect(errorBar(100, 0.98, 0.05)).toBe("M95 24 H105 M100 24 V54.2 M95 54.2 H105");
    const band = bandPath([
      { x: 80, v: 0.72, h: 0.1 },
      { x: 680, v: 0.86, h: 0.08 },
    ]);
    expect(band).toBe("M80 101.8 L680 49.9 L680 119 L80 188.2 Z");
    expect(bandPath([])).toBe("");
  });
  it("builds the line and the area from the same points", () => {
    const pts = [
      { x: 80, y: 120 },
      { x: 680, y: 60 },
    ];
    expect(linePoints(pts)).toBe("80,120 680,60");
    expect(areaPath(pts)).toBe("M80 240 L80 120 L680 60 L680 240 Z");
  });
  it("flips the tooltip left past the middle and keeps it inside the plot", () => {
    expect(tooltipOrigin({ x: 80, y: 10 })).toEqual({ x: 94, y: 8 });
    expect(tooltipOrigin({ x: 680, y: 230 })).toEqual({ x: 490, y: 140 });
  });
});

describe("live estimate", () => {
  it("wobbles early and settles on the anchor when every question is in", () => {
    expect(liveEstimate(0.86, 80, 80, 0.3)).toBe(0.86);
    expect(liveEstimate(0.86, 10, 80, 0.3)).not.toBe(0.86);
  });
  it("is deterministic and stays in range", () => {
    expect(liveEstimate(0.5, 12, 80, 1.7)).toBe(liveEstimate(0.5, 12, 80, 1.7));
    expect(liveEstimate(0.99, 2, 80, 1.57)).toBeLessThanOrEqual(0.99);
  });
});

const run = (id: string, faith: number): DynoRun => ({
  id,
  date: "Oct 1",
  change: "x",
  short: "x",
  metrics: { recall: 0.8, mrr: 0.7, faith, correct: 0.8, relev: 0.8 },
  p95: 1,
  n: 80,
});

describe("run model", () => {
  const base = run("R8", 0.87);
  it("gates on the redline (baseline − 0.02)", () => {
    expect(gateOf(base, base)).toBe("base");
    expect(gateOf(run("R9", 0.83), base)).toBe("fail");
    expect(gateOf(run("R10", 0.85), base)).toBe("pass");
  });
  it("names the next run and replaces a re-delivered one", () => {
    const runs = [base, run("R12", 0.9)];
    expect(nextRunId(runs)).toBe("R13");
    expect(upsertRun(runs, run("R12", 0.8))[1].metrics.faith).toBe(0.8);
    expect(upsertRun(runs, run("R13", 0.8))).toHaveLength(3);
  });
  it("maps stream stages to the panel's steps", () => {
    expect(stageIndex("retrieve")).toBe(0);
    expect(stageIndex("gate")).toBe(3);
    expect(stageIndex("done")).toBe(4);
  });
  it("estimates from the anchor run", () => {
    expect(estimateOf(base, "faith", 80, 80)).toBe(0.87);
  });
  it("formats durations", () => {
    expect(formatDuration(5200)).toBe("5 s");
    expect(formatDuration(252000)).toBe("4 min 12 s");
  });
});
