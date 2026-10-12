"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getDemoSession } from "@/lib/api";
import { markFreshArrival } from "@/lib/demo-flags";
import styles from "../demo.module.css";
import { LibraryCard } from "./LibraryCard";
import { useDemoBoot } from "./useDemoBoot";

/** Boot screen: issues the demo session, then hands the visitor to Ask. */
export function DemoBoot() {
  const router = useRouter();
  const { state, start, replay, retry } = useDemoBoot();

  // Returning visitors already hold a card: skip the ceremony.
  useEffect(() => {
    let cancelled = false;
    getDemoSession()
      .catch(() => null) // can't tell? boot anyway; a real outage surfaces on step 1
      .then((existing) => {
        if (cancelled) return;
        if (existing) router.replace("/ask");
        else start();
      });
    return () => {
      cancelled = true;
    };
  }, [router, start]);

  // The CTA shows a ⏎ keycap, so Enter anywhere on the page (not on another control) opens the notebook.
  useEffect(() => {
    if (!state.issued) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest("a, button, input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      markFreshArrival();
      router.push("/ask");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.issued, router]);

  const phase = [state.shown && styles.shown, state.revealed && styles.revealed, state.issued && styles.issued]
    .filter(Boolean)
    .join(" ");

  return (
    <main id="main" className={`relative w-full max-w-[560px] ${phase}`}>
      <h1 className="m-0 mb-1.5 text-center text-[30px] font-normal tracking-[-0.025em]">
        {state.issued ? "Your demo notebook is ready." : "Preparing your demo session…"}
      </h1>
      <p className="m-0 mb-8 text-center text-[15px] text-ink-2">
        Your chats and uploads stay in this session. Other visitors can’t see them.
      </p>

      <LibraryCard state={state} onRetry={retry} />

      {/* Inert until the first issue so nobody tabs into an invisible button; stays live during a Replay. */}
      <div
        className={`${styles.cta} mt-8 flex flex-wrap items-center justify-center gap-3.5`}
        inert={!state.everIssued}
      >
        <Link
          href="/ask"
          onClick={markFreshArrival}
          className="btn btn-red inline-flex items-center gap-3 rounded-[5px] py-[11px] pr-[11px] pl-5 text-base font-medium"
        >
          Open my notebook <kbd className="kbd">⏎</kbd>
        </Link>
        <button
          type="button"
          onClick={replay}
          className="btn btn-ghost inline-flex min-h-11 items-center gap-2 rounded-[5px] px-4 py-2.5 text-sm"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Replay
        </button>
      </div>
    </main>
  );
}
