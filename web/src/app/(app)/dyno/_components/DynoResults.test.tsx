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
    render(<DynoResults runs={REAL_RUNS} />);
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
    expect(screen.getByText(REAL_RUNS[0].setup.embedModel)).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /See the 20 questions/ })).toHaveAttribute(
      "href",
      "https://github.com/AmaanAli1/recall/blob/main/dyno/golden.toml",
    );
  });
});
