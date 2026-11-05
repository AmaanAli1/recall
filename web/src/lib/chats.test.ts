import { describe, expect, it } from "vitest";
import { cleanQuestion, cleanTitle, isUuid, parseChatPatch, parseExchange, parseNewChat, titleFromQuestion } from "./chats";

const COURSE = "00000000-0000-0000-0000-00000000c001";
const answer = { claims: ["When choices overlap.", "Greedy can't undo a choice."] };

describe("isUuid", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(isUuid(COURSE)).toBe(true);
    expect(isUuid("os")).toBe(false);
    expect(isUuid(`${COURSE}' or 1=1`)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("cleanTitle", () => {
  it("trims, collapses spaces and turns control characters into spaces", () => {
    expect(cleanTitle("  DP \t vs\ngreedy  ")).toBe("DP vs greedy");
  });

  it("removes zero-width characters", () => {
    expect(cleanTitle("DP​ vs greedy")).toBe("DP vs greedy");
  });

  it("cuts at 80 characters with no space left at the end", () => {
    const t = cleanTitle(`${"a".repeat(79)} bcd`);
    expect(t).toBe("a".repeat(79));
  });

  it("returns an empty string when only spaces are left", () => {
    expect(cleanTitle(" \n​ ")).toBe("");
  });
});

describe("titleFromQuestion", () => {
  it("keeps a short question as it is", () => {
    expect(titleFromQuestion("When does DP beat greedy?")).toBe("When does DP beat greedy?");
  });

  it("cuts a long question at a word boundary and adds …", () => {
    const q = "Why does Dijkstra's algorithm fail on graphs with negative edge weights, and what should I use instead?";
    const t = titleFromQuestion(q);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(61);
    expect(t).toBe("Why does Dijkstra's algorithm fail on graphs with negative…");
  });

  it("falls back to 'New chat' when the question has no visible text", () => {
    expect(titleFromQuestion("​")).toBe("New chat");
  });
});

describe("cleanQuestion", () => {
  it("keeps newlines but drops other control characters", () => {
    expect(cleanQuestion("  line one\nline\u0000 two  ")).toBe("line one\nline two");
  });
});

describe("parseExchange", () => {
  it("accepts a question with an answer and joins the claims as the answer text", () => {
    const r = parseExchange({ question: " When does DP beat greedy? ", answer });
    expect(r).toEqual({
      ok: true,
      value: {
        question: "When does DP beat greedy?",
        answerText: "When choices overlap. Greedy can't undo a choice.",
        answer,
      },
    });
  });

  it("rejects an empty or missing question", () => {
    expect(parseExchange({ question: "   ", answer }).ok).toBe(false);
    expect(parseExchange({ answer }).ok).toBe(false);
  });

  it("rejects a question over 2,000 characters", () => {
    expect(parseExchange({ question: "x".repeat(2001), answer }).ok).toBe(false);
  });

  it("rejects an answer without text claims", () => {
    expect(parseExchange({ question: "Hi", answer: {} }).ok).toBe(false);
    expect(parseExchange({ question: "Hi", answer: { claims: [1, 2] } }).ok).toBe(false);
    expect(parseExchange({ question: "Hi", answer: ["not", "an", "object"] }).ok).toBe(false);
  });

  it("rejects an answer too big to store", () => {
    const huge = { claims: ["ok"], sources: [{ pre: "x".repeat(70_000) }] };
    expect(parseExchange({ question: "Hi", answer: huge })).toEqual({ ok: false, error: "That answer is too long to save." });
  });

  it("rejects a body that isn't an object", () => {
    expect(parseExchange(null).ok).toBe(false);
    expect(parseExchange("hello").ok).toBe(false);
  });
});

describe("parseNewChat", () => {
  it("needs a valid course id", () => {
    expect(parseNewChat({ courseId: "algorithms", question: "Hi", answer })).toEqual({ ok: false, error: "Pick a course." });
    expect(parseNewChat({ courseId: COURSE, question: "Hi", answer }).ok).toBe(true);
  });
});

describe("parseChatPatch", () => {
  it("accepts a new title (cleaned) and/or pinned", () => {
    expect(parseChatPatch({ title: "  Exam  prep " })).toEqual({ ok: true, value: { title: "Exam prep" } });
    expect(parseChatPatch({ pinned: true })).toEqual({ ok: true, value: { pinned: true } });
  });

  it("ignores any other field instead of passing it on", () => {
    const r = parseChatPatch({ pinned: false, course_id: "x", session_id: "y" });
    expect(r).toEqual({ ok: true, value: { pinned: false } });
  });

  it("rejects an empty title, a non-boolean pinned, or nothing to change", () => {
    expect(parseChatPatch({ title: "   " }).ok).toBe(false);
    expect(parseChatPatch({ pinned: "yes" }).ok).toBe(false);
    expect(parseChatPatch({}).ok).toBe(false);
    expect(parseChatPatch(null).ok).toBe(false);
  });
});