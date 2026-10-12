"use client";

import { Fragment, useState } from "react";
import type { DynoRun, RunConfig, RunSetting } from "@/lib/api";
import { redline, signed } from "@/lib/stats";
import s from "../dyno.module.css";
import { LABEL, cx, f2, failedMetrics, gateOf, runNum, type LiveView, type Role } from "../_lib/model";
import { Chip } from "./Collapse";

interface Props {
  runs: DynoRun[];
  base: DynoRun;
  hover: string | null;
  onHover: (id: string | null) => void;
  live: LiveView | null;
  roleOf: (id: string) => Role;
}

/** Change vs the previous run: colour carries direction, "±0.00" when flat, "—" for the first run. */
function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null) return <span className={cx(s.dlt, "text-ink-3")}>—</span>;
  const d = Number((cur - prev).toFixed(2));
  return <span className={cx(s.dlt, d > 0 ? "text-good" : d < 0 ? "text-bad" : "text-ink-3")}>{signed(d)}</span>;
}

const cell = "p-4 text-right font-mono text-sm whitespace-nowrap";

const SETTING_LABEL: Record<RunSetting, string> = {
  chunking: "Chunking",
  retrieval: "Retrieval",
  topK: "Top-k cited",
  reranker: "Reranker",
  rewriting: "Query rewriting",
  prompt: "Prompt",
};

const minSec = (s: number) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;

/**
 * A run's full setup, in place of a link to MLflow (MLflow is private and has no
 * login, so visitors could never open it). The one setting this run changed is
 * highlighted: that's the whole idea of Dyno, change one thing and measure.
 */
function RunDetails({ run, cfg }: { run: DynoRun; cfg: RunConfig | undefined }) {
  if (!cfg) return <p className="m-0 text-[13px] text-ink-2">No setup was logged for this run.</p>;
  const settings = (Object.keys(SETTING_LABEL) as RunSetting[]).map((k) => ({ k, label: SETTING_LABEL[k], v: String(cfg[k]), changed: cfg.changed.includes(k) }));
  const rows: { label: string; v: string; changed?: boolean; href?: string }[] = [
    ...settings,
    { label: "Embeddings", v: cfg.embedModel },
    { label: "Answer model", v: cfg.answerModel },
    { label: "Judge model", v: cfg.judgeModel },
    { label: "MRR · correctness · relevancy", v: `${f2(run.metrics.mrr)} · ${f2(run.metrics.correct)} · ${f2(run.metrics.relev)}` },
    { label: "Run time · cost", v: `${minSec(cfg.durationS)} · $${cfg.costUsd.toFixed(2)}` },
    // TODO(phase 3): link to github.com/AmaanAli1/recall/commit/<sha> once runs log real commits (the sample SHAs would 404).
    { label: "Git commit", v: cfg.commit },
    { label: "Golden set", v: `${run.n} questions, page-labelled` },
  ];
  return (
    <>
      <p className="m-0 mb-3 text-[13px] text-ink-2">
        {cfg.changed.length
          ? "Highlighted: the one setting this run changed. Everything else matches the run before."
          : "The baseline every later run is measured against."}
      </p>
      <dl className={s.detGrid}>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              {r.href ? (
                <a href={r.href} className="lnk-hl">{r.v}</a>
              ) : (
                <span className={r.changed ? s.detChg : undefined}>{r.v}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** MLflow-style run log, newest first, linked to the chart by hover. */
export function RunsTable({ runs, base, hover, onHover, live, roleOf }: Props) {
  const [details, setDetails] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setDetails((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const faithRed = redline(base.metrics.faith);
  const firstFail = runs.find((r) => gateOf(r, base) === "fail");
  const failKey = firstFail ? failedMetrics(firstFail, base)[0] : null;

  return (
    <section aria-labelledby="runs-h" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="runs-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">Runs</h2>
        <span className="text-[13px] text-ink-2">Logged to MLflow, newest first. Open a run’s details to see its full setup.</span>
      </div>
      <div className="sheet">
        <div className="relative overflow-x-auto rounded border border-line bg-sheet">
          <table className="num w-full min-w-[860px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-xs text-ink-2">
                <th scope="col" className="px-5 py-3.5 font-medium">Run</th>
                <th scope="col" className="px-4 py-3.5 font-medium">Change tested</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">Recall@5</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">Faithfulness</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">p95</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">Gate</th>
                <th scope="col" className="py-3.5 pl-1 pr-5">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {live && (
                <tr
                  className={cx(s.row, s.live, hover === live.id && s.on, "border-t border-line")}
                  onMouseEnter={() => onHover(live.id)}
                  onMouseLeave={() => onHover(null)}
                >
                  <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-mono text-sm font-normal">
                    <span className={s.runId}>{live.id}</span> <span className="ml-2.5 text-ink-2">{live.date}</span>
                  </th>
                  <td className="p-4 font-normal">In progress</td>
                  <td className={cell}>
                    {f2(live.est("recall"))}
                    <span className={cx(s.dlt, "text-ink-3")}>so far</span>
                  </td>
                  <td className={cx(cell, "text-ink-2")}>
                    {f2(live.est("faith"))}
                    <span className={cx(s.dlt, "text-ink-3")}>so far</span>
                  </td>
                  <td className={cell}>…</td>
                  <td className="p-4 text-right">
                    <Chip tone="mid" fill>
                      Running {live.done}/{live.total}
                    </Chip>
                  </td>
                  <td className="py-4 pl-1 pr-5 text-right" />
                </tr>
              )}
              {runs
                .map((r, i) => ({ r, prev: i > 0 ? runs[i - 1] : null }))
                .reverse()
                .map(({ r, prev }) => {
                  const gate = gateOf(r, base);
                  const fail = gate === "fail";
                  const role = roleOf(r.id);
                  const on = hover === r.id;
                  const open = details.has(r.id);
                  return (
                    <Fragment key={r.id}>
                    <tr
                      className={cx(s.row, fail && s.fail, role && s.cmp, on && s.on, "border-t border-line")}
                      onMouseEnter={() => onHover(r.id)}
                      onMouseLeave={() => onHover(null)}
                      // Focus inside the row (the Details button) lights it the same way hover does.
                      onFocus={() => onHover(r.id)}
                      onBlur={() => onHover(null)}
                    >
                      <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-mono text-sm font-normal">
                        <span className={s.runId}>{r.id}</span>
                        {role && (
                          <span className={cx(role === "A" ? s.tagA : s.tagB, "ml-2")}>
                            {role}
                          </span>
                        )}{" "}
                        <span className="ml-2.5 text-ink-2">{r.date}</span>
                      </th>
                      <td className="p-4 font-normal">{r.change}</td>
                      <td className={cell}>
                        {f2(r.metrics.recall)}
                        <Delta cur={r.metrics.recall} prev={prev ? prev.metrics.recall : null} />
                      </td>
                      <td className={cx(cell, r.metrics.faith < faithRed && "font-semibold text-bad")}>
                        {f2(r.metrics.faith)}
                        <Delta cur={r.metrics.faith} prev={prev ? prev.metrics.faith : null} />
                      </td>
                      <td className={cell}>{r.p95.toFixed(1)} s</td>
                      <td className="p-4 text-right">
                        <Chip tone={fail ? "bad" : gate === "pass" ? "good" : "neutral"} fill={fail}>
                          {fail ? "Redline" : gate === "pass" ? "Clear" : "Baseline"}
                        </Chip>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-1 pr-5 text-right">
                        <button
                          type="button"
                          className={s.detBtn}
                          aria-expanded={open}
                          aria-controls={`det-${r.id}`}
                          aria-label={`${open ? "Hide" : "Show"} details for run ${runNum(r.id)}`}
                          onClick={() => toggle(r.id)}
                        >
                          Details
                          <svg className={s.detChev} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr className={s.detRow}>
                      <td colSpan={7}>
                        <div id={`det-${r.id}`} className={cx(s.collapse, open && s.open)} inert={!open}>
                          <div className={s.clip}>
                            <div className={s.slide}>
                              <div className={s.detIn}>
                                <RunDetails run={r} cfg={r.config} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-sm font-normal text-ink-2">
        Changes are measured against the previous run.
        {firstFail && failKey && (
          <>
            {" "}
            Run {runNum(firstFail.id)} hit the redline: {LABEL[failKey].toLowerCase()} fell to {f2(firstFail.metrics[failKey])}, under the{" "}
            {f2(redline(base.metrics[failKey]))} line, so the merge was blocked.
          </>
        )}
      </p>
    </section>
  );
}
