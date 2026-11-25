import { describe, expect, it } from "vitest";
import { DYNO_RUNS } from "@/lib/api/mock-data";
import { dynoGlance } from "./AskWorkspace";

describe("the Ask glance card's Dyno line", () => {
  it("shows the latest real run, logged (v0 has no gate), when there are no sample runs", () => {
    // Run 2 (Nov 25): core recall unchanged at 20/20.
    expect(dynoGlance([], true)).toEqual({ recall: 1, gate: "logged", run: { id: "R2", date: "Nov 25" } });
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
