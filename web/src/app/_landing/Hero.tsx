"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { endDemoSession, getDemoSession } from "@/lib/api";
import { ArrowRight } from "./icons";
import styles from "./landing.module.css";

const HOUR_MS = 3_600_000;
/** Highlighter band behind a word, drawn by the `swipe` animation. */
const hl = (from: number, to: number) => `linear-gradient(180deg, transparent ${from}%, var(--hl) ${from}%, var(--hl) ${to}%, transparent ${to}%)`;

type Saved = { id: string; hoursLeft: number };

/**
 * Hero: headline, CTA and the sample source card. A returning visitor with a live
 * demo session gets "Resume your demo" (to /ask) plus a note on how long it's kept.
 */
export function Hero() {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    let alive = true;
    getDemoSession()
      .then((s) => {
        if (!alive || !s) return;
        // Sessions expire 24 h after the last activity; round to whole hours, never show "0 h".
        const hoursLeft = Math.max(1, Math.round(24 - (Date.now() - new Date(s.lastActiveAt).getTime()) / HOUR_MS));
        setSaved({ id: s.id, hoursLeft });
      })
      .catch(() => {
        /* no session: keep "Try the demo" */
      });
    return () => {
      alive = false;
    };
  }, []);

  const href = saved ? "/ask" : "/demo";

  const startFresh = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    await endDemoSession();
    setSaved(null);
    router.push("/demo");
  };

  return (
    <section aria-labelledby="hero-h" className="relative mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-6 pb-24 pt-[88px]">
      {/* Ruled notebook paper with a red margin line. */}
      <div
        className="relative min-w-0 flex-[1_1_520px] pl-10"
        style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 35px, var(--rule) 35px 36px)" }}
      >
        <span aria-hidden="true" className="absolute -bottom-8 -top-8 left-0 w-px bg-margin" />
        <h1 id="hero-h" className="m-0 text-[66px] font-normal leading-[1.05] tracking-[-0.038em]">
          <span className={`${styles.rise} block`}>Ask your notes.</span>
          <span className={`${styles.rise} block`} style={{ animationDelay: "70ms" }}>
            Get answers <span aria-hidden="true" className="font-mono font-normal tracking-[-0.06em] text-red">[</span>
            <span className={styles.swipe} style={{ backgroundImage: hl(56, 92), animationDelay: "520ms" }}>cited</span>
            <span aria-hidden="true" className="font-mono font-normal tracking-[-0.06em] text-red">]</span>
          </span>
          <span className={`${styles.rise} block`} style={{ animationDelay: "140ms" }}>to the page.</span>
        </h1>
        <p className={`${styles.rise} mb-0 mt-7 max-w-[34em] text-lg leading-[1.6] text-ink-2`} style={{ animationDelay: "210ms" }}>
          Recall reads your lecture PDFs, scores every passage against your question, and shows the exact page each answer came from.
        </p>
        <div className={`${styles.rise} mt-9 flex flex-wrap items-center gap-5`} style={{ animationDelay: "280ms" }}>
          <Link href={href} className="btn btn-red inline-flex items-center gap-3 rounded-[5px] py-[11px] pl-5 pr-[11px] text-base font-medium">
            {saved ? "Resume your demo" : "Try the demo"} <kbd className="kbd" aria-hidden="true">⏎</kbd>
          </Link>
          <a href="#pipeline" className="lnk lnk-hl text-base font-medium text-ink">
            See how it works
          </a>
        </div>
        {saved && (
          <p className={`${styles.rise} num mb-0 mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-ink-2`} style={{ animationDelay: "340ms" }}>
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-good shadow-[0_0_0_3px_rgba(11,112,70,0.14)]" />
            <span>
              Your session <span translate="no" className="font-mono text-ink">{saved.id}</span> is saved, kept for another {saved.hoursLeft}&nbsp;h.
            </span>
            {/* Our onClick prevents default, so next/link stands down and we navigate after deleting. */}
            <Link href="/demo" className="lnk lnk-hl text-ink" onClick={startFresh}>
              Start fresh
            </Link>
          </p>
        )}
      </div>

      <div className={`${styles.rise} min-w-0 flex-[1_1_400px]`} style={{ animationDelay: "320ms" }}>
        <Link href={href} className={`sheet ${styles.heroCard}`} aria-label="See the full answer with its sources">
          <div className={`ear ${styles.heroEdge} p-px`}>
            <div className="ear bg-sheet px-7 pb-6 pt-[26px]">
              <div className="flex justify-between font-mono text-xs text-ink-2">
                <span>
                  <span className="text-red">[1]</span> <span translate="no">Week6_DynamicProgramming.pdf</span>
                </span>
                <span className="num">p.&nbsp;4</span>
              </div>
              <p className="mb-0 mt-[18px] text-[17px] leading-[1.75]">
                Greedy algorithms commit to the locally best choice.{" "}
                <span className={styles.swipe} style={{ backgroundImage: hl(52, 94), animationDuration: "700ms", animationDelay: "1050ms" }}>
                  When that choice can rule out the optimal solution, we must consider every subproblem
                </span>{" "}
                and store the results we reuse.
              </p>
              <div className="mt-[22px] flex items-center gap-3 font-mono text-xs text-ink-2">
                <span>rerank score</span>
                <span className="h-0.5 flex-auto bg-line">
                  <span className="block h-full w-[82%] bg-good" />
                </span>
                <span className="num text-ink">0.82</span>
              </div>
              <div className={`${styles.heroGo} mt-[18px] flex items-center justify-end gap-1.5 border-t border-line pt-3.5 text-sm font-medium text-red`}>
                See the full answer <ArrowRight />
              </div>
            </div>
          </div>
          <span className="fold fold-red" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
