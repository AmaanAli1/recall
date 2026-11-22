"use client";

import { useState } from "react";
import type { Answer } from "@/lib/api";
import { excerpt } from "@/lib/excerpt";
import s from "../ask.module.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Right pane: the cited passages, one card per [n], plus the dropped weak matches. */
export function SourcesPane({
  view,
  answer,
  answerKey,
  forQuestion,
  visible,
  picked,
  hover,
  onPick,
  onPeek,
  cardRef,
}: {
  /** empty = nothing asked yet; loading = the shown turn is on its way; answer = its sources. */
  view: "boot" | "empty" | "loading" | "answer";
  answer: Answer | null;
  /** Which turn these sources belong to (resets the "Show full passage" toggles). */
  answerKey: number | null;
  /** Set when the conversation has several answers: whose sources these are. */
  forQuestion?: string | null;
  /** While a new answer types in, only the cards of finished claims show. */
  visible?: number;
  picked: number;
  hover: number;
  onPick: (n: number, keyboard: boolean) => void;
  onPeek: (n: number) => void;
  cardRef: (n: number, el: HTMLDivElement | null) => void;
}) {
  const showing = view === "answer" && answer;
  // Cards opened to their full passage, as "turnKey-n".
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <aside aria-labelledby="src-h" className={s.paneRight}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="src-h" className="m-0 text-[15px] font-medium">Sources</h2>
        <span className="num text-[13px] text-ink-2">
          {showing ? `${answer.sources.length} cited, ${answer.dropped.length} dropped` : ""}
        </span>
      </div>
      {showing && forQuestion && (
        <p className="-mt-2 mb-4 truncate text-[13px] text-ink-3" title={forQuestion}>
          For: {forQuestion}
        </p>
      )}

      {view === "empty" && (
        <div className={`${s.swapIn} ${s.dashed}`}>
          <p className="m-0 font-medium text-ink">The pages behind each answer show up here.</p>
          <p className="m-0 mt-1.5">Click a [1] in the answer to jump to the exact passage. Hover to see which sentence it supports.</p>
        </div>
      )}

      {view === "loading" && (
        <p className="m-0 text-sm text-ink-2" role="status">
          Finding the pages…
        </p>
      )}

      {showing && answer.notFound && (
        <div className={`${s.swapIn} ${s.dashed}`}>
          <p className="m-0 font-medium text-ink">Nothing here was close enough to cite.</p>
          <p className="m-0 mt-1.5">Recall only answers from this course’s documents, so it didn’t guess.</p>
        </div>
      )}

      {showing && !answer.notFound && (
        <>
          <div className="flex flex-col gap-3.5">
            {answer.sources.filter((src) => visible === undefined || src.n <= visible).map((src) => {
              const on = src.n === picked;
              const peek = hover === src.n && !on;
              const id = `${answerKey}-${src.n}`;
              const full = open.has(id);
              // The quote with a little context; the whole passage on request.
              const cut = excerpt(src.pre, src.post);
              const pre = full ? src.pre : cut.pre;
              const post = full ? src.post : cut.post;
              return (
                <div
                  key={id}
                  ref={(el) => cardRef(src.n, el)}
                  className={`sheet relative ${peek ? s.peek : ""} ${visible !== undefined ? s.swapIn : ""}`}
                  onMouseEnter={() => onPeek(src.n)}
                  onMouseLeave={() => onPeek(0)}
                >
                  <div className={`ear ${s.edge} ${on ? s.edgeOn : ""}`}>
                    <button
                      type="button"
                      className={`ear ${s.card}`}
                      aria-pressed={on}
                      onClick={(e) => onPick(src.n, e.detail === 0)}
                      onFocus={() => onPeek(src.n)}
                      onBlur={() => onPeek(0)}
                    >
                      <span className="flex justify-between gap-2.5 font-mono text-xs text-ink-2">
                        <span>
                          <span className="text-red">[{src.n}]</span> <span translate="no">{src.file}</span>
                        </span>
                        <span className="num">p.&nbsp;{src.page}</span>
                      </span>
                      <span className={`${s.srcBody} ${on ? s.srcBodyOn : ""}`}>
                        {pre}
                        <mark className={on ? s.swipe : s.hit}>{src.hit}</mark>
                        {post}
                      </span>
                      <span className="mt-3 flex items-center gap-2.5">
                        <span className="h-0.5 flex-auto bg-line">
                          <span
                            className="block h-full"
                            style={{ width: `${Math.round(src.score * 100)}%`, background: src.score >= 0.75 ? "var(--good)" : "var(--mid)" }}
                          />
                        </span>
                        <span className="num font-mono text-xs">{src.score.toFixed(2)}</span>
                      </span>
                    </button>
                    {cut.trimmed && (
                      // Outside the card's button: a button can't hold another button.
                      <p className={`${s.more} bg-[var(--sheet)]`}>
                        <button
                          type="button"
                          className="lnk lnk-hl border-0 bg-transparent p-0 text-[13px] text-ink-2"
                          aria-expanded={full}
                          aria-label={full ? `Show less of source ${src.n}` : `Show full passage for source ${src.n}`}
                          onClick={() => toggle(id)}
                        >
                          {full ? "Show less" : "Show full passage"}
                        </button>
                      </p>
                    )}
                  </div>
                  <span aria-hidden="true" className={`fold ${on ? "fold-red" : ""}`} />
                </div>
              );
            })}
          </div>

          {answer.dropped.length > 0 && (
            <details className="mt-[18px] border-t border-dashed border-line-2 pt-3">
              <summary className="flex min-h-8 cursor-pointer items-center text-[13px] text-ink-2">
                {plural(answer.dropped.length, "weak match", "weak matches")} dropped
              </summary>
              <div className="num mt-2 flex flex-col gap-2 font-mono text-xs text-ink-2">
                {answer.dropped.map((d) => (
                  <span key={`${d.file}-${d.page}`} className="flex justify-between">
                    <span translate="no">
                      {d.file} · p.&nbsp;{d.page}
                    </span>
                    <span>{d.score.toFixed(2)}</span>
                  </span>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </aside>
  );
}
