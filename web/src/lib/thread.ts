/**
 * A conversation in Ask: one Turn per question, in the order asked.
 * Pure helpers here; AskWorkspace owns the state.
 */
import type { Answer, ChatMessage } from "./api";

export interface Turn {
  /** Stable React key and scroll target; never reused within a page visit. */
  key: number;
  question: string;
  status: "loading" | "answer" | "error";
  answer?: Answer;
  /** The server's reason when status is "error" (null = the generic line). */
  errorMsg?: string | null;
  /** Just asked, so the answer types in. Turns opened from a saved chat don't. */
  fresh?: boolean;
  /** The sample answer Ask shows by itself on a return visit (mock only). Never saved. */
  sample?: boolean;
}

let next = 1;
/** A new, unique turn key. */
export const turnKey = () => next++;

/**
 * A saved chat's messages → its turns. Messages come oldest first, a
 * question before its answer. A question whose answer is missing (a save
 * that half failed) is left out rather than shown without an answer.
 */
export function messagesToTurns(messages: ChatMessage[]): Turn[] {
  const turns: Turn[] = [];
  let question: string | null = null;
  for (const m of messages) {
    if (m.role === "user") question = m.content;
    else if (question !== null && m.answer) {
      turns.push({ key: turnKey(), question, status: "answer", answer: m.answer });
      question = null;
    }
  }
  return turns;
}

/** The newest turn with an answer: the one Sources shows by default. */
export function latestAnswered(turns: Turn[]): Turn | undefined {
  return turns.findLast((t) => t.status === "answer");
}
