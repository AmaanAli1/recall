"use client";

import { Fragment, useState } from "react";
import {
  GOLDEN_URL,
  chapterOf,
  collapsed,
  commitUrl,
  f2,
  formatRunDate,
  hitsAt,
  questionChapter,
  ruleOfThreeFloor,
  type RealRun,
} from "@/lib/dyno-results";
import s from "../dyno.module.css";
import { cx } from "../_lib/model";
import { Chip } from "./Collapse";

/**
 * The Dyno page with real runs (v0: retrieval only). Shows exactly what the script
 * measured — recall@5 and MRR with their intervals, per-question ranks, the run's
 * setup — and nothing it didn't: faithfulness and relevancy stay "—" until v1.
 * Runs come from the laptop script, so there's no "Run Dyno" button here.
 */
export function DynoResults({ runs }: { runs: RealRun[] }) {
  const base = runs[0];
  const latest = runs[runs.length - 1];
  const single = runs.length === 1;
  return (
    <>
      <div className="mb-6">
        <h1 className="m-0 text-[54px] font-normal leading-[1.04] tracking-[-0.036em]">
          {single ? (
            <>
              Run 1: the <span className="text-red">baseline</span>.
            </>
          ) : (
            <>
              Run {latest.id.slice(1)}: {latest.change}
            </>
          )}
        </h1>
        <p className="mt-3.5 text-base text-ink-2">
          {latest.n} golden questions on the four Erickson chapters, retrieval only, measured {formatRunDate(latest.date)} against
          the live pipeline’s database.
        </p>
        <p className="mt-1.5 max-w-[42em] text-sm text-ink-2">
          {single ? "Every later change is measured against these numbers. " : ""}
          Recall@5 is at its ceiling on this question set, so MRR is the number retrieval upgrades have to move.
        </p>
      </div>

      <Scores run={latest} />
      <RunsLog runs={runs} base={base} />
      <QuestionRanks run={latest} />

      <p className="mt-6 max-w-[46em] text-sm leading-relaxed text-ink-2">
        Runs come from a command-line script, not from this page, so there’s no button to start one.{" "}
        <a href={GOLDEN_URL} className="lnk-hl text-ink">
          See the {latest.n} questions and their labelled pages →
        </a>
      </p>
    </>
  );
}

function Card({ title, value, valueLabel, lines }: { title: string; value: string; valueLabel?: string; lines: React.ReactNode[] }) {
  const muted = value === "—";
  return (
    <div className="sheet relative">
      <div className="ear bg-line-2 p-px">
        <div className="ear flex min-h-[196px] flex-col justify-between gap-2 bg-sheet px-[18px] pb-[22px] pt-[18px]">
          <h2 className="m-0 text-[15px] font-medium">{title}</h2>
          <p className={cx("num m-0 text-center text-[44px] font-normal tracking-[-0.03em]", muted && "text-ink-3")}>
            {valueLabel ? (
              <>
                <span aria-hidden="true">{value}</span>
                <span className="sr-only">{valueLabel}</span>
              </>
            ) : (
              value
            )}
          </p>
          <div className="flex flex-col gap-1">
            {lines.map((l, i) => (
              <p key={i} className={cx("m-0 text-center text-[13px] leading-normal", i === 0 ? "text-ink" : "text-ink-2")}>
                {l}
              </p>
            ))}
          </div>
        </div>
      </div>
      <span className="fold" aria-hidden="true" />
    </div>
  );
}

function Scores({ run }: { run: RealRun }) {
  const recall = run.metrics.recall5;
  const mrr = run.metrics.mrr;
  const hits = hitsAt(run, 5);
  return (
    <section aria-label="Latest run's scores" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
      <Card
        title="Recall@5"
        value={`${hits}/${run.n}`}
        valueLabel={`${hits} of ${run.n} questions`}
        lines={[
          `${f2(recall.value)}: the right page was in the top 5 ${hits === run.n ? "for every question" : `for ${hits} questions`}`,
          collapsed(recall)
            ? `With every question a hit, the 95% interval can’t be measured. ${hits}/${run.n} still allows a true recall as low as ${f2(ruleOfThreeFloor(run.n))}.`
            : `95% interval ${f2(recall.low)}–${f2(recall.high)}`,
        ]}
      />
      <Card
        title="MRR"
        value={f2(mrr.value)}
        lines={[`95% interval ${f2(mrr.low)}–${f2(mrr.high)}`, "How high the right page ranks: 1.00 means always first"]}
      />
      <Card title="Faithfulness" value="—" valueLabel="Not measured yet" lines={["Not measured in v0", "Needs the answer model and a judge (v1)"]} />
      <Card title="Answer relevancy" value="—" valueLabel="Not measured yet" lines={["Not measured in v0", "Needs the answer model and a judge (v1)"]} />
    </section>
  );
}

function RunsLog({ runs, base }: { runs: RealRun[]; base: RealRun }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const cell = "p-4 text-right font-mono text-sm whitespace-nowrap";
  return (
    <section aria-labelledby="runs-h" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="runs-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">Runs</h2>
        <span className="text-[13px] text-ink-2">Newest first. Open a run’s details to see its full setup.</span>
      </div>
      <div className="sheet">
        {/* Focusable so keyboard users can scroll it sideways on a phone. */}
        <div role="group" aria-label="Runs table" tabIndex={0} className="relative overflow-x-auto rounded border border-line bg-sheet">
          <table className="num w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-xs text-ink-2">
                <th scope="col" className="px-5 py-3.5 font-medium">Run</th>
                <th scope="col" className="px-4 py-3.5 font-medium">Change tested</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">Recall@5</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">MRR</th>
                <th scope="col" className="px-4 py-3.5 text-right font-medium">Gate</th>
                <th scope="col" className="py-3.5 pl-1 pr-5 text-right font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => {
                const isOpen = open.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr className={cx(s.row, "border-t border-line")}>
                      <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-mono text-sm font-normal">
                        <span className={s.runId}>{r.id}</span> <span className="ml-2.5 text-ink-2">{formatRunDate(r.date, false)}</span>
                      </th>
                      <td className="p-4 font-normal">{r.change}</td>
                      <td className={cell}>
                        {hitsAt(r, 5)}/{r.n}
                      </td>
                      <td className={cell}>{f2(r.metrics.mrr.value)}</td>
                      <td className="p-4 text-right">
                        {/* v0 has no redline gate yet (that's v1, in CI); the first run is the baseline. */}
                        <Chip tone="neutral">{r.id === base.id ? "Baseline" : "Logged"}</Chip>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-1 pr-5 text-right">
                        <button
                          type="button"
                          className={s.detBtn}
                          aria-expanded={isOpen}
                          aria-controls={`det-${r.id}`}
                          aria-label={`${isOpen ? "Hide" : "Show"} details for run ${r.id.slice(1)}`}
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
                      <td colSpan={6}>
                        <div id={`det-${r.id}`} className={cx(s.collapse, isOpen && s.open)} inert={!isOpen}>
                          <div className={s.clip}>
                            <div className={s.slide}>
                              <div className={s.detIn}>
                                <RunSetup run={r} />
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
    </section>
  );
}

function RunSetup({ run }: { run: RealRun }) {
  const rows: { label: string; v: string; href?: string }[] = [
    { label: "Chunking", v: run.setup.chunking },
    { label: "Retrieval", v: run.setup.retrieval },
    { label: "Chunks ranked per question", v: String(run.setup.topK) },
    { label: "Reranker", v: run.setup.reranker },
    { label: "Query rewriting", v: run.setup.rewriting },
    { label: "Embeddings", v: run.setup.embedModel },
    { label: "Recall@5 · MRR (95% interval)", v: `${f2(run.metrics.recall5.value)} · ${f2(run.metrics.mrr.value)} (${f2(run.metrics.mrr.low)}–${f2(run.metrics.mrr.high)})` },
    { label: "Run time · cost", v: `${run.durationS.toFixed(1)} s · ${run.tokens} tokens, under $0.01` },
    { label: "Git commit", v: run.commit, href: commitUrl(run.commit) },
    { label: "Golden set", v: `${run.n} questions, page-labelled` },
  ];
  return (
    <>
      <p className="m-0 mb-3 text-[13px] text-ink-2">Retrieval only: each question is embedded and the top {run.setup.topK} chunks are ranked. No answer model.</p>
      <dl className={s.detGrid}>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              {r.href ? (
                <a href={r.href} className="lnk-hl">
                  {r.v}
                </a>
              ) : (
                r.v
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** ["12 × 1st", "5 × 2nd", …, "1 × not in top 10"], best ranks first. */
function rankSummary(run: RealRun): string[] {
  const counts = new Map<number | null, number>();
  for (const q of run.questions) counts.set(q.rank, (counts.get(q.rank) ?? 0) + 1);
  const ranks = [...counts.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));
  return ranks.map((r) => `${counts.get(r)} × ${r === null ? "not in top 10" : ordinal(r)}`);
}

/**
 * Every question's rank. Collapsed by default (20 rows is a lot to scroll past):
 * the summary line says how the ranks fell, and the button opens the full table.
 */
function QuestionRanks({ run }: { run: RealRun }) {
  const [open, setOpen] = useState(false);
  const notFirst = run.questions.filter((q) => q.rank !== 1).length;
  return (
    <section aria-labelledby="ranks-h" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="ranks-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">Where each right page ranked</h2>
        <span className="text-[13px] text-ink-2">
          Run {run.id.slice(1)}. {notFirst} of {run.n} weren’t first: those are the targets for a reranker.
        </span>
      </div>
      <div className="sheet">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-sheet px-5 py-3.5">
          <p className="num m-0 font-mono text-sm">
            {/* Each "count × rank" stays on one line; lines only break between groups. */}
            {rankSummary(run).map((part, i) => (
              <Fragment key={part}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
          </p>
          <button
            type="button"
            className={s.detBtn}
            aria-expanded={open}
            aria-controls="ranks-table"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide the questions" : `Show all ${run.n} questions`}
            <svg className={s.detChev} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div id="ranks-table" className={cx(s.collapse, open && s.open)} inert={!open}>
        <div className={s.clip}>
          <div className={cx(s.slide, "pt-3")}>
            <div className="sheet">
              <div role="group" aria-label="Question ranks table" tabIndex={0} className="relative overflow-x-auto rounded border border-line bg-sheet">
                <table className="num w-full min-w-[620px] border-collapse text-[15px]">
                  <thead>
                    <tr className="text-left text-xs text-ink-2">
                      <th scope="col" className="px-5 py-3.5 font-medium">Question</th>
                      <th scope="col" className="px-4 py-3.5 font-medium">Chapter</th>
                      <th scope="col" className="px-4 py-3.5 text-right font-medium">Right page ranked</th>
                      <th scope="col" className="py-3.5 pl-4 pr-5 font-medium">Top result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.questions.map((q) => {
                      const top = q.top[0];
                      return (
                        <tr key={q.id} className="border-t border-line">
                          <th scope="row" className="whitespace-nowrap px-5 py-3 text-left font-mono text-sm font-normal">
                            {q.id}
                          </th>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{questionChapter(q.id)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {q.rank === null ? (
                              <Chip tone="bad">Not in top 10</Chip>
                            ) : q.rank === 1 ? (
                              <span className="font-mono text-sm">1st</span>
                            ) : (
                              <Chip tone={q.rank <= 5 ? "mid" : "bad"}>{ordinal(q.rank)}</Chip>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-3 pl-4 pr-5 font-mono text-sm text-ink-2">
                            {top ? `${chapterOf(top.file)} p. ${top.page} · ${top.score.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              The score is cosine similarity between the question and the passage (1 = same meaning). A question counts as found when a
              chunk from one of its labelled pages comes back.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
