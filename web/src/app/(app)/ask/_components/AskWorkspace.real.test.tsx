/**
 * Ask with real answers on (NEXT_PUBLIC_REAL_ASK). The flag is read at build
 * time, so e2e (which runs on the mock) can't reach this mode: these tests
 * mock the API module with REAL_ASK = true and check what the page does
 * with what /api/ask returns.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Answer, ChatSummary, Course } from "@/lib/api";
import type { AskResult } from "@/lib/api";
import { SAMPLE_COURSE_IDS } from "@/lib/sample-courses";

const ALGO = SAMPLE_COURSE_IDS.algorithms;

// vi.mock is hoisted above the imports, so its fakes live in vi.hoisted.
const api = vi.hoisted(() => ({
  askAndSave: vi.fn(),
  ask: vi.fn(),
  createChat: vi.fn(),
  addExchange: vi.fn(),
  listCourses: vi.fn(),
  listChats: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  REAL_ASK: true,
  askAndSave: api.askAndSave,
  ask: api.ask, // the mock path: must NOT be used in real mode
  createChat: api.createChat, // the browser-side saves: must NOT be used either
  addExchange: api.addExchange,
  listCourses: api.listCourses,
  listChats: api.listChats,
  listDynoRuns: async () => [],
  getDemoSession: async () => null,
}));

// Imported after vi.mock so it gets the mocked module.
const { AskWorkspace } = await import("./AskWorkspace");

const course: Course = {
  id: ALGO,
  name: "Algorithms",
  color: "blue",
  sample: true,
  documents: [{ id: "d1", name: "Erickson_Ch8_ShortestPaths.pdf", pages: 36, passages: 67, status: "ready", added: "Nov 7" }],
} as Course;

function answerFor(question: string, extra: Partial<Answer> = {}): Answer {
  return {
    question,
    courseId: ALGO,
    claims: ["Dijkstra assumes no negative edges"],
    sources: [{ n: 1, file: "Erickson_Ch8_ShortestPaths.pdf", page: 17, score: 0.67, pre: "", hit: "negative edges", post: "" }],
    dropped: [],
    timing: { embed: 0.4, search: 0.1, rerank: 0, generate: 2.1 },
    followUps: [],
    ...extra,
  } as Answer;
}

const chat = (id: string): ChatSummary => ({ id, courseId: ALGO, title: "Why does Dijkstra fail", group: "Today" });

/** A promise the test resolves by hand, to hold an answer "in flight". */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function ask(question: string) {
  const box = screen.getByRole("textbox");
  await userEvent.clear(box);
  await userEvent.type(box, `${question}{Enter}`);
}

beforeAll(() => {
  // jsdom has none of these; the workspace measures and scrolls.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  vi.resetAllMocks(); // also drops any leftover mockResolvedValueOnce
  api.listCourses.mockResolvedValue([course]);
  api.listChats.mockResolvedValue([]);
  window.sessionStorage.clear(); // not a fresh arrival: the mock would auto-ask here
});

afterEach(cleanup);

describe("Ask with real answers", () => {
  it("opens on the starters and never asks by itself", async () => {
    render(<AskWorkspace />);
    expect(await screen.findByText("Ask anything about Algorithms.")).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(api.askAndSave).not.toHaveBeenCalled();
    expect(api.ask).not.toHaveBeenCalled();
  });

  it("asks through /api/ask and lets the server save (no browser-side save)", async () => {
    api.askAndSave.mockResolvedValue({ answer: answerFor("Why does Dijkstra fail?"), chat: chat("c1"), saved: true } satisfies AskResult);
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");

    await ask("Why does Dijkstra fail?");

    expect(await screen.findByRole("heading", { level: 1, name: "Why does Dijkstra fail?" })).toBeInTheDocument();
    expect(api.askAndSave).toHaveBeenCalledWith(ALGO, "Why does Dijkstra fail?", null);
    expect(api.createChat).not.toHaveBeenCalled();
    expect(api.addExchange).not.toHaveBeenCalled();
    expect(api.ask).not.toHaveBeenCalled();
    expect(screen.queryByText(/Couldn’t save this chat/)).not.toBeInTheDocument();
  });

  it("sends a follow-up into the chat the first answer was saved in", async () => {
    api.askAndSave
      .mockResolvedValueOnce({ answer: answerFor("First?"), chat: chat("c1"), saved: true })
      .mockResolvedValueOnce({ answer: answerFor("Second?"), chat: chat("c1"), saved: true });
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");

    await ask("First?");
    await screen.findByRole("heading", { level: 1, name: "First?" });
    await ask("Second?");
    await screen.findByRole("heading", { level: 1, name: "Second?" });

    expect(api.askAndSave).toHaveBeenNthCalledWith(2, ALGO, "Second?", "c1");
  });

  it("starts a separate chat when New is pressed while an answer is in flight", async () => {
    const first = deferred<AskResult>();
    api.askAndSave
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ answer: answerFor("Second?"), chat: chat("c2"), saved: true });
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");

    await ask("First?"); // still in flight
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("n"); // New question

    // The first answer comes back after New: it was dropped, so the page stays on the starters.
    await act(async () => first.resolve({ answer: answerFor("First?"), chat: chat("c1"), saved: true }));
    expect(screen.getByText("Ask anything about Algorithms.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "First?" })).not.toBeInTheDocument();

    await ask("Second?");

    // The new conversation has no chat yet: it must not be filed into c1.
    expect(api.askAndSave).toHaveBeenNthCalledWith(2, ALGO, "Second?", null);
    expect(await screen.findByRole("heading", { level: 1, name: "Second?" })).toBeInTheDocument();
  });

  it("keeps the answer and shows a quiet note when the server couldn't save it", async () => {
    api.askAndSave.mockResolvedValue({ answer: answerFor("Q?"), chat: null, saved: false });
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");

    await ask("Q?");

    expect(await screen.findByRole("heading", { level: 1, name: "Q?" })).toBeInTheDocument();
    expect(screen.getByText("Couldn’t save this chat. Your answer is still here.")).toBeInTheDocument();
  });

  it("says plainly when the course doesn't cover the question", async () => {
    api.askAndSave.mockResolvedValue({
      answer: answerFor("Capital of France?", { notFound: true, claims: [], sources: [], timing: { embed: 0.3, search: 0.1, rerank: 0, generate: 0 } }),
      chat: chat("c1"),
      saved: true,
    });
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");

    await ask("Capital of France?");

    expect(await screen.findByText("I couldn't find this in this course's documents.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show source/ })).not.toBeInTheDocument();
  });

  it("shows the server's reason when an ask is refused", async () => {
    const { ApiError } = await import("@/lib/api");
    api.askAndSave.mockRejectedValue(new ApiError(429, "Too many questions in a minute. Wait a moment and try again."));
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");

    await ask("Q?");

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many questions in a minute. Wait a moment and try again.");
  });

  it("credits Erickson under the composer for the course with real documents", async () => {
    render(<AskWorkspace />);
    await screen.findByText("Ask anything about Algorithms.");
    expect(screen.getByRole("link", { name: "Algorithms" })).toHaveAttribute("href", "https://jeffe.cs.illinois.edu/teaching/algorithms/");
    expect(screen.getByText(/CC BY 4\.0/)).toBeInTheDocument();
  });
});
