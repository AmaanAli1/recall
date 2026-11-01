/**
 * The Dyno page before any real run exists (the launch state).
 * No numbers here on purpose: the first real run becomes the baseline,
 * and until then every score is honestly "—".
 */
const METRICS = [
  { label: "Recall@5", what: "How often the right page is in the top 5 results" },
  { label: "MRR", what: "How high the right page ranks" },
  { label: "Faithfulness", what: "How many answer claims the cited pages support" },
  { label: "Answer relevancy", what: "How well the answer addresses the question" },
];

export function DynoEmpty() {
  return (
    <>
      <div className="mb-6">
        <h1 className="m-0 text-[54px] font-normal leading-[1.04] tracking-[-0.036em]">
          Waiting on the first <span className="text-red">run</span>.
        </h1>
        <p className="mt-3.5 text-base text-ink-2">
          Real scores appear here at launch, once Dyno runs the golden questions against the live pipeline.
        </p>
        <p className="mt-1.5 max-w-[40em] text-sm text-ink-2">
          The first run becomes the baseline. After that, every change is measured against it, and a score that
          drops 0.02 below the baseline blocks the merge.
        </p>
      </div>

      <section aria-label="Metrics Dyno will track" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {METRICS.map((m) => (
          <div key={m.label} className="sheet relative">
            <div className="ear bg-line-2 p-px">
              <div className="ear flex min-h-[196px] flex-col justify-between bg-sheet px-[18px] pb-[22px] pt-[18px]">
                <h2 className="m-0 text-[15px] font-medium">{m.label}</h2>
                <p className="m-0 text-center text-[44px] font-normal tracking-[-0.03em] text-ink-3">
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">No score yet</span>
                </p>
                <p className="m-0 text-center text-[13px] leading-normal text-ink-2">{m.what}</p>
              </div>
            </div>
            <span className="fold" aria-hidden="true" />
          </div>
        ))}
      </section>

      {/* Same table shape as RunsTable, so the page doesn't change layout when the first run lands. */}
      <section aria-labelledby="runs-h" className="mt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="runs-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">Runs</h2>
          <span className="text-[13px] text-ink-2">Newest first, once there are any.</span>
        </div>
        <div className="sheet">
          {/* Focusable so keyboard users can scroll it sideways on a phone (it has no buttons inside yet). */}
          <div role="group" aria-label="Runs table" tabIndex={0} className="relative overflow-x-auto rounded border border-line bg-sheet">
            <table className="num w-full min-w-[860px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-xs text-ink-2">
                  <th scope="col" className="px-5 py-3.5 font-medium">Run</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Change tested</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-medium">Recall@5</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-medium">Faithfulness</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-medium">p95</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-medium">Gate</th>
                  <th scope="col" className="py-3.5 pl-1 pr-5 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <td colSpan={7} className="px-6 py-10 text-center">
                    <p className="m-0 text-base text-ink">No runs yet.</p>
                    <p className="mx-auto mt-2 max-w-[36em] text-sm leading-relaxed text-ink-2">
                      The first real run lands here at launch, with its scores, its gate result and a Details toggle
                      for its full setup.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
