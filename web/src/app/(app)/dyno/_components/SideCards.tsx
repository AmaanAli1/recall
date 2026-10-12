import type { DynoRun } from "@/lib/api";
import { signed } from "@/lib/stats";
import { cx } from "../_lib/model";

/** Judge agreement and p95 latency, stacked beside the trend chart. */
export function SideCards({ latest, base }: { latest: DynoRun; base: DynoRun }) {
  const d = Number((latest.p95 - base.p95).toFixed(1));
  return (
    <div className="flex min-w-0 flex-col gap-4 [flex:1_1_280px]">
      <div className="sheet relative flex-auto">
        <div className="ear box-border h-full bg-red p-px">
          <div className="ear box-border flex h-full min-h-[172px] flex-col justify-between bg-[#FBEFEA] p-[22px]">
            <h2 className="m-0 text-sm font-medium text-ink-2">Judge agreement</h2>
            <div>
              {/* Not part of the run API yet: the judge is calibrated once against hand grades. */}
              <p className="num m-0 text-[54px] font-normal leading-none tracking-[-0.03em]">87%</p>
              <p className="mt-2 text-[13px] text-ink-2">LLM judge vs 30 hand-graded answers</p>
            </div>
          </div>
        </div>
        <span className="fold fold-red" aria-hidden="true" />
      </div>
      <div className="sheet relative flex-auto">
        <div className="ear box-border h-full bg-line-2 p-px">
          <div className="ear box-border flex h-full min-h-[172px] flex-col justify-between bg-sheet p-[22px]">
            <div className="flex justify-between">
              <h2 className="m-0 text-sm font-medium text-ink-2">p95 latency</h2>
              <span className={cx("num font-mono text-xs", d > 0 ? "text-mid" : d < 0 ? "text-good" : "text-ink-2")}>
                {signed(d, 1)}&nbsp;s
              </span>
            </div>
            <div>
              <p className="num m-0 text-[54px] font-normal leading-none tracking-[-0.03em]">{latest.p95.toFixed(1)}&nbsp;s</p>
              <p className="mt-2 text-[13px] text-ink-2">
                {d > 0
                  ? <>{d.toFixed(1)}&nbsp;s slower than the baseline. Worth it?</>
                  : d < 0
                    ? <>{Math.abs(d).toFixed(1)}&nbsp;s faster than the baseline.</>
                    : "Same as the baseline."}
              </p>
            </div>
          </div>
        </div>
        <span className="fold" aria-hidden="true" />
      </div>
    </div>
  );
}
