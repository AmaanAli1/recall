"use client";

import Link from "next/link";
import type { RefObject } from "react";
import s from "../ask.module.css";

/** The question box pinned under the answer sheet. */
export function Composer({
  inputRef,
  busy,
  onAsk,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <form
      className={`${s.composer} px-7 pb-[26px] pt-4`}
      onSubmit={(e) => {
        e.preventDefault();
        const el = inputRef.current;
        const q = el?.value.trim() ?? "";
        if (!q || busy) return;
        onAsk(q);
        if (el) el.value = "";
      }}
    >
      <label htmlFor="qf" className="sr-only">
        Ask about Algorithms
      </label>
      <div className="flex items-center gap-2.5 rounded-[5px] border border-line-2 bg-sheet py-2 pl-4 pr-2">
        <span aria-hidden="true" className="font-mono text-[13px] font-medium text-red">
          Q.
        </span>
        <input
          ref={inputRef}
          id="qf"
          name="question"
          type="text"
          autoComplete="off"
          placeholder="e.g. Why does Bellman-Ford allow negative edges…"
          className="min-h-10 min-w-0 flex-auto border-0 bg-transparent text-base text-ink caret-red outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          aria-busy={busy}
          className="btn btn-red inline-flex min-h-11 items-center gap-2.5 rounded border-0 py-2 pl-3.5 pr-2 text-[15px] font-medium"
        >
          Ask <kbd className="kbd">⏎</kbd>
        </button>
      </div>
      <p className="mt-2.5 text-[13px] text-ink-2">
        Using the sample Algorithms course.{" "}
        <Link href="/library" className="lnk lnk-hl text-ink">
          Add your own PDFs in Library →
        </Link>
      </p>
    </form>
  );
}
