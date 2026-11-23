import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Answer } from "@/lib/api";
import type { Turn } from "@/lib/thread";
import { AnswerSheet } from "./AnswerSheet";
import { SourcesPane } from "./SourcesPane";

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const noop = () => {};
const base = {
  turns: [] as Turn[],
  activeKey: null as number | null,
  pendingQ: "",
  docCount: 4,
  courseName: "Algorithms",
  starters: [{ id: "dj", question: "Why does Dijkstra fail with negative edges?" }],
  picked: 1,
  hover: 0,
  showTiming: true,
  animate: false,
  smooth: false,
  onAsk: noop,
  onRetry: noop,
  onPick: noop,
  onPeek: noop,
  onFollowUp: noop,
  onRevealed: noop,
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

const turn = (key: number, question: string, extra: Partial<Turn> = {}): Turn => ({
  key,
  question,
  status: "answer",
  answer: answer({ question }),
  ...extra,
});

describe("AnswerSheet: the conversation", () => {
  it("keeps every question and answer, the first as the page's h1", () => {
    render(<AnswerSheet {...base} view="thread" turns={[turn(1, "First?"), turn(2, "Second?")]} activeKey={2} />);
    expect(screen.getByRole("heading", { level: 1, name: "First?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Second?" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Answer to First?" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Answer to Second?" })).toBeInTheDocument();
  });

  it("shows suggested follow-ups under the newest answer only", () => {
    const withF = (k: number, q: string) => turn(k, q, { answer: answer({ question: q, followUps: [`after ${q}`] }) });
    render(<AnswerSheet {...base} view="thread" turns={[withF(1, "First?"), withF(2, "Second?")]} activeKey={2} />);
    expect(screen.queryByRole("button", { name: "after First?" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "after Second?" })).toBeInTheDocument();
  });

  it("a citation in an older answer reports which turn it belongs to", () => {
    const onPick = vi.fn();
    render(<AnswerSheet {...base} view="thread" turns={[turn(1, "First?"), turn(2, "Second?")]} activeKey={2} onPick={onPick} />);
    const first = screen.getByRole("region", { name: "Answer to First?" });
    fireEvent.click(within(first).getByRole("button", { name: /Show source 1/ }));
    expect(onPick).toHaveBeenCalledWith(1, 1, true); // turn 1, source 1 (keyboard-style click: detail 0)
  });

  it("only the turn whose sources are showing marks its picked citation", () => {
    render(<AnswerSheet {...base} view="thread" turns={[turn(1, "First?"), turn(2, "Second?")]} activeKey={2} picked={1} />);
    const cite = (q: string) => within(screen.getByRole("region", { name: `Answer to ${q}` })).getByRole("button", { name: /Show source 1/ });
    expect(cite("Second?")).toHaveAttribute("aria-pressed", "true");
    expect(cite("First?")).toHaveAttribute("aria-pressed", "false");
  });

  it("a failed question says why and offers Try again, with earlier answers kept", () => {
    render(
      <AnswerSheet
        {...base}
        view="thread"
        turns={[turn(1, "First?"), { key: 2, question: "Second?", status: "error", errorMsg: "Too many questions in a minute." }]}
        activeKey={1}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Too many questions in a minute.");
    expect(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Answer to First?" })).toBeInTheDocument();
  });
});

describe("AnswerSheet: typing a new answer in", () => {
  const three = answer({ question: "Q?", claims: ["one two three four", "five six seven eight", "nine ten eleven twelve"] });

  it("types a fresh answer in, then shows it whole with its citations", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const onRevealed = vi.fn();
    render(
      <AnswerSheet {...base} view="thread" animate turns={[{ key: 1, question: "Q?", status: "answer", answer: three, fresh: true }]} activeKey={1} onRevealed={onRevealed} />,
    );
    const region = screen.getByRole("region", { name: "Answer to Q?" });
    // Screen readers wait for the finished answer.
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(within(region).queryAllByRole("button", { name: /Show source/ })).toHaveLength(0);

    act(() => vi.advanceTimersByTime(300)); // part way
    expect(within(region).queryAllByRole("button", { name: /Show source/ }).length).toBeLessThan(3);

    act(() => vi.advanceTimersByTime(2000)); // past the longest reveal
    expect(region).toHaveAttribute("aria-busy", "false");
    expect(within(region).getAllByRole("button", { name: /Show source/ })).toHaveLength(3);
    expect(region).toHaveTextContent("nine ten eleven twelve");
    // Sources is told as claims finish, ending with all three.
    expect(onRevealed).toHaveBeenLastCalledWith(1, 3);
  });

  it("shows the answer at once when motion is off (reduced motion or calm)", () => {
    render(<AnswerSheet {...base} view="thread" animate={false} turns={[{ key: 1, question: "Q?", status: "answer", answer: three, fresh: true }]} activeKey={1} />);
    expect(within(screen.getByRole("region", { name: "Answer to Q?" })).getAllByRole("button", { name: /Show source/ })).toHaveLength(3);
  });

  it("doesn't type in answers from a chat opened later", () => {
    render(<AnswerSheet {...base} view="thread" animate turns={[{ key: 1, question: "Q?", status: "answer", answer: three }]} activeKey={1} />);
    expect(within(screen.getByRole("region", { name: "Answer to Q?" })).getAllByRole("button", { name: /Show source/ })).toHaveLength(3);
  });
});

describe("AnswerSheet: other states", () => {
  it("leaves steps that took no time out of the timing bar", () => {
    render(<AnswerSheet {...base} view="thread" turns={[turn(1, "Q?")]} activeKey={1} />);
    const bar = screen.getByRole("group", { name: "Time spent per step" });
    // There's no reranker yet, so rerank's 0 s would be a 0-wide segment with a label on top of its neighbours.
    expect(within(bar).queryByText(/rerank/)).not.toBeInTheDocument();
    expect(within(bar).getByText(/generate/)).toBeInTheDocument();
  });

  it("fills the whole timing bar even when the answer took under a second", () => {
    const fast = turn(1, "Q?", { answer: answer({ timing: { embed: 0.3, search: 0.2, rerank: 0, generate: 0 } }) });
    render(<AnswerSheet {...base} view="thread" turns={[fast]} activeKey={1} />);
    const bar = screen.getByRole("group", { name: "Time spent per step" }).firstElementChild as HTMLElement;
    // flex-grow values adding up to under 1 leave part of the bar empty.
    const grow = Array.from(bar.children).reduce((n, el) => n + parseFloat((el as HTMLElement).style.flex), 0); // "0.6 1 0%" → 0.6
    expect(grow).toBeCloseTo(1);
  });

  it("answers 'not found' in words, with no citations", () => {
    const nf = turn(1, "Capital of France?", {
      answer: answer({ question: "Capital of France?", notFound: true, claims: [], sources: [], timing: { embed: 0.3, search: 0.1, rerank: 0, generate: 0 } }),
    });
    render(<AnswerSheet {...base} view="thread" turns={[nf]} activeKey={1} />);
    expect(screen.getByText("I couldn't find this in this course's documents.")).toBeInTheDocument();
    expect(screen.getByText(/Try different words/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show source/ })).not.toBeInTheDocument();
  });

  it("hides the starters on a course with no real documents, and says why", () => {
    render(<AnswerSheet {...base} view="empty" courseName="Everyday Math" sampleOnly />);
    expect(screen.queryByRole("button", { name: /Dijkstra/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Only Algorithms has real documents/)).toBeInTheDocument();
  });

  it("shows the starters when the course has real documents", () => {
    render(<AnswerSheet {...base} view="empty" />);
    expect(screen.getByRole("button", { name: /Dijkstra/ })).toBeInTheDocument();
    expect(screen.queryByText(/Only Algorithms has real/)).not.toBeInTheDocument();
  });

  it("opening a chat that fails offers Try again", () => {
    render(<AnswerSheet {...base} view="error" pendingQ="My chat" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Recall couldn’t reach your notes just now.");
    expect(screen.getByRole("heading", { level: 1, name: "My chat" })).toBeInTheDocument();
  });
});

describe("SourcesPane", () => {
  const pane = { answerKey: 1, picked: 1, hover: 0, onPick: noop, onPeek: noop, cardRef: noop };
  const LONG_PRE = "An opening sentence about shortest paths that runs long enough to be trimmed away. Lead-in ";
  const LONG_POST = " and the sentence ends here. A long tail of text follows which the card should not show unless asked.";
  const long = answer({
    sources: [{ n: 1, file: "Erickson_Ch8_ShortestPaths.pdf", page: 17, score: 0.67, pre: LONG_PRE, hit: "the quoted words", post: LONG_POST }] as Answer["sources"],
  });

  it("shows the quote with a little context, and the whole passage on request", () => {
    render(<SourcesPane {...pane} view="answer" answer={long} picked={0} />); // not the picked card
    const card = screen.getByRole("button", { name: /^\[1\]/ });
    expect(card).toHaveTextContent("Lead-in the quoted words and the sentence ends here.");
    expect(card).not.toHaveTextContent("An opening sentence");
    expect(card.querySelector("mark")).toHaveTextContent("the quoted words"); // marked even when not picked

    const more = screen.getByRole("button", { name: "Show full passage for source 1" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(card).toHaveTextContent("An opening sentence");
    expect(screen.getByRole("button", { name: "Show less of source 1" })).toHaveAttribute("aria-expanded", "true");
  });

  it("offers no toggle when the passage is already short", () => {
    render(<SourcesPane {...pane} view="answer" answer={answer()} />);
    expect(screen.queryByRole("button", { name: /Show full passage/ })).not.toBeInTheDocument();
  });

  it("while an answer types in, shows only the cards of finished claims", () => {
    const two = answer({
      claims: ["a", "b"],
      sources: [
        { n: 1, file: "A.pdf", page: 1, score: 0.7, pre: "", hit: "x", post: "" },
        { n: 2, file: "B.pdf", page: 2, score: 0.6, pre: "", hit: "y", post: "" },
      ] as Answer["sources"],
    });
    render(<SourcesPane {...pane} view="answer" answer={two} visible={1} />);
    expect(screen.getByText("A.pdf")).toBeInTheDocument();
    expect(screen.queryByText("B.pdf")).not.toBeInTheDocument();
  });

  it("says which question the sources are for", () => {
    render(<SourcesPane {...pane} view="answer" answer={answer()} forQuestion="Why does Dijkstra fail?" />);
    expect(screen.getByText("For: Why does Dijkstra fail?")).toBeInTheDocument();
  });

  it("says why there are no sources when nothing was found", () => {
    render(<SourcesPane {...pane} view="answer" answer={answer({ notFound: true, claims: [], sources: [] })} />);
    expect(screen.getByText("Nothing here was close enough to cite.")).toBeInTheDocument();
  });
});
