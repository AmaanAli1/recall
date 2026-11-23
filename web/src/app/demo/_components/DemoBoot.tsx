"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { getDemoSession } from "@/lib/api";
import { markFreshArrival } from "@/lib/demo-flags";
import { DEFAULT_NEXT, NEXT_PARAM, safeNext } from "@/lib/session-gate";
import styles from "../demo.module.css";
import { LibraryCard } from "./LibraryCard";
import { useDemoBoot } from "./useDemoBoot";

/** The URL doesn't change while /demo is open, so there's nothing to subscribe to. */
const noSubscribe = () => () => {};

/**
 * Leave /demo with a FULL page load, not an in-app navigation. Next.js prefetches
 * visible links and keeps the answer; the notebook link (and the header link that
 * brought the visitor here) was prefetched before the session existed, so the
 * kept answer is the session gate's redirect back to /demo, and an in-app jump
 * would just land on this page again (PR #45). A full load asks the server afresh,
 * with the new session cookie.
 */
function leaveTo(path: string, replace = false) {
  if (replace) window.location.replace(path);
  else window.location.assign(path);
}

/**
 * Boot screen: issues the demo session, then hands the visitor on: to Ask, or to
 * the page they were sent here from (?next=/library, set by the session gate in
 * proxy.ts). `next` is checked by safeNext, so it can only ever be Ask or Library.
 */
export function DemoBoot() {
  const { state, start, replay, retry } = useDemoBoot();
  // Not useSearchParams: /demo is a static page, and that would need a Suspense
  // boundary. On the server (and while hydrating) there's no URL: Ask.
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const dest = search ? safeNext(new URLSearchParams(search).get(NEXT_PARAM)) : DEFAULT_NEXT;

  // Returning visitors already hold a card: skip the ceremony.
  useEffect(() => {
    let cancelled = false;
    // Read the URL right here: this runs once, possibly before `dest` updates.
    const next = safeNext(new URLSearchParams(window.location.search).get(NEXT_PARAM));
    getDemoSession()
      .catch(() => null) // can't tell? boot anyway; a real outage surfaces on step 1
      .then((existing) => {
        if (cancelled) return;
        if (existing) leaveTo(next, true);
        else start();
      });
    return () => {
      cancelled = true;
    };
  }, [start]);

  // The CTA shows a ⏎ keycap, so Enter anywhere on the page (not on another control) opens the notebook.
  useEffect(() => {
    if (!state.issued) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest("a, button, input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      markFreshArrival();
      leaveTo(dest);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.issued, dest]);

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
          href={dest}
          // No prefetch (it would only fetch the gate's redirect), and a full load on click.
          prefetch={false}
          onClick={(e) => {
            e.preventDefault();
            markFreshArrival();
            leaveTo(dest);
          }}
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
