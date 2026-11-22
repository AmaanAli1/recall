import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Answer } from "@/lib/api";
import { AnswerSheet } from "./AnswerSheet";
import { SourcesPane } from "./SourcesPane";

afterEach(cleanup);

const noop = () => {};
const base = {
  answer: null,
  pendingQ: "",
  seq: 0,
  docCount: 4,
  courseName: "Algorithms",
  starters: [{ id: "dj", question: "Why does Dijkstra fail with negative edges?" }],
  picked: 1,
  hover: 0,
  showTiming: true,
  onAsk: noop,
  onRetry: noop,
  onPick: noop,
  onPeek: noop,
  onFollowUp: noop,
};

const answer = (extra: Partial<Answer> = {}): Answer => ({
  question: "Why does Dijkstra fail?",
  courseId: "c",
  claims: ["It assumes no negative edges"],
  sources: [{ n: 1, file: "Erickson_Ch8_ShortestPaths.pdf", page: 17, score: 0.67, pre: "", hit: "x", post: "" }] as Answer["sources"],
  dropped: [],
  timing: { embed: 0.4, search: 0.1, rerank: 0, generate: 2.1 },
  followUps: [],
  ...extra,
});

describe("AnswerSheet", () => {
  it("leaves steps that took no time out of the timing bar", () => {
    render(<AnswerSheet {...base} view="answer" answer={answer()} />);
    const bar = screen.getByRole("group", { name: "Time spent per step" });
    // There's no reranker yet, so rerank's 0 s would be a 0-wide segment with a label on top of its neighbours.
    expect(within(bar).queryByText(/rerank/)).not.toBeInTheDocument();
    expect(within(bar).getByText(/generate/)).toBeInTheDocument();
  });

  it("fills the whole timing bar even when the answer took under a second", () => {
    const fast = answer({ timing: { embed: 0.3, search: 0.2, rerank: 0, generate: 0 } });
    render(<AnswerSheet {...base} view="answer" answer={fast} />);
    const bar = screen.getByRole("group", { name: "Time spent per step" }).firstElementChild as HTMLElement;
    // flex-grow values adding up to under 1 leave part of the bar empty.
    const grow = Array.from(bar.children).reduce((n, el) => n + parseFloat((el as HTMLElement).style.flex), 0); // "0.6 1 0%" → 0.6
    expect(grow).toBeCloseTo(1);
  });

  it("answers 'not found' in words, with no citations", () => {
    render(
      <AnswerSheet
        {...base}
        view="answer"
        answer={answer({ notFound: true, claims: [], sources: [], timing: { embed: 0.3, search: 0.1, rerank: 0, generate: 0 } })}
      />,
    );
    expect(screen.getByText("I couldn't find this in this course's documents.")).toBeInTheDocument();
    expect(screen.getByText(/Try different words/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show source/ })).not.toBeInTheDocument();
  });

  it("hides the starters on a course with no real documents, and says why", () => {
    render(<AnswerSheet {...base} view="empty" courseName="Operating Systems" sampleOnly />);
    expect(screen.queryByRole("button", { name: /Dijkstra/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Only Algorithms has real documents/)).toBeInTheDocument();
  });

  it("shows the starters when the course has real documents", () => {
    render(<AnswerSheet {...base} view="empty" />);
    expect(screen.getByRole("button", { name: /Dijkstra/ })).toBeInTheDocument();
    expect(screen.queryByText(/Only Algorithms has real/)).not.toBeInTheDocument();
  });

  it("shows the server's reason on an error, or the generic line without one", () => {
    const { rerender } = render(<AnswerSheet {...base} view="error" pendingQ="Q?" errorMsg="This demo session has used its token budget." />);
    expect(screen.getByRole("alert")).toHaveTextContent("This demo session has used its token budget.");
    rerender(<AnswerSheet {...base} view="error" pendingQ="Q?" errorMsg={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Recall couldn’t reach your notes just now.");
  });
});

describe("SourcesPane", () => {
  const pane = { picked: 1, hover: 0, onPick: noop, onPeek: noop, cardRef: noop };

  it("says why there are no sources when nothing was found", () => {
    render(<SourcesPane {...pane} view="answer" answer={answer({ notFound: true, claims: [], sources: [] })} />);
    expect(screen.getByText("Nothing here was close enough to cite.")).toBeInTheDocument();
  });

  it("lists the cited passages for a normal answer", () => {
    render(<SourcesPane {...pane} view="answer" answer={answer()} />);
    expect(screen.getByText("Erickson_Ch8_ShortestPaths.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here was close enough to cite.")).not.toBeInTheDocument();
  });
});
