import { describe, expect, it } from "vitest";
import type { Answer, ChatMessage } from "./api";
import { excerpt } from "./excerpt";
import { latestAnswered, messagesToTurns, type Turn } from "./thread";

const answer = (q: string) => ({ question: q, claims: ["c"] }) as unknown as Answer;
const msg = (id: number, role: "user" | "assistant", content: string, a?: Answer): ChatMessage => ({
  id,
  role,
  content,
  answer: a,
  createdAt: "2026-11-22T00:00:00Z",
});

describe("messagesToTurns", () => {
  it("pairs each question with its answer, oldest first", () => {
    const turns = messagesToTurns([
      msg(1, "user", "First?"),
      msg(2, "assistant", "a1", answer("First?")),
      msg(3, "user", "Second?"),
      msg(4, "assistant", "a2", answer("Second?")),
    ]);
    expect(turns.map((t) => [t.question, t.status, t.answer?.question])).toEqual([
      ["First?", "answer", "First?"],
      ["Second?", "answer", "Second?"],
    ]);
    expect(new Set(turns.map((t) => t.key)).size).toBe(2); // unique keys
    expect(turns.every((t) => !t.fresh)).toBe(true); // opened, not just asked: no typing
  });

  it("leaves out a question whose answer is missing", () => {
    const turns = messagesToTurns([
      msg(1, "user", "Lost?"),
      msg(2, "assistant", "no answer json"), // saved without its answer
      msg(3, "user", "Kept?"),
      msg(4, "assistant", "a", answer("Kept?")),
    ]);
    expect(turns.map((t) => t.question)).toEqual(["Kept?"]);
  });
});

describe("latestAnswered", () => {
  it("skips turns that are loading or failed", () => {
    const turns: Turn[] = [
      { key: 1, question: "a", status: "answer" },
      { key: 2, question: "b", status: "answer" },
      { key: 3, question: "c", status: "error" },
      { key: 4, question: "d", status: "loading" },
    ];
    expect(latestAnswered(turns)?.key).toBe(2);
    expect(latestAnswered([])).toBeUndefined();
  });
});

describe("excerpt", () => {
  it("leaves short context alone", () => {
    expect(excerpt("Before. ", " after.")).toEqual({ pre: "Before. ", post: " after.", trimmed: false });
  });

  it("starts at the last sentence before the quote and ends at the end of its sentence", () => {
    const pre = "A first long sentence that goes on and on about nothing much at all. Then the lead-in ";
    const post = " ends here. And then a lot more text follows that nobody needs to read on the card.";
    const e = excerpt(pre, post, 60);
    expect(e.pre).toBe("Then the lead-in ");
    expect(e.post).toBe(" ends here.");
    expect(e.trimmed).toBe(true);
  });

  it("cuts at whole words with an ellipsis when there's no sentence break nearby", () => {
    const pre = "word ".repeat(40);
    const post = " more".repeat(40);
    const e = excerpt(pre, post, 32); // 32 isn't a multiple of "word " (5), so the cut lands mid-word
    expect(e.pre).toMatch(/^…word( word)* $/); // whole words only after the ellipsis
    expect(e.pre.length).toBeLessThanOrEqual(33);
    expect(e.post.endsWith("…")).toBe(true);
    expect(e.post).toMatch(/ more…$/); // ends on a whole word
  });
});
