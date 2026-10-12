import type { Ref } from "react";
import type { DynoRun } from "@/lib/api";
import s from "../dyno.module.css";
import { cx, gateOf, runNum, type LiveView } from "../_lib/model";

interface Props {
  latest: DynoRun;
  base: DynoRun;
  live: LiveView | null;
  compareOpen: boolean;
  onToggleCompare: () => void;
  onStart: () => void;
  onCancel: () => void;
  compareRef: Ref<HTMLButtonElement>;
  runRef: Ref<HTMLButtonElement>;
}

/** Page title (the verdict), run subtitle, and the Compare / Run Dyno actions. */
export function DynoHeader({ latest, base, live, compareOpen, onToggleCompare, onStart, onCancel, compareRef, runRef }: Props) {
  const head = live
    ? { a: "Running the ", b: "numbers", c: "…", sub: `Run ${runNum(live.id)} · ${live.done} of ${live.total} questions · ${live.date}` }
    : {
        a: gateOf(latest, base) === "fail" ? "Into the " : "Clear of the ",
        b: "redline",
        c: ".",
        sub: `Run ${runNum(latest.id)} · ${latest.change} · ${latest.n} questions · ${latest.date}`,
      };

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 aria-live="polite" className="m-0 text-[54px] font-normal leading-[1.04] tracking-[-0.036em]">
          {head.a}
          <span className="text-red">{head.b}</span>
          {head.c}
        </h1>
        <p className="num mt-3.5 text-base text-ink-2">{head.sub}</p>
        <p className="mt-1.5 max-w-[40em] text-sm text-ink-2">
          The redline sits 0.02 below each baseline. A score that falls into it blocks the merge.
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button
          ref={compareRef}
          type="button"
          className="btn btn-ghost inline-flex items-center gap-2.5 rounded-[5px] py-[9px] pl-3.5 pr-[9px] text-sm text-ink"
          // Inline border (as designed) so the open state keeps its ink outline on hover.
          style={{ borderColor: compareOpen ? "var(--ink)" : "var(--line-2)" }}
          aria-expanded={compareOpen}
          aria-controls="compare"
          aria-keyshortcuts="C"
          onClick={onToggleCompare}
        >
          {compareOpen ? "Close compare" : "Compare runs"} <kbd className="kbd kbd-ink">C</kbd>
        </button>
        {/* One element for both states, so keyboard focus survives start → cancel → finish. */}
        <button
          ref={runRef}
          type="button"
          className={cx(
            "btn inline-flex items-center gap-2.5 rounded-[5px] text-sm",
            live ? "btn-ghost px-3.5 py-[9px] text-ink" : "btn-red border-0 py-[9px] pl-3.5 pr-[9px] font-medium",
          )}
          aria-keyshortcuts={live ? undefined : "R"}
          onClick={live ? onCancel : onStart}
        >
          {live ? (
            <>
              <span className={s.spin} aria-hidden="true" />
              Cancel run
            </>
          ) : (
            <>
              Run Dyno <kbd className="kbd">R</kbd>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
