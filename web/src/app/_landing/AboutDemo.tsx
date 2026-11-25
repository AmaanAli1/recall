import Link from "next/link";

/**
 * "About this demo." on the landing page (#about-this-demo). The one place that
 * says what the public demo covers and why: the footer and the header's demo
 * chip link here, and so does the Library's note.
 *
 * Decided 2026-11-25: Recall's public demo is Algorithms only. No uploads and
 * no courses of your own (see recall-algorithms-only-checklist.md). Everything
 * below is true of the live site; nothing promises future features.
 */
const FACTS: readonly { term: string; detail: React.ReactNode }[] = [
  {
    term: "One course",
    detail:
      "Jeff Erickson’s Algorithms: four chapters (recursion, dynamic programming, greedy algorithms, shortest paths), CC BY 4.0. It’s shared by every visitor and read-only.",
  },
  {
    term: "Answers from the book only",
    detail: "Every claim is cited to its page. When the book doesn’t cover a question, Recall says so instead of guessing.",
  },
  {
    term: "Your session",
    detail: "Your chats are private to your session and deleted 24 hours after your last visit. Each session has a question budget, because every answer costs a little to run.",
  },
  {
    term: "Measured",
    detail: (
      <>
        Retrieval is scored on a fixed set of golden questions, and every run is published on{" "}
        <Link href="/dyno" className="lnk-hl text-ink underline decoration-ink-3 underline-offset-4">
          the Dyno page
        </Link>
        .
      </>
    ),
  },
  {
    term: "No uploads",
    detail:
      "Uploading your own PDFs isn’t part of this demo. A free, anonymous public demo would carry the cost and abuse risk of strangers’ files, so it focuses on measurable retrieval quality over one openly licensed textbook. The chapters here were loaded with Recall’s ingest pipeline by the developer.",
  },
];

export function AboutDemo() {
  return (
    <section id="about-this-demo" aria-labelledby="about-h" className="relative mx-auto flex max-w-[1200px] scroll-mt-6 flex-wrap gap-14 px-6 pb-24 pt-12">
      <div className="min-w-0 flex-[1_1_320px]">
        <h2 id="about-h" className="m-0 text-[46px] font-normal leading-[1.06] tracking-[-0.032em]">
          About this demo.
        </h2>
        <p className="mb-0 mt-[18px] max-w-[24em] text-[17px] leading-[1.6] text-ink-2">
          Recall is a portfolio project: a study assistant built on retrieval, with its own benchmark. Here’s what the public demo covers.
        </p>
      </div>
      <div className="sheet relative min-w-0 flex-[2_1_560px]">
        <div className="ear bg-line-2 p-px">
          <dl className="ear m-0 bg-sheet px-[30px] pb-3 pt-2">
            {FACTS.map(({ term, detail }, i) => (
              <div key={term} className={`py-[17px] ${i === 0 ? "" : "border-t border-line"}`}>
                <dt className="font-mono text-xs uppercase tracking-[0.1em] text-ink-2">{term}</dt>
                <dd className="m-0 mt-1.5 text-base leading-relaxed">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        <span className="fold" aria-hidden="true" />
      </div>
    </section>
  );
}
