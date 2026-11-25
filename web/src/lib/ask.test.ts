import { describe, expect, it } from "vitest";
import { toHistory } from "./ask";

const q = (content: string) => ({ role: "user", content });
const a = (content: string) => ({ role: "assistant", content });

describe("toHistory", () => {
  it("turns newest-first messages into oldest-first question/answer pairs", () => {
    expect(toHistory([a("A2"), q("Q2"), a("A1"), q("Q1")])).toEqual([
      { question: "Q1", answer: "A1" },
      { question: "Q2", answer: "A2" },
    ]);
  });

  it("skips a question whose answer wasn't saved, instead of sending half a turn", () => {
    // Oldest first: Q1, A1, Q2 (no answer), Q3, A3.
    expect(toHistory([a("A3"), q("Q3"), q("Q2"), a("A1"), q("Q1")])).toEqual([
      { question: "Q1", answer: "A1" },
      { question: "Q3", answer: "A3" },
    ]);
  });

  it("drops an answer cut off from its question by the limit", () => {
    // The 6-message window started on an answer: its question is older.
    expect(toHistory([a("A2"), q("Q2"), a("A1")])).toEqual([{ question: "Q2", answer: "A2" }]);
  });

  it("is empty for no messages", () => {
    expect(toHistory([])).toEqual([]);
  });
});
