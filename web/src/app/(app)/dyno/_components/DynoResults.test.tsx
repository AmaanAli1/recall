import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REAL_RUNS, type RealRun } from "@/lib/dyno-results";
import { DynoResults } from "./DynoResults";

afterEach(cleanup);

/** The rank summary is split into one span per group, so match the paragraph's whole text. */
const summary = (text: string) => screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text);

/** Run 1 with some ranks changed, so every rank style is on screen. */
function variant(ranks: Record<string, number | null>, recall = REAL_RUNS[0].metrics.recall5): RealRun {
  const r = structuredClone(REAL_RUNS[0]);
  r.metrics.recall5 = recall;
  r.questions = r.questions.map((q) => (q.id in ranks ? { ...q, rank: ranks[q.id] } : q));
  return r;
}

describe("DynoResults (real runs, v0)", () => {
  it("shows run 1 as the baseline with only the metrics v0 measures", () => {
    render(<DynoResults runs={REAL_RUNS.slice(0, 1)} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Run 1: the baseline.");
    const scores = screen.getByRole("region", { name: "Latest run's scores" });
    expect(within(scores).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Recall@5",
      "MRR",
      "Faithfulness",
      "Answer relevancy",
    ]);
    // 20/20 with no fake certainty: the collapsed interval is explained instead.
    expect(within(scores).getByText("20 of 20 questions")).toBeInTheDocument();
    expect(within(scores).getByText(/the 95% interval can’t be measured\. 20\/20 still allows a true recall as low as 0\.85/)).toBeInTheDocument();
    expect(within(scores).queryByText(/1\.00–1\.00/)).not.toBeInTheDocument();
    // MRR with its interval.
    expect(within(scores).getByText("0.76")).toBeInTheDocument();
    expect(within(scores).getByText("95% interval 0.63–0.89")).toBeInTheDocument();
    // Nothing invented for what v0 doesn't measure.
    expect(within(scores).getAllByText("Not measured yet")).toHaveLength(2);
  });

  it("shows a real recall interval when it didn't collapse", () => {
    render(<DynoResults runs={[variant({ "rec-01": 7 }, { value: 0.95, low: 0.85, high: 1 })]} />);
    const scores = screen.getByRole("region", { name: "Latest run's scores" });
    expect(within(scores).getByText("19 of 20 questions")).toBeInTheDocument();
    expect(within(scores).getByText("95% interval 0.85–1.00")).toBeInTheDocument();
    expect(within(scores).queryByText(/can’t be measured/)).not.toBeInTheDocument();
  });

  it("has no Run Dyno button: runs come from the command line", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    expect(screen.queryByRole("button", { name: /Run Dyno/ })).not.toBeInTheDocument();
  });

  it("opens a run's setup, with its commit linked on GitHub", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    const toggle = screen.getByRole("button", { name: "Show details for run 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide details for run 1" })).toHaveAttribute("aria-expanded", "true");
    const commit = screen.getByRole("link", { name: REAL_RUNS[0].commit });
    expect(commit).toHaveAttribute("href", `https://github.com/AmaanAli1/recall/commit/${REAL_RUNS[0].commit}`);
    expect(within(document.getElementById("det-R1")!).getByText(REAL_RUNS[0].setup.embedModel)).toBeInTheDocument();
  });

  it("lists every question's rank: first plain, lower ones flagged, misses called out", () => {
    render(<DynoResults runs={[variant({ "rec-01": 1, "rec-02": 3, "rec-03": 7, "rec-04": null })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Show all 20 questions" }));
    const table = screen.getByRole("group", { name: "Question ranks table" });
    const rows = within(table).getAllByRole("row").slice(1); // minus the header
    expect(rows).toHaveLength(20);
    const rowOf = (id: string) => rows.find((r) => within(r).queryByRole("rowheader", { name: id }))!;
    expect(rowOf("rec-01")).toHaveTextContent("1st");
    expect(rowOf("rec-02")).toHaveTextContent("3rd");
    expect(rowOf("rec-03")).toHaveTextContent("7th");
    expect(rowOf("rec-04")).toHaveTextContent("Not in top 10");
    // The chapter is the question's own, not whatever chapter the top hit came from.
    expect(rowOf("rec-04")).toHaveTextContent(/^rec-04Ch 1/);
  });

  it("names a question's own chapter even when its top hit is from another one", () => {
    const run = variant({});
    run.questions[0] = { ...run.questions[0], top: [{ file: "Erickson_Ch8_ShortestPaths.pdf", page: 3, score: 0.4 }] };
    render(<DynoResults runs={[run]} />);
    const row = within(screen.getByRole("group", { name: "Question ranks table" })).getByRole("rowheader", { name: "rec-01" }).closest("tr")!;
    expect(row).toHaveTextContent(/^rec-01Ch 1/); // the Chapter column
    expect(row).toHaveTextContent("Ch 8 p. 3 · 0.40"); // the Top result column
  });

  it("keeps the 20-row ranks table collapsed behind a summary until asked", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    // Run 1's ranks, best first.
    expect(summary("12 × 1st · 5 × 2nd · 1 × 3rd · 2 × 5th")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Show all 20 questions" });
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("inert"); // out of the tab order and the accessibility tree
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide the questions" })).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("inert");
    expect(within(panel).getAllByRole("rowheader")).toHaveLength(20);
  });

  it("counts misses in the summary too", () => {
    render(<DynoResults runs={[variant({ "rec-01": null, "rec-02": 7 })]} />);
    expect(summary("10 × 1st · 5 × 2nd · 1 × 3rd · 2 × 5th · 1 × 7th · 1 × not in top 10")).toBeInTheDocument();
  });

  it("links to the golden set's questions", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    render(<DynoResults runs={REAL_RUNS.slice(0, 1)} />);
    cleanup();
    render(<DynoResults runs={REAL_RUNS} />);
    // Run 2 adds 8 follow-ups and 5 off-topic questions to the 20.
    expect(screen.getByRole("link", { name: /See all 33 questions/ })).toHaveAttribute(
      "href",
      "https://github.com/AmaanAli1/recall/blob/main/dyno/golden.toml",
    );
  });

});

describe("DynoResults: run 2 (follow-ups and off-topic, committed)", () => {
  const run2 = REAL_RUNS.find((r) => r.id === "R2")!;

  it("names the change, and says the core numbers match run 1", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Run 2: Query rewriting + follow-ups + off-topic");
    expect(screen.getByText(/plus 8 follow-ups and 5 off-topic questions, each group scored on its own/)).toBeInTheDocument();
    const scores = screen.getByRole("region", { name: "Latest run's scores" });
    expect(within(scores).getByText("Same as run 1 (20/20)")).toBeInTheDocument();
    expect(within(scores).getByText("Same as run 1 (0.76)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Where each right page ranked (core questions)" })).toBeInTheDocument();
  });

  it("shows the follow-ups before and after rewriting, with every question's wording", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    const section = screen.getByRole("region", { name: "Follow-up questions: query rewriting" });
    expect(within(section).getByText("3 of 8 as typed, 8 of 8 rewritten")).toBeInTheDocument();
    expect(within(section).getByText("0.20 as typed, 0.92 rewritten")).toBeInTheDocument();
    expect(within(section).getByText("As typed: 95% interval 0.07–0.35")).toBeInTheDocument();
    const rows = within(within(section).getByRole("group", { name: "Follow-up questions table" })).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(8);
    const fu01 = rows[0];
    expect(fu01).toHaveTextContent("How does quicksort work?");
    expect(fu01).toHaveTextContent("Why can it take quadratic time?");
    expect(fu01).toHaveTextContent("Why can quicksort take quadratic time?");
    expect(fu01).toHaveTextContent(/Not in top 101st$/); // as typed: miss → rewritten: first
    expect(within(section).getByText(/only 8: real follow-ups are messier/)).toBeInTheDocument();
  });

  it("shows which off-topic questions retrieval turned away, and the overlap honestly", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    const section = screen.getByRole("region", { name: "Off-topic questions: does it say “not found”?" });
    const rows = within(section).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell").at(-1)!.textContent)).toEqual([
      "Not found",
      "Not found",
      "Not found",
      "Would answer",
      "Would answer",
    ]);
    expect(rows[4]).toHaveTextContent("How do I rebalance a red-black tree after an insertion?");
    expect(rows[4]).toHaveTextContent("Ch 3 p. 49 · 0.53");
    // What we found when we looked: notes under the two that got through.
    expect(rows[3]).toHaveTextContent("politicians shaking hands");
    expect(rows[4]).toHaveTextContent("chapter 3's exercises define red-black trees");
    expect(rows[0]).not.toHaveTextContent(/chapter|puzzle/);
    expect(within(section).getByText(/strongest off-topic match scored 0\.53; the weakest real question’s best match scored 0\.52/)).toBeInTheDocument();
    expect(within(section).getByText(/They overlap, so no single similarity threshold can separate them/)).toBeInTheDocument();
    expect(within(section).getByText(/Dyno doesn’t measure that step yet/)).toBeInTheDocument();
  });

  it("says when a threshold would separate them, without the second-guard note", () => {
    const apart = structuredClone(run2);
    apart.offTopic = { ...apart.offTopic!, highestScore: 0.3, lowestCoreScore: 0.52 };
    render(<DynoResults runs={[REAL_RUNS[0], apart]} />);
    expect(screen.getByText(/A threshold between those two would separate them\./)).toBeInTheDocument();
    expect(screen.queryByText(/second guard/)).not.toBeInTheDocument();
  });

  it("a run without follow-ups or off-topic shows neither section", () => {
    render(<DynoResults runs={REAL_RUNS.slice(0, 1)} />);
    expect(screen.queryByRole("region", { name: /Follow-up questions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Off-topic/ })).not.toBeInTheDocument();
  });

  it("lists the rewrite tokens and the extra questions in the run's details", () => {
    render(<DynoResults runs={REAL_RUNS} />);
    fireEvent.click(screen.getByRole("button", { name: "Show details for run 2" }));
    const details = document.getElementById("det-R2")!;
    expect(details).toHaveTextContent(`${run2.tokens} embedding tokens + ${run2.rewriteTokens} rewrite tokens, under $0.01`);
    expect(details).toHaveTextContent("20 core questions, page-labelled; 8 follow-ups; 5 off-topic");
    expect(details).toHaveTextContent("gpt-5.4-mini, follow-ups only");
  });
});
