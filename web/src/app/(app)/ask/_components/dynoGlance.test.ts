import { describe, expect, it } from "vitest";
import { DYNO_RUNS } from "@/lib/api/mock-data";
import { dynoGlance } from "./AskWorkspace";

describe("the Ask glance card's Dyno line", () => {
  it("shows the real run 1 as the baseline when there are no sample runs", () => {
    expect(dynoGlance([], true)).toEqual({ recall: 1, gate: "baseline", run: { id: "R1", date: "Nov 22" } });
  });

  it("prefers the sample runs when a test opts into them", () => {
    const g = dynoGlance(DYNO_RUNS, true);
    expect(g.run?.id).toBe(DYNO_RUNS.at(-1)?.id);
    expect(g.recall).toBe(DYNO_RUNS.at(-1)?.metrics.recall);
    expect(g.gate).toBe("clear");
  });

  it("shows nothing for courses outside the golden set", () => {
    expect(dynoGlance([], false)).toEqual({ recall: null, gate: "baseline", run: null });
  });
});
