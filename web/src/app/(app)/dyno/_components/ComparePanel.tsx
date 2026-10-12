import type { DynoRun } from "@/lib/api";
import { signed, verdict } from "@/lib/stats";
import s from "../dyno.module.css";
import { KEYS, LABEL, cx, f2, runNum } from "../_lib/model";
import { Chip, CloseButton, Collapse, type ChipTone } from "./Collapse";

interface Props {
  open: boolean;
  runs: DynoRun[];
  base: DynoRun;
  a: string;
  b: string;
  onPickA: (id: string) => void;
  onPickB: (id: string) => void;
  onSwap: () => void;
  onReset: () => void;
  onClose: () => void;
}

/** Side-by-side diff of two runs with a real-vs-noise verdict per metric. */
export function ComparePanel({ open, runs, base, a, b, onPickA, onPickB, onSwap, onReset, onClose }: Props) {
  const newestFirst = runs.slice().reverse();
  const A = runs.find((r) => r.id === a);
  const B = runs.find((r) => r.id === b);

  const pills = (which: "A" | "B") =>
    newestFirst.map((r) => {
      const on = (which === "A" ? a : b) === r.id;
      return (
        <button
          key={r.id}
          type="button"
          className={cx(s.pill, which === "A" ? s.pillA : s.pillB)}
          aria-pressed={on}
          onClick={() => (which === "A" ? onPickA(r.id) : onPickB(r.id))}
        >
          {r.id}
          {r.id === base.id ? " · baseline" : ""}
        </button>
      );
    });

  return (
    <Collapse open={open}>
      <section
        id="compare"
        aria-labelledby="cmp-h"
        className="sheet mb-2"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="rounded border border-line-2 bg-sheet px-6 pb-6 pt-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="cmp-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">Compare runs</h2>
              <p className="mt-1.5 text-[13px] text-ink-2">
                Every comparison needs a reference point. It starts at the baseline, run {runNum(base.id)}.
              </p>
            </div>
            <CloseButton label="Close compare" onClick={onClose} className="-mr-2 -mt-1.5 flex-none" />
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <div role="group" aria-label="Run A" className="flex flex-wrap items-center gap-1.5">
              <span className="w-[74px] text-[13px] text-ink-2">
                <span className={s.tagA}>A</span> Run
              </span>
              {pills("A")}
            </div>
            <div role="group" aria-label="Compare against" className="flex flex-wrap items-center gap-1.5">
              <span className="w-[74px] text-[13px] text-ink-2">
                <span className={s.tagB}>B</span> Against
              </span>
              {pills("B")}
              {b !== base.id && (
                <button type="button" className={s.lnkBtn} onClick={onReset}>
                  Reset to baseline
                </button>
              )}
              <button type="button" className={cx(s.swap, "ml-1.5")} onClick={onSwap} aria-label="Swap A and B">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
                </svg>
              </button>
            </div>
          </div>

          {A && B && a !== b ? (
            <>
              <div className="mt-[18px] overflow-x-auto">
                <table className="num w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-2">
                      <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        <span className={s.tagA}>A</span> {A.id}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        <span className={s.tagB}>B</span> {B.id}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">A − B</th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEYS.map((k) => {
                      const va = A.metrics[k];
                      const vb = B.metrics[k];
                      const d = Number((va - vb).toFixed(2));
                      const vd = verdict(va, vb, A.n, B.n);
                      const tone: ChipTone = vd === "gain" ? "good" : vd === "drop" ? "bad" : "neutral";
                      return (
                        <CompareRow
                          key={k}
                          label={LABEL[k]}
                          a={f2(va)}
                          b={f2(vb)}
                          d={signed(d)}
                          dClass={d > 0 ? "text-good" : d < 0 ? "text-bad" : "text-ink-2"}
                          verdict={vd === "gain" ? "Real gain" : vd === "drop" ? "Real drop" : "Within noise"}
                          tone={tone}
                        />
                      );
                    })}
                    {(() => {
                      // Latency: lower is better, so a rise is the warning colour.
                      const d = Number((A.p95 - B.p95).toFixed(1));
                      return (
                        <CompareRow
                          label="p95 latency"
                          a={`${A.p95.toFixed(1)} s`}
                          b={`${B.p95.toFixed(1)} s`}
                          d={`${signed(d, 1)} s`}
                          dClass={d > 0 ? "text-bad" : d < 0 ? "text-good" : "text-ink-2"}
                          verdict={d > 0 ? "Slower" : d < 0 ? "Faster" : "Same"}
                          tone={d > 0 ? "mid" : d < 0 ? "good" : "neutral"}
                        />
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 max-w-[62em] text-[13px] text-ink-2">
                A change counts as real when it&apos;s bigger than the two runs&apos; combined 95% interval ({A.n} questions each). The real build uses a
                paired bootstrap over the same questions. Lower is better for p95 latency.
              </p>
            </>
          ) : (
            <p className="mt-[18px] text-sm text-ink-2">Pick two different runs to compare.</p>
          )}
        </div>
      </section>
    </Collapse>
  );
}

function CompareRow(p: { label: string; a: string; b: string; d: string; dClass: string; verdict: string; tone: ChipTone }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-[11px] pr-3 text-left font-normal">{p.label}</th>
      <td className="px-3 py-[11px] text-right font-mono">{p.a}</td>
      <td className="px-3 py-[11px] text-right font-mono text-ink-2">{p.b}</td>
      <td className={cx("px-3 py-[11px] text-right font-mono", p.dClass)}>{p.d}</td>
      <td className="py-[11px] pl-3 text-right">
        <Chip tone={p.tone}>{p.verdict}</Chip>
      </td>
    </tr>
  );
}
