import { USE_MOCK, type DynoRun } from "@/lib/api";
import { ci95, signed, verdict } from "@/lib/stats";
import s from "../dyno.module.css";
import {
  ESTIMATE_METRICS,
  LABEL,
  STAGES,
  cx,
  estimateOf,
  f2,
  failedMetrics,
  formatDuration,
  gateOf,
  liveN,
  runNum,
  stageIndex,
  type RunState,
} from "../_lib/model";
import { Chip, CloseButton, Collapse } from "./Collapse";

interface Props {
  open: boolean;
  run: RunState;
  /** The run before the finished one, for "vs R12" notes. */
  prev: DynoRun | null;
  base: DynoRun;
  onClose: () => void;
}

/** Live progress of a Dyno run, then its summary against the previous run. */
export function RunPanel({ open, run, prev, base, onClose }: Props) {
  const { done: prog, total } = run.progress;
  const finished = run.status === "done" ? run.finished : null;
  const running = run.status === "running";
  const gating = running && run.progress.stage === "gate";
  const failed = finished ? gateOf(finished, base) === "fail" : false;
  const num = runNum(run.id);
  const step = finished ? 4 : stageIndex(run.progress.stage);

  const title = finished ? `Run ${num} finished` : run.status === "cancelled" ? `Run ${num} cancelled` : "Running the numbers";
  const chip = finished ? (failed ? "Redline" : "Clear") : run.status === "cancelled" ? "Cancelled" : gating ? "Checking" : "Running";

  const progText = finished
    ? `${total} of ${total} questions · finished in ${formatDuration(run.elapsedMs)}`
    : gating
      ? `${total} of ${total} questions · comparing every metric to its redline`
      : `${prog} of ${total} questions · ${USE_MOCK ? "the demo runs in 5 s, a real run takes a few minutes" : "a real run takes a few minutes"}`;

  return (
    <Collapse open={open}>
      <section aria-labelledby="runp-h" className="sheet relative mb-2">
        <div className="ear p-px" style={{ background: finished ? (failed ? "var(--red)" : "var(--good)") : "var(--line-2)" }}>
          <div className="ear bg-sheet px-6 pb-6 pt-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="runp-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">{title}</h2>
                <Chip tone={finished ? (failed ? "bad" : "good") : "mid"} fill={!finished}>
                  {chip}
                </Chip>
              </div>
              {finished && <CloseButton label="Close run summary" onClick={onClose} />}
            </div>

            <ol className="m-0 mt-[18px] flex list-none flex-wrap gap-x-7 gap-y-1.5 p-0">
              {STAGES.map((label, i) => {
                const isDone = i < step;
                const isNow = i === step && running;
                return (
                  <li
                    key={label}
                    className={cx("inline-flex items-center gap-2 text-sm", isDone ? "text-ink" : isNow ? "font-medium text-red" : "text-ink-3")}
                    aria-current={isNow ? "step" : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px]",
                        isDone ? "bg-ink text-paper" : isNow ? "border-[1.5px] border-red text-red" : "border border-line-2",
                        isNow && s.blink,
                      )}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ol>

            <div
              className={cx(s.progTrack, "mt-3.5")}
              role="progressbar"
              aria-label="Questions evaluated"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={prog}
            >
              <div className={s.progFill} style={{ width: `${((prog / Math.max(1, total)) * 100).toFixed(1)}%` }} />
            </div>
            <p className="num mt-2 text-[13px] text-ink-2">{progText}</p>

            <div className="mt-[18px] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
              {ESTIMATE_METRICS.map((k) => {
                let v = "—";
                let pm = "";
                let note = prog ? "interval narrows as questions finish" : "waiting for the first answers";
                let noteClass = "text-ink-3";
                if (finished) {
                  const val = finished.metrics[k];
                  v = f2(val);
                  pm = `±${f2(ci95(val, finished.n))}`;
                  if (prev) {
                    const vd = verdict(val, prev.metrics[k], finished.n, prev.n);
                    note = `vs ${prev.id} ${signed(val - prev.metrics[k])}${vd === "noise" ? ", within noise" : ", real"}`;
                    noteClass = cx("font-mono", vd === "gain" ? "text-good" : vd === "drop" ? "text-bad" : "text-ink-2");
                  } else {
                    note = "first run";
                  }
                } else if (prog) {
                  // Live, or frozen at the moment a run was cancelled.
                  const e = estimateOf(run.anchor, k, prog, total);
                  v = f2(e);
                  pm = `±${f2(ci95(e, liveN(prog)))}`;
                }
                return (
                  <div key={k} className="border-t border-line pt-2.5">
                    <p className="m-0 text-[13px] text-ink-2">{LABEL[k]}</p>
                    <p className="num mt-1 font-mono text-xl text-ink">
                      {v}
                      <span className="ml-2 text-[13px] text-ink-2">{pm}</span>
                    </p>
                    <p className={cx("num mt-1 text-xs", noteClass)}>{note}</p>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 max-w-[60em] text-sm text-ink-2">
              {finished ? summary(finished, prev, base) : `The last finished run stays on screen while this one runs. The dashed needles and the dashed point show run ${num}’s estimate so far.`}
            </p>
          </div>
        </div>
        <span className={cx("fold", failed && "fold-red")} aria-hidden="true" />
      </section>
    </Collapse>
  );
}

/** Plain-language summary of a finished run: gate, the Recall@5 change and its noise verdict, latency. */
function summary(run: DynoRun, prev: DynoRun | null, base: DynoRun): string {
  const num = runNum(run.id);
  const fails = failedMetrics(run, base);
  const gate = fails.length
    ? `Run ${num} hit the redline on ${fails.map((k) => LABEL[k].toLowerCase()).join(", ")}, so the merge is blocked.`
    : `Run ${num} cleared every redline.`;
  if (!prev) return gate;
  const d = run.metrics.recall - prev.metrics.recall;
  const noise = verdict(run.metrics.recall, prev.metrics.recall, run.n, prev.n) === "noise";
  const dP95 = Number((run.p95 - prev.p95).toFixed(1));
  const latency = dP95 === 0 ? "p95 latency held steady" : `p95 latency ${dP95 > 0 ? "rose" : "fell"} ${Math.abs(dP95).toFixed(1)} s`;
  return (
    `${gate} Recall@5 moved ${signed(d)} over run ${runNum(prev.id)}, which is ` +
    (noise ? `inside the noise for ${run.n} questions` : `a real change for ${run.n} questions`) +
    `, and ${latency}.` +
    (noise ? " Worth a paired comparison before you keep it." : "")
  );
}
