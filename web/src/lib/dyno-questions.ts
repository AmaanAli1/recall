/**
 * The wording of Dyno's follow-up and off-topic questions, for /dyno's tables.
 *
 * The run file (dyno-runs.json) stores only ids, and dyno/golden.toml lives
 * outside web/ (Vercel builds from web/), so the text is copied here. A unit
 * test (dyno-questions.test.ts) reads golden.toml and checks every entry
 * matches it word for word, so the two can't drift apart (same idea as the
 * course-limit message, Q103).
 */
export interface GoldenText {
  question: string;
  /** Follow-ups: the earlier question in the chat (golden.toml's [[question.history]]). */
  after?: string;
  /** What we found when we looked into a result (page only: not in golden.toml). */
  note?: string;
}

export const GOLDEN_TEXT: Record<string, GoldenText> = {
  "fu-01": { after: "How does quicksort work?", question: "Why can it take quadratic time?" },
  "fu-02": { after: "What is the Tower of Hanoi puzzle?", question: "How many moves does the recursive solution need?" },
  "fu-03": { after: "What is edit distance?", question: "What recurrence defines it?" },
  "fu-04": { after: "What is the subset sum problem?", question: "How fast is the dynamic programming solution?" },
  "fu-05": { after: "What is Huffman coding?", question: "How does the algorithm decide what to merge?" },
  "fu-06": { after: "What is the stable matching problem?", question: "Does it matter who makes offers first?" },
  "fu-07": { after: "How does Dijkstra's algorithm work?", question: "How fast is it with a binary heap?" },
  "fu-08": { after: "What does the Bellman-Ford algorithm do?", question: "How can it tell there's a negative cycle?" },
  "off-01": { question: "How do I bake sourdough bread at home?" },
  "off-02": { question: "Who won the 2018 FIFA World Cup?" },
  "off-03": { question: "What are the symptoms of the common cold?" },
  "off-04": {
    question: "How does a TCP three-way handshake work?",
    note: "The closest match is Erickson's puzzle about politicians shaking hands: the same word, not the topic.",
  },
  "off-05": {
    question: "How do I rebalance a red-black tree after an insertion?",
    note:
      "Partly in the course after all: chapter 3's exercises define red-black trees, but nothing explains rebalancing. Asked on the live demo (Nov 25), the answer gave related facts and said the passages don't describe rebalancing: nothing invented.",
  },
};
