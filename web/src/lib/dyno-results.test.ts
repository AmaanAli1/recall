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
