"use client";

import { Fragment } from "react";
import type { Answer } from "@/lib/api";
import { STARTERS } from "@/lib/api/mock-data";
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
              Recall couldn’t reach your notes just now.{" "}
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

function Starters({ docCount, courseName, onAsk }: { docCount: number | null; courseName: string; onAsk: (q: string) => void }) {
  return (
    <div className={s.swapIn}>
      <h1 className={`${s.h1} max-w-[22em]`}>Ask anything about {courseName}.</h1>
      <p className="m-0 max-w-[40em] text-[15px] leading-9 text-ink-2">
        Answers come only from the {docCount != null ? `${docCount} ` : ""}lecture PDFs in this course, each claim cited to its page.
      </p>
      <p className="m-0 mt-9 text-[13px] leading-9 text-ink-3">Try one of these</p>
      <div className="mt-0.5 flex flex-col items-start gap-2">
        {STARTERS.map((q) => (
          <button key={q.id} type="button" className={s.starter} onClick={() => onAsk(q.question)}>
            <span className={s.starterQ}>{q.question}</span>
            <span className={s.starterGo} aria-hidden="true">→</span>
          </button>
        ))}
      </div>
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
  const total = STEPS.reduce((n, st) => n + timing[st.key], 0) || 1;
  return (
    <div role="group" aria-label="Time spent per step" className={`mt-2 ${hidden ? s.timingOff : ""}`}>
      <div className="flex h-1 gap-0.5">
        {STEPS.map((st) => (
          <span key={st.key} className="block" style={{ flex: `${timing[st.key]} 1 0`, background: st.color }} />
        ))}
      </div>
      <div className="num mt-1.5 flex gap-0.5 font-mono text-xs leading-[26px] text-ink-2">
        {STEPS.map((st, i) => {
          // Too narrow a segment can't fit its time, so it shows just the step name.
          const narrow = timing[st.key] / total < 0.1;
          return (
            <span
              key={st.key}
              className={`${st.key === "rerank" ? "text-red" : ""} ${i === STEPS.length - 1 ? "text-right" : ""}`}
              style={{ flex: `${timing[st.key]} 1 0` }}
            >
              {st.key}
              {!narrow && <>&nbsp;{fmtS(timing[st.key])}</>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
