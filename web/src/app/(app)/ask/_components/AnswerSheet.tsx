"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { Answer } from "@/lib/api";
import type { Starter } from "@/lib/api/mock-data";
import { NOT_FOUND_TEXT } from "@/lib/ask";
import s from "../ask.module.css";

/** "boot" = before we know whether this is a fresh arrival: the sheet stays blank. */
export type View = "boot" | "empty" | "loading" | "answer" | "error";

const fmtS = (n: number) => `${n.toFixed(1)} s`;

/** The ruled answer sheet: starters, loading, or the cited answer. */
export function AnswerSheet(props: {
  view: View;
  answer: Answer | null;
  pendingQ: string;
  seq: number;
  docCount: number | null;
  courseName: string;
  starters: Starter[];
  /** Why the last ask failed, in words the server chose; null = generic. */
  errorMsg?: string | null;
  /** Real answers are on, but this course has no real documents yet. */
  sampleOnly?: boolean;
  picked: number;
  hover: number;
  showTiming: boolean;
  onAsk: (q: string) => void;
  onRetry: () => void;
  onPick: (n: number, keyboard: boolean) => void;
  onPeek: (n: number) => void;
  onFollowUp: (q: string) => void;
}) {
  const { view, answer } = props;
  return (
    <article className={`sheet ${s.article}`}>
      <div className={s.ruled}>
        <span aria-hidden="true" className={s.margin} />
        <span aria-hidden="true" className={s.qMark}>Q.</span>

        {view === "empty" && <Starters {...props} />}
        {view === "loading" && <Loading question={props.pendingQ} docCount={props.docCount} />}
        {view === "error" && (
          <div className={s.swapIn} role="alert">
            <h1 className={`${s.h1} max-w-[24em]`}>{props.pendingQ}</h1>
            <p className="m-0 text-[15px] leading-9 text-ink-2">
              {props.errorMsg ?? "Recall couldn’t reach your notes just now."}{" "}
              <button type="button" className="lnk lnk-hl border-0 bg-transparent p-0 text-ink" onClick={props.onRetry}>
                Try again
              </button>
            </p>
          </div>
        )}
        {view === "answer" && answer && <AnswerBody {...props} answer={answer} />}
      </div>
    </article>
  );
}

/** Shown wherever a course's answers can't be real yet. */
const SAMPLE_ONLY_TEXT =
  "This course’s PDFs are placeholders for now. Only Algorithms has real documents in this demo, so questions here come back as not found.";

function SampleOnlyNote() {
  return <p className="m-0 mt-3 max-w-[40em] text-sm leading-7 text-ink-3">{SAMPLE_ONLY_TEXT}</p>;
}

function Starters({
  docCount,
  courseName,
  starters,
  sampleOnly,
  onAsk,
}: {
  docCount: number | null;
  courseName: string;
  starters: Starter[];
  sampleOnly?: boolean;
  onAsk: (q: string) => void;
}) {
  if (docCount === 0) {
    return (
      <div className={s.swapIn}>
        <h1 className={`${s.h1} max-w-[22em]`}>{courseName} has no documents yet.</h1>
        <p className="m-0 max-w-[40em] text-[15px] leading-9 text-ink-2">
          Recall only answers from your own notes, so add a lecture PDF first.
        </p>
        <p className="m-0 mt-9 text-[15px] leading-9">
          <Link href="/library" className="lnk lnk-hl text-ink">Add PDFs to {courseName} in Library →</Link>
        </p>
      </div>
    );
  }
  return (
    <div className={s.swapIn}>
      <h1 className={`${s.h1} max-w-[22em]`}>Ask anything about {courseName}.</h1>
      <p className="m-0 max-w-[40em] text-[15px] leading-9 text-ink-2">
        {sampleOnly
          ? SAMPLE_ONLY_TEXT
          : `Answers come only from the ${docCount != null ? `${docCount} ` : ""}lecture PDFs in this course, each claim cited to its page.`}
      </p>
      {/* No real documents here, so a starter could only come back not found. */}
      {!sampleOnly && (
        <>
          <p className="m-0 mt-9 text-[13px] leading-9 text-ink-3">Try one of these</p>
          <div className="mt-0.5 flex flex-col items-start gap-2">
            {starters.map((q) => (
              <button key={q.id} type="button" className={s.starter} onClick={() => onAsk(q.question)}>
                <span className={s.starterQ}>{q.question}</span>
                <span className={s.starterGo} aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="m-0 mt-9 text-sm leading-9 text-ink-2">
        Or type your own below. Recall says so when your notes don’t cover it.
      </p>
    </div>
  );
}

function Loading({ question, docCount }: { question: string; docCount: number | null }) {
  return (
    <div className={s.swapIn} aria-busy="true">
      <h1 className={`${s.h1} max-w-[24em]`}>{question}</h1>
      <p className="num m-0 text-[13px] leading-9 text-ink-2" role="status">
        Searching {docCount ?? "your"} documents…
      </p>
      <div aria-hidden="true" className="mt-9 max-w-[38em]">
        <span className={s.skel} style={{ width: "92%" }} />
        <span className={s.skel} style={{ width: "78%" }} />
        <span className={s.skel} style={{ width: "64%" }} />
      </div>
    </div>
  );
}

function AnswerBody({
  answer,
  seq,
  docCount,
  courseName,
  sampleOnly,
  picked,
  hover,
  showTiming,
  onPick,
  onPeek,
  onFollowUp,
}: Parameters<typeof AnswerSheet>[0] & { answer: Answer }) {
  const t = answer.timing;
  const total = t.embed + t.search + t.rerank + t.generate;
  const meta = `Asked just now · ${courseName} · searched ${docCount ?? answer.sources.length} documents in ${fmtS(total)}`;
  const lbl = (n: number) => {
    const src = answer.sources.find((x) => x.n === n);
    return src ? `Show source ${n}, ${src.file} page ${src.page}` : `Show source ${n}`;
  };

  return (
    // key on seq: a new answer remounts the block so its entrance replays.
    <div key={seq} className={seq ? s.ansIn : ""}>
      <h1 className={`${s.h1} max-w-[24em]`}>{answer.question}</h1>
      <p className="num m-0 text-[13px] leading-9 text-ink-2">{meta}</p>

      <TimingBar timing={t} hidden={!showTiming} />

      {answer.notFound ? (
        // Nothing in the course was close enough to answer from: say so
        // plainly instead of guessing. (No model was called.)
        <section id="answer" aria-label="Answer" aria-live="polite" className="relative mt-9">
          <span aria-hidden="true" className={s.aMark}>A.</span>
          <p className="m-0 max-w-[38em] text-lg font-normal leading-9">{NOT_FOUND_TEXT}</p>
          {sampleOnly ? (
            <SampleOnlyNote />
          ) : (
            <p className="m-0 mt-3 max-w-[40em] text-sm leading-7 text-ink-3">
              Try different words, or a question about what this course covers.
            </p>
          )}
        </section>
      ) : (
        <section id="answer" aria-label="Answer" aria-live="polite" className="relative mt-9">
          <span aria-hidden="true" className={s.aMark}>A.</span>
          <p className="m-0 max-w-[38em] text-lg font-normal leading-9">
            {answer.claims.map((c, i) => {
              const n = i + 1;
              const on = n === picked;
              const peek = n === hover && !on;
              return (
                <Fragment key={n}>
                  {i > 0 && " "}
                  <span className={`${s.claim} ${on ? s.claimOn : ""} ${peek ? s.claimPeek : ""}`}>{c}</span>{" "}
                  <button
                    type="button"
                    className={`${s.cite} ${on ? s.citeOn : peek ? s.citePeek : ""}`}
                    aria-label={lbl(n)}
                    aria-pressed={on}
                    onClick={(e) => onPick(n, e.detail === 0)}
                    onMouseEnter={() => onPeek(n)}
                    onMouseLeave={() => onPeek(0)}
                    onFocus={() => onPeek(n)}
                    onBlur={() => onPeek(0)}
                  >
                    [{n}]
                  </button>
                  .
                </Fragment>
              );
            })}
          </p>
        </section>
      )}

      <div className="mt-[22px] flex flex-wrap gap-2">
        {answer.followUps.map((f) => (
          <button key={f} type="button" className="btn btn-ghost min-h-10 rounded px-3 py-2 text-sm" onClick={() => onFollowUp(f)}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { key: "embed", color: "var(--line-2)" },
  { key: "search", color: "var(--ink-3)" },
  { key: "rerank", color: "var(--red)" },
  { key: "generate", color: "var(--ink-2)" },
] as const;

/** Time per pipeline step; segment widths are proportional to seconds. */
function TimingBar({ timing, hidden }: { timing: Answer["timing"]; hidden: boolean }) {
  // Steps that took no time (no reranker yet; no model call for "not found")
  // are left out: a 0-wide segment's label would sit on top of its neighbours.
  const steps = STEPS.filter((st) => timing[st.key] > 0);
  const total = steps.reduce((n, st) => n + timing[st.key], 0) || 1;
  return (
    <div role="group" aria-label="Time spent per step" className={`mt-2 ${hidden ? s.timingOff : ""}`}>
      <div className="flex h-1 gap-0.5">
        {steps.map((st) => (
          // Shares of the total, not raw seconds: flex-grow values that add up
          // to less than 1 (a 0.5 s answer) would leave part of the bar empty.
          <span key={st.key} className="block" style={{ flex: `${timing[st.key] / total} 1 0%`, background: st.color }} />
        ))}
      </div>
      <div className="num mt-1.5 flex gap-0.5 font-mono text-xs leading-[26px] text-ink-2">
        {steps.map((st, i) => {
          // Too narrow a segment can't fit its time, so it shows just the step name.
          const share = timing[st.key] / total;
          const narrow = share < 0.1;
          // A sliver (search often takes 0.1 s of 2.6 s) can't fit even its name:
          // the label stays for screen readers only.
          const sliver = share < 0.06;
          return (
            <span
              key={st.key}
              // min-w-0 + clip: on a phone a label is cut off instead of running into the next one.
              className={`min-w-0 overflow-hidden whitespace-nowrap ${st.key === "rerank" ? "text-red" : ""} ${i === steps.length - 1 ? "text-right" : ""}`}
              style={{ flex: `${share} 1 0%` }}
            >
              <span className={sliver ? "sr-only" : ""}>
                {st.key}
                {!narrow && <>&nbsp;{fmtS(timing[st.key])}</>}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
