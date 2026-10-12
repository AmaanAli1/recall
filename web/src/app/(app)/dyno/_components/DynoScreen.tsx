"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { listDynoRuns, startDynoRun, type DynoRun } from "@/lib/api";
import { cx, estimateOf, gateOf, liveN, nextRunId, runNum, upsertRun, type ChartMetric, type LiveView, type Role, type RunState } from "../_lib/model";
import s from "../dyno.module.css";
import { Collapse } from "./Collapse";
import { ComparePanel } from "./ComparePanel";
import { DynoHeader } from "./DynoHeader";
import { Gauges } from "./Gauges";
import { RunPanel } from "./RunPanel";
import { RunsTable } from "./RunsTable";
import { SideCards } from "./SideCards";
import { TrendChart } from "./TrendChart";

/** Short "Oct 11" label for a run started now (the backend reports the real date on done). */
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * The Dyno screen: owns the run history, the in-flight run, the compare
 * selection and the hover that links chart and table. Children are pure views.
 */
export function DynoScreen() {
  const [runs, setRuns] = useState<DynoRun[] | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [metric, setMetric] = useState<ChartMetric>("recall");
  const [hover, setHover] = useState<string | null>(null);
  const [cmpOpen, setCmpOpen] = useState(false);
  // null = follow the default (A = latest, B = baseline), so a new run becomes A automatically.
  const [cmpA, setCmpA] = useState<string | null>(null);
  const [cmpB, setCmpB] = useState<string | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const compareBtn = useRef<HTMLButtonElement>(null);
  const runBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    listDynoRuns().then((r) => {
      if (alive) setRuns(r);
    });
    return () => {
      alive = false;
      cancelRef.current?.(); // stop the stream/timers if we navigate away mid-run
    };
  }, []);

  const running = run?.status === "running";

  const start = useCallback(() => {
    if (!runs || runs.length === 0 || cancelRef.current) return;
    const anchor = runs[runs.length - 1];
    const startedAt = performance.now();
    setRun({ id: nextRunId(runs), date: today(), progress: { done: 0, total: anchor.n, stage: "retrieve" }, status: "running", finished: null, elapsedMs: 0, anchor });
    setPanelClosed(false);
    setHover(null);
    // Starting a run is the newest intent, so it takes the panel slot from Compare.
    setCmpOpen(false);
    cancelRef.current = startDynoRun(
      (p) => setRun((r) => (r && r.status === "running" ? { ...r, progress: p } : r)),
      (finished) => {
        cancelRef.current = null;
        setRuns((rs) => upsertRun(rs ?? [], finished));
        setRun((r) => (r && r.status === "running" ? { ...r, id: finished.id, status: "done", finished, elapsedMs: performance.now() - startedAt } : r));
      },
    );
  }, [runs]);

  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    // Freeze the panel as "cancelled"; it folds away because it's no longer running.
    setRun((r) => (r ? { ...r, status: "cancelled" } : r));
  }, []);

  const closeCompare = useCallback(() => {
    setCmpOpen(false);
    compareBtn.current?.focus(); // the panel is about to be hidden; don't strand focus inside it
  }, []);

  // Keyboard shortcuts shown on the buttons: C toggles compare, R starts a run.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const key = e.key.toLowerCase();
    if (key === "c" && runs) {
      e.preventDefault();
      if (cmpOpen) closeCompare();
      else setCmpOpen(true);
    } else if (key === "r" && !running) {
      e.preventDefault();
      start();
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!runs || runs.length === 0) {
    return (
      <main id="main" className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-6 pb-[88px] pt-14" aria-busy={!runs}>
        <p className="text-ink-2" role="status">
          {runs ? "No Dyno runs yet." : "Loading runs…"}
        </p>
      </main>
    );
  }

  const base = runs[0];
  const latest = runs[runs.length - 1];

  const live: LiveView | null =
    run && running
      ? {
          id: run.id,
          date: run.date,
          done: run.progress.done,
          total: run.progress.total,
          n: liveN(run.progress.done),
          est: (k) => estimateOf(run.anchor, k, run.progress.done, run.progress.total),
        }
      : null;

  const has = (id: string | null) => id != null && runs.some((r) => r.id === id);
  const a = has(cmpA) ? (cmpA as string) : latest.id;
  const b = has(cmpB) ? (cmpB as string) : base.id;
  const roleOf = (id: string): Role => (!cmpOpen ? null : id === a ? "A" : id === b ? "B" : null);

  // One big panel at a time: while Compare is open, a visible run shrinks to a one-line strip.
  const runVisible = !!run && (running || (run.status === "done" && !panelClosed));

  const finishedIdx = run?.finished ? runs.findIndex((r) => r.id === run.finished?.id) : -1;
  const prev = finishedIdx > 0 ? runs[finishedIdx - 1] : null;

  return (
    <main id="main" className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-6 pb-[88px] pt-14">
      <DynoHeader
        latest={latest}
        base={base}
        live={live}
        compareOpen={cmpOpen}
        onToggleCompare={() => setCmpOpen((o) => !o)}
        onStart={start}
        onCancel={cancel}
        compareRef={compareBtn}
        runRef={runBtn}
      />

      <div className="-mt-4 flex flex-col">
        {run && (
          <RunPanel
            open={runVisible && !cmpOpen}
            run={run}
            prev={prev}
            base={base}
            onClose={() => {
              setPanelClosed(true);
              runBtn.current?.focus();
            }}
          />
        )}
        <Collapse open={runVisible && cmpOpen}>
          <div className="num flex items-center gap-3 rounded border border-line-2 bg-sheet py-2.5 pl-4 pr-3 text-sm">
            <span
              aria-hidden="true"
              className={cx("h-2 w-2 flex-none rounded-full", running && s.blink)}
              style={{ background: running ? "var(--mid)" : run?.finished && gateOf(run.finished, base) === "fail" ? "var(--bad)" : "var(--good)" }}
            />
            {/* Not a live region on purpose: the count changes many times a second. */}
            <span className="min-w-0 flex-auto">
              {running && run
                ? `Run ${runNum(run.id)} running · ${run.progress.done} of ${run.progress.total} questions`
                : run?.finished
                  ? `Run ${runNum(run.finished.id)} finished · ${gateOf(run.finished, base) === "fail" ? "into the redline" : "clear of every redline"}`
                  : ""}
            </span>
            <button type="button" className="btn btn-ghost min-h-[34px] flex-none rounded bg-paper! px-3 py-1.5 text-[13px]" onClick={() => setCmpOpen(false)}>
              Show run
            </button>
          </div>
        </Collapse>
        <ComparePanel
          open={cmpOpen}
          runs={runs}
          base={base}
          a={a}
          b={b}
          onPickA={setCmpA}
          onPickB={setCmpB}
          onSwap={() => {
            setCmpA(b);
            setCmpB(a);
          }}
          onReset={() => setCmpB(base.id)}
          onClose={closeCompare}
        />
      </div>

      <Gauges latest={latest} base={base} live={live} />

      <div className="flex flex-wrap gap-4">
        <TrendChart runs={runs} base={base} latest={latest} metric={metric} onMetric={setMetric} hover={hover} onHover={setHover} live={live} roleOf={roleOf} />
        <SideCards latest={latest} base={base} />
      </div>

      <RunsTable runs={runs} base={base} hover={hover} onHover={setHover} live={live} roleOf={roleOf} />
    </main>
  );
}
