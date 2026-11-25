import { describe, expect, it } from "vitest";
import raw from "@/data/dyno-runs.json";
import {
  REAL_RUNS,
  chapterOf,
  collapsed,
  commitUrl,
  formatRunDate,
  hitsAt,
  parseRuns,
  questionChapter,
  ruleOfThreeFloor,
  type RealRun,
} from "./dyno-results";

/** A deep copy of the committed run 1, to break one field at a time. */
const run1 = (): Record<string, unknown> => JSON.parse(JSON.stringify(raw[0]));

describe("the committed dyno-runs.json", () => {
  it("matches the shape the Dyno script writes", () => {
    // This is the contract test between api/…/dyno_run.py and the page.
    expect(() => parseRuns(raw)).not.toThrow();
    expect(REAL_RUNS.length).toBeGreaterThanOrEqual(1);
  });

  it("run 2 keeps the core 20 and adds 8 follow-ups and 5 off-topic questions", () => {
    const second = REAL_RUNS[1];
    expect(second.id).toBe("R2");
    expect(second.n).toBe(20);
    expect(second.followUps?.questions.map((q) => q.id)).toEqual(["fu-01", "fu-02", "fu-03", "fu-04", "fu-05", "fu-06", "fu-07", "fu-08"]);
    expect(second.offTopic?.questions.map((q) => q.id)).toEqual(["off-01", "off-02", "off-03", "off-04", "off-05"]);
  });

  it("starts with run 1, the baseline: 20 questions, one result each", () => {
    const [first] = REAL_RUNS;
    expect(first.id).toBe("R1");
    expect(first.change).toBe("Baseline");
    expect(first.n).toBe(20);
    expect(first.questions).toHaveLength(20);
    expect(new Set(first.questions.map((q) => q.id)).size).toBe(20);
  });
});

describe("parseRuns", () => {
  it("refuses a file that isn't a list of runs", () => {
    expect(() => parseRuns(run1())).toThrow("must be a list");
  });

  it.each([
    ["n that doesn't match the questions", () => ({ ...run1(), n: 19 })],
    ["a missing metric", () => ({ ...run1(), metrics: { recall5: (raw[0] as RealRun).metrics.recall5 } })],
    ["an interval that doesn't contain its value", () => ({ ...run1(), metrics: { ...(raw[0] as RealRun).metrics, mrr: { value: 0.9, low: 0.1, high: 0.5 } } })],
    ["rank 0 (ranks start at 1)", () => ({ ...run1(), questions: [{ id: "x", rank: 0, top: [] }, ...(raw[0] as RealRun).questions.slice(1)] })],
    ["a date that isn't a day", () => ({ ...run1(), date: "Nov 22" })],
    ["an id that isn't R<number>", () => ({ ...run1(), id: "run-1" })],
  ])("refuses %s", (_label, make) => {
    expect(() => parseRuns([make()])).toThrow("doesn't match the Dyno script's shape");
  });

  const run2 = (): Record<string, unknown> => JSON.parse(JSON.stringify(raw[1]));
  type Run2 = Required<RealRun>;

  it.each([
    ["follow-ups whose n doesn't match the list", (r: Run2) => void (r.followUps.n = 7)],
    ["a follow-up rank of 0", (r: Run2) => void (r.followUps.questions[0].rankAsTyped = 0)],
    ["a follow-up without both metrics", (r: Run2) => void delete (r.followUps.asTyped as Partial<Run2["followUps"]["asTyped"]>).mrr],
    ["an off-topic count that disagrees with the questions", (r: Run2) => void (r.offTopic.notFound = 4)],
    ["an off-topic question without its verdict", (r: Run2) => void delete (r.offTopic.questions[0] as Partial<Run2["offTopic"]["questions"][0]>).notFound],
    ["rewrite tokens that aren't a number", (r: Run2) => void ((r as unknown as Record<string, unknown>).rewriteTokens = "2055")],
  ])("refuses run 2 with %s", (_label, breakIt) => {
    const r = run2() as unknown as Run2;
    breakIt(r);
    expect(() => parseRuns([raw[0], r])).toThrow("run 2 doesn't match the Dyno script's shape");
  });

  it("accepts a miss (rank null)", () => {
    const r = run1() as unknown as RealRun;
    r.questions[0] = { ...r.questions[0], rank: null };
    expect(() => parseRuns([r])).not.toThrow();
  });
});

describe("display helpers", () => {
  const withRanks = (ranks: (number | null)[]) =>
    ({ n: ranks.length, questions: ranks.map((rank, i) => ({ id: `q${i}`, rank, top: [] })) }) as unknown as RealRun;

  it("hitsAt counts ranks up to and including k, never misses", () => {
    const run = withRanks([1, 5, 6, null, 2]);
    expect(hitsAt(run, 5)).toBe(3);
    expect(hitsAt(run, 1)).toBe(1);
    expect(hitsAt(run, 10)).toBe(4);
  });

  it("formats an ISO day without shifting it a day (no UTC parsing)", () => {
    // `new Date("2026-11-22")` is UTC midnight, which is Nov 21 in Toronto: test there.
    const tz = process.env.TZ;
    process.env.TZ = "America/Toronto";
    try {
      expect(formatRunDate("2026-11-22")).toBe("Nov 22, 2026");
      expect(formatRunDate("2026-01-01", false)).toBe("Jan 1");
    } finally {
      process.env.TZ = tz;
    }
  });

  it("knows when the bootstrap interval collapsed, and the rule-of-three floor", () => {
    expect(collapsed({ value: 1, low: 1, high: 1 })).toBe(true);
    expect(collapsed({ value: 0.76, low: 0.63, high: 0.89 })).toBe(false);
    expect(ruleOfThreeFloor(20)).toBeCloseTo(0.85);
    expect(ruleOfThreeFloor(2)).toBe(0);
  });

  it("names chapters from file names and question ids", () => {
    expect(chapterOf("Erickson_Ch8_ShortestPaths.pdf")).toBe("Ch 8");
    expect(chapterOf("notes.pdf")).toBe("notes.pdf");
    expect(questionChapter("greedy-03")).toBe("Ch 4");
    expect(questionChapter("dp-01")).toBe("Ch 3");
    expect(questionChapter("os-01")).toBe("—");
  });

  it("links a run's commit on GitHub", () => {
    expect(commitUrl("8b05c0d")).toBe("https://github.com/AmaanAli1/recall/commit/8b05c0d");
  });
});
