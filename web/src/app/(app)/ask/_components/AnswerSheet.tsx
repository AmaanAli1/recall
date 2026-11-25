"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Answer } from "@/lib/api";
import type { Starter } from "@/lib/api/mock-data";
import { NOT_FOUND_TEXT } from "@/lib/ask";
import type { Turn } from "@/lib/thread";
import s from "../ask.module.css";

/**
 * "boot" = before we know whether this is a fresh arrival: the sheet stays blank.
 * "loading" / "error" = opening a saved chat. "thread" = the conversation.
 */
export type View = "boot" | "empty" | "loading" | "error" | "thread";

const fmtS = (n: number) => `${n.toFixed(1)} s`;

/** The ruled answer sheet: starters, or the conversation so far. */
export function AnswerSheet(props: {
  view: View;
  turns: Turn[];
  /** The turn whose sources are showing; its [n] can be picked and peeked. */
  activeKey: number | null;
  /** Chat title while a saved chat opens (and if opening it failed). */
  pendingQ: string;
  docCount: number | null;
  courseName: string;
  starters: Starter[];
  /** Real answers are on, but this course has no real documents yet. */
  sampleOnly?: boolean;
  picked: number;
  hover: number;
  showTiming: boolean;
  /** Type new answers in (false: reduced motion or the calm setting). */
  animate: boolean;
  /** Smooth scrolling to a new question (false: reduced motion, calm, keyboard). */
  smooth: boolean;
  onAsk: (q: string) => void;
  onRetry: () => void;
  onPick: (key: number, n: number, keyboard: boolean) => void;
  onPeek: (n: number) => void;
  onFollowUp: (q: string) => void;
  /** How many of a fresh turn's claims have finished typing (Sources shows their cards). */
  onRevealed: (key: number, claims: number) => void;
}) {
  const { view } = props;
  return (
    <article className={`sheet ${s.article}`}>
      <div className={s.ruled}>
        <span aria-hidden="true" className={s.margin} />
        {/* In the conversation, each turn has its own Q. mark. */}
        {view !== "thread" && <span aria-hidden="true" className={s.qMark}>Q.</span>}

        {view === "empty" && <Starters {...props} />}
        {view === "loading" && <Loading question={props.pendingQ} docCount={props.docCount} heading={1} />}
        {view === "error" && (
          <div className={s.swapIn} role="alert">
            <h1 className={`${s.h1} max-w-[24em]`}>{props.pendingQ}</h1>
            <p className="m-0 text-[15px] leading-9 text-ink-2">
              Recall couldn’t reach the course’s documents just now.{" "}
              <button type="button" className="lnk lnk-hl border-0 bg-transparent p-0 text-ink" onClick={props.onRetry}>
                Try again
              </button>
            </p>
          </div>
        )}
        {view === "thread" && (
          <ol className="m-0 list-none p-0" aria-label="Conversation">
            {props.turns.map((t, i) => (
              <TurnBlock key={t.key} {...props} turn={t} index={i} last={i === props.turns.length - 1} />
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

/** The ruled sheet's top + bottom padding, so a full-height turn fits exactly. */
const SHEET_PADDING = 72;

/**
 * One question and its answer. The first question is the page's h1 (it's
 * also the chat's title); follow-ups are h2s with the same look.
 */
function TurnBlock(
  props: Parameters<typeof AnswerSheet>[0] & { turn: Turn; index: number; last: boolean },
) {
  const { turn, index, last, smooth } = props;
  const el = useRef<HTMLLIElement>(null);
  const H = index === 0 ? "h1" : "h2";

  // The newest question scrolls to the top of the sheet: once when it's
  // asked (loading lines under it), and again when its answer lands and the
  // sheet has grown enough to bring it all the way up. Earlier turns stay
  // above it, a scroll away. The first question needs no scrolling.
  // (Read through a ref: switching "calm" on mustn't scroll anything by itself.)
  const status = turn.status;
  const smoothRef = useRef(smooth);
  useEffect(() => {
    smoothRef.current = smooth;
  }, [smooth]);
  useEffect(() => {
    if (!last || index === 0) return;
    el.current?.scrollIntoView({ block: "start", behavior: smoothRef.current ? "smooth" : "auto" });
  }, [last, index, status]);

  // Where the sheet scrolls on its own (wide screens), the newest turn is at
  // least as tall as the visible sheet, so it can always come up to the top
  // even before its answer has typed in, like a chat app. On phones the page
  // scrolls instead and no blank space is added.
  useEffect(() => {
    const li = el.current;
    const sheet = li?.closest("article");
    if (!li || !sheet || !last || index === 0 || getComputedStyle(sheet).overflowY === "visible") return;
    li.style.minHeight = `${Math.max(0, sheet.clientHeight - SHEET_PADDING)}px`;
    return () => {
      li.style.minHeight = "";
    };
  }, [last, index]);

  return (
    <li ref={el} className={`relative ${index > 0 ? s.turnNext : ""}`} data-turn={turn.key}>
      <span aria-hidden="true" className={s.tqMark}>Q.</span>
      <H className={`${s.h1} max-w-[24em]`}>{turn.question}</H>

      {turn.status === "loading" && <Loading docCount={props.docCount} />}
      {turn.status === "error" && (
        <div className={s.swapIn} role="alert">
          <p className="m-0 text-[15px] leading-9 text-ink-2">
            {turn.errorMsg ?? "Recall couldn’t reach the course’s documents just now."}{" "}
            {last && (
              <button type="button" className="lnk lnk-hl border-0 bg-transparent p-0 text-ink" onClick={props.onRetry}>
                Try again
              </button>
            )}
          </p>
        </div>
      )}
      {turn.status === "answer" && turn.answer && <AnswerBody {...props} answer={turn.answer} />}
    </li>
  );
}

/** Shown wherever a course's answers can't be real yet. */
const SAMPLE_ONLY_TEXT =
  "This course’s PDFs aren’t loaded, so questions here come back as not found. The demo’s course is Algorithms.";

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
          Recall only answers from a course’s documents, and none are loaded here.
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
          : `Answers come only from the ${docCount != null ? `${docCount} ` : ""}PDFs in this course, each claim cited to its page.`}
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
        Or type your own below. Recall says so when the book doesn’t cover it.
      </p>
    </div>
  );
}

/** Loading lines. With a question, it also shows the heading (opening a saved chat). */
function Loading({ question, docCount, heading }: { question?: string; docCount: number | null; heading?: 1 }) {
  return (
    <div className={s.swapIn} aria-busy="true">
      {heading && <h1 className={`${s.h1} max-w-[24em]`}>{question}</h1>}
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

/** About 20 ms a word, so a typical 60–90-word answer types in within ~1.5 s. */
const MS_PER_WORD = 20;
const REVEAL_MIN_MS = 500;
const REVEAL_MAX_MS = 1500;

/**
 * How many words of a fresh answer to show. The answer has already arrived
 * whole (no streaming yet), so this only paces how it appears. Off = all
 * words at once (reduced motion, the calm setting, or a chat opened later).
 */
function useReveal(total: number, on: boolean): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!on) return;
    const ms = Math.min(REVEAL_MAX_MS, Math.max(REVEAL_MIN_MS, total * MS_PER_WORD));
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const n = Math.min(total, Math.ceil(((now - start) / ms) * total));
      setShown(n);
      if (n < total) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, on]);
  // Turning animation off mid-way (calm switched on) shows the rest at once.
  return on ? shown : total;
}

function AnswerBody({
  answer,
  turn,
  activeKey,
  docCount,
  courseName,
  sampleOnly,
  picked,
  hover,
  showTiming,
  animate,
  last,
  onPick,
  onPeek,
  onFollowUp,
  onRevealed,
}: Parameters<typeof TurnBlock>[0] & { answer: Answer }) {
  const active = turn.key === activeKey;
  const t = answer.timing;
  const total = (t.rewrite ?? 0) + t.embed + t.search + t.rerank + t.generate;
  const meta = `${turn.fresh ? "Asked just now · " : ""}${courseName} · searched ${docCount ?? answer.sources.length} documents in ${fmtS(total)}`;
  const lbl = (n: number) => {
    const src = answer.sources.find((x) => x.n === n);
    return src ? `Show source ${n}, ${src.file} page ${src.page}` : `Show source ${n}`;
  };

  // The typing effect: each claim's words, and where each claim starts in the count.
  const words = answer.claims.map((c) => c.split(/\s+/).filter(Boolean));
  const starts = words.map((_, i) => words.slice(0, i).reduce((n, w) => n + w.length, 0));
  const totalWords = words.reduce((n, w) => n + w.length, 0);
  const shown = useReveal(totalWords, !!turn.fresh && animate && !answer.notFound);
  const typing = shown < totalWords;
  const claimsDone = words.filter((w, i) => starts[i] + w.length <= shown).length;

  // Tell the workspace as each claim finishes, so its source card appears beside it.
  useEffect(() => {
    if (turn.fresh) onRevealed(turn.key, claimsDone);
  }, [turn.fresh, turn.key, claimsDone, onRevealed]);

  return (
    <div className={turn.fresh ? s.ansIn : ""}>
      <p className="num m-0 text-[13px] leading-9 text-ink-2">{meta}</p>
      {/* A follow-up like "why does that fail?" is rewritten before search; show what was searched. */}
      {answer.searchedFor && (
        <p className="m-0 -mt-1.5 mb-1 text-[13px] leading-snug text-ink-2">
          Searched for <q className="text-ink">{answer.searchedFor}</q>
        </p>
      )}

      <TimingBar timing={t} hidden={!showTiming} />

      {answer.notFound ? (
        // Nothing in the course was close enough to answer from: say so
        // plainly instead of guessing. (No model was called.)
        <section aria-label={`Answer to ${turn.question}`} aria-live="polite" className="relative mt-9">
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
        // aria-busy while typing: screen readers wait and read the finished answer once.
        <section aria-label={`Answer to ${turn.question}`} aria-live="polite" aria-busy={typing} className="relative mt-9">
          <span aria-hidden="true" className={s.aMark}>A.</span>
          <p className="m-0 max-w-[38em] text-lg font-normal leading-9">
            {answer.claims.map((c, i) => {
              const n = i + 1;
              const visible = Math.max(0, Math.min(words[i].length, shown - starts[i]));
              if (visible === 0) return null; // not reached yet
              const done = visible === words[i].length;
              // Only the turn whose sources are showing highlights its picked/peeked claim.
              const on = active && n === picked;
              const peek = active && n === hover && !on;
              return (
                <Fragment key={n}>
                  {i > 0 && " "}
                  <span className={`${s.claim} ${on ? s.claimOn : ""} ${peek ? s.claimPeek : ""}`}>
                    {done ? c : words[i].slice(0, visible).join(" ")}
                  </span>
                  {done ? (
                    <>
                      {" "}
                      {/* nowrap: the full stop never wraps away from its [n]. */}
                      <span className="whitespace-nowrap">
                        <button
                          type="button"
                          className={`${s.cite} ${on ? s.citeOn : peek ? s.citePeek : ""}`}
                          aria-label={lbl(n)}
                          aria-pressed={on}
                          onClick={(e) => onPick(turn.key, n, e.detail === 0)}
                          onMouseEnter={() => active && onPeek(n)}
                          onMouseLeave={() => active && onPeek(0)}
                          onFocus={() => active && onPeek(n)}
                          onBlur={() => active && onPeek(0)}
                        >
                          [{n}]
                        </button>
                        .
                      </span>
                    </>
                  ) : (
                    <span aria-hidden="true" className={s.caret} />
                  )}
                </Fragment>
              );
            })}
          </p>
        </section>
      )}

      {/* Suggested follow-ups only under the newest answer, once it has finished typing. */}
      {last && !typing && answer.followUps.length > 0 && (
        <div className="mt-[22px] flex flex-wrap gap-2">
          {answer.followUps.map((f) => (
            <button key={f} type="button" className="btn btn-ghost min-h-10 rounded px-3 py-2 text-sm" onClick={() => onFollowUp(f)}>
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { key: "rewrite", color: "var(--ink-3)" },
  { key: "embed", color: "var(--line-2)" },
  { key: "search", color: "var(--ink-3)" },
  { key: "rerank", color: "var(--red)" },
  { key: "generate", color: "var(--ink-2)" },
] as const;

/** Time per pipeline step; segment widths are proportional to seconds. */
function TimingBar({ timing, hidden }: { timing: Answer["timing"]; hidden: boolean }) {
  // Steps that took no time (no reranker yet; no model call for "not found")
  // are left out: a 0-wide segment's label would sit on top of its neighbours.
  // (`rewrite` is missing from answers saved before query rewriting: 0 too.)
  const sec = (key: (typeof STEPS)[number]["key"]) => timing[key] ?? 0;
  const steps = STEPS.filter((st) => sec(st.key) > 0);
  const total = steps.reduce((n, st) => n + sec(st.key), 0) || 1;
  return (
    <div role="group" aria-label="Time spent per step" className={`mt-2 ${hidden ? s.timingOff : ""}`}>
      <div className="flex h-1 gap-0.5">
        {steps.map((st) => (
          // Shares of the total, not raw seconds: flex-grow values that add up
          // to less than 1 (a 0.5 s answer) would leave part of the bar empty.
          <span key={st.key} className="block" style={{ flex: `${sec(st.key) / total} 1 0%`, background: st.color }} />
        ))}
      </div>
      <div className="num mt-1.5 flex gap-0.5 font-mono text-xs leading-[26px] text-ink-2">
        {steps.map((st, i) => {
          // Too narrow a segment can't fit its time, so it shows just the step name.
          const share = sec(st.key) / total;
          // Under a fifth of the bar there's room for the name only; under a
          // tenth, not even that (embed 0.1 s of 1.3 s), so the label stays
          // for screen readers only instead of being cut to "embec".
          const narrow = share < 0.2;
          const sliver = share < 0.1;
          return (
            <span
              key={st.key}
              // min-w-0 + clip: on a phone a label is cut off instead of running into the next one.
              className={`min-w-0 overflow-hidden whitespace-nowrap ${st.key === "rerank" ? "text-red" : ""} ${i === steps.length - 1 ? "text-right" : ""}`}
              style={{ flex: `${share} 1 0%` }}
            >
              <span className={sliver ? "sr-only" : ""}>
                {st.key}
                {!narrow && <>&nbsp;{fmtS(sec(st.key))}</>}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
