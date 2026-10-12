"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

/** The diagram is drawn on a fixed 1200 × 470 stage and scaled down to fit narrower screens. */
const STAGE_W = 1200;
const STAGE_H = 470;

const PAGES = [
  { name: "Week6.pdf", top: 30 },
  { name: "Slides_W6.pdf", top: 140 },
  { name: "CLRS_15.pdf", top: 250 },
  { name: "Notes.pdf", top: 360 },
];

const OUTS = [
  { label: "Strong · cite", score: "0.82", top: 100, color: "var(--good)" },
  { label: "Partial · context", score: "0.61", top: 212, color: "var(--mid)" },
  { label: "Weak", score: "0.33", top: 324, color: "var(--bad)" },
];

/** Connector paths; each gets a faint track plus an animated dash, staggered along the 6 s loop. */
const WIRES = [
  { d: "M520 50 V140", color: "var(--red)", delay: 0 },
  { d: "M104 70 H248 Q260 70 260 82 V210 Q260 222 272 222 H420", color: "var(--red)", delay: 0.5 },
  { d: "M104 180 H228 Q240 180 240 192 V222 Q240 234 252 234 H420", color: "var(--red)", delay: 1.8 },
  { d: "M104 290 H228 Q240 290 240 278 V258 Q240 246 252 246 H420", color: "var(--red)", delay: 3.2 },
  { d: "M104 400 H248 Q260 400 260 388 V270 Q260 258 272 258 H420", color: "var(--red)", delay: 4.5 },
  { d: "M620 228 H648 Q660 228 660 216 V140 Q660 128 672 128 H700", color: "var(--good)", delay: 1.0 },
  { d: "M620 240 H700", color: "var(--mid)", delay: 2.7 },
  { d: "M620 252 H648 Q660 252 660 264 V340 Q660 352 672 352 H700", color: "var(--bad)", delay: 4.3 },
  { d: "M870 128 H888 Q900 128 900 140 V210 Q900 222 912 222 H930", color: "var(--good)", delay: 2.0 },
  { d: "M870 240 H930", color: "var(--mid)", delay: 3.7 },
];

const hlBand = "linear-gradient(180deg, transparent 52%, var(--hl) 52%, var(--hl) 94%, transparent 94%)";

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L8.5 4.64A1 1 0 0 0 7 5.5z" />
    </svg>
  );
}

/** "From pages to proof": the animated retrieval → rerank → answer diagram. */
export function Pipeline() {
  const [paused, setPaused] = useState(false);
  // Only animate the icon/label swap after the first real toggle, not on page load.
  const [armed, setArmed] = useState(false);
  const [fit, setFit] = useState(1);
  const fitRef = useRef<HTMLDivElement>(null);

  // Scale the fixed-size stage to the available width, so phones never get a sideways scrollbar.
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      setFit(Math.min(1, Math.round((w / STAGE_W) * 1000) / 1000));
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section id="pipeline" aria-labelledby="pipe-h" className={`relative mx-auto max-w-[1200px] px-6 pb-24 pt-12 ${paused ? styles.paused : ""}`}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="pipe-h" className="m-0 text-[46px] font-normal tracking-[-0.032em]">From pages to proof.</h2>
          <p className="mb-0 mt-3 max-w-[38em] text-[17px] leading-[1.6] text-ink-2">
            Your question pulls passages from every document in the course. A reranker scores each one, and only strong matches get cited.
          </p>
        </div>
        <button
          type="button"
          className={`btn ${styles.pause} ${armed ? styles.armed : ""}`}
          aria-pressed={paused}
          onClick={() => {
            setPaused((p) => !p);
            setArmed(true);
          }}
        >
          {/* Keyed so React remounts the label and the swap-in animation replays on each toggle. */}
          <span key={paused ? "play" : "pause"} className={styles.swap}>
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? "Play animation" : "Pause animation"}
          </span>
        </button>
      </div>

      <div className="sheet">
        <div className="overflow-hidden rounded-md border border-line bg-sheet px-6 py-8">
          <div ref={fitRef} className="relative mx-auto w-full max-w-[1200px]" style={{ height: Math.round(STAGE_H * fit) }}>
            <div
              role="img"
              aria-label="Four documents feed a reranker gauge. Passages scoring 0.75 or more are cited, 0.5 to 0.75 become context, and weaker ones are dropped before the answer is written."
              className="absolute left-1/2 top-0 origin-top"
              style={{ width: STAGE_W, height: STAGE_H, transform: `translateX(-50%) scale(${fit})` }}
            >
              <svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true" className="absolute left-0 top-0">
                <g fill="none" stroke="var(--line-2)" strokeWidth="1.2">
                  {WIRES.map((w) => (
                    <path key={w.d} d={w.d} />
                  ))}
                </g>
                <g fill="none" strokeWidth="2.4" strokeLinecap="round">
                  {WIRES.map((w) => (
                    <path key={w.d} className={styles.flow} pathLength={1000} d={w.d} stroke={w.color} style={w.delay ? { animationDelay: `${w.delay}s` } : undefined} />
                  ))}
                </g>
              </svg>

              {/* Question */}
              <div className="absolute left-[370px] top-2 box-border flex h-[42px] w-[300px] items-center gap-2.5 rounded-[5px] border border-line-2 bg-paper px-3.5 text-sm">
                <span className="font-mono text-xs font-medium text-red">Q.</span>When does DP beat greedy?
              </div>

              {/* Source documents */}
              {PAGES.map((p) => (
                <div key={p.name} className="sheet absolute left-10 h-20 w-16" style={{ top: p.top }}>
                  <div className={`${styles.earS} box-border h-20 w-16 bg-line-2 p-px`}>
                    <div className={`${styles.earS} box-border flex h-full w-full flex-col gap-[7px] bg-sheet px-2.5 pt-5`}>
                      <span className="block h-[3px] w-[70%] bg-line-2" />
                      <span className="block h-[3px] w-full bg-line-2" />
                      <span className="block h-[3px] w-[85%] bg-hl" />
                      <span className="block h-[3px] w-[60%] bg-line-2" />
                    </div>
                  </div>
                  <span className={styles.foldS} aria-hidden="true" />
                  <p translate="no" className="absolute -left-[18px] top-[86px] m-0 w-[100px] text-center font-mono text-xs text-ink-2">
                    {p.name}
                  </p>
                </div>
              ))}

              {/* Rerank gauge hub: the needle sweeps to each passage's score in time with the flows. */}
              <div className="absolute left-[420px] top-[140px] box-border h-[200px] w-[200px] rounded-full border border-line-2 bg-paper shadow-[0_2px_2px_rgba(70,45,20,0.06),0_18px_40px_-12px_rgba(70,45,20,0.22),inset_0_0_0_6px_var(--sheet)]">
                <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true" className="absolute -left-px -top-px">
                  <path d="M32.4 139 A78 78 0 0 1 100 22" fill="none" stroke="var(--bad)" strokeOpacity="0.8" strokeWidth="7" />
                  <path d="M100 22 A78 78 0 0 1 167.5 61" fill="none" stroke="var(--mid)" strokeOpacity="0.85" strokeWidth="7" />
                  <path d="M167.5 61 A78 78 0 0 1 167.5 139" fill="none" stroke="var(--good)" strokeOpacity="0.9" strokeWidth="7" />
                  <g className={styles.sweep}>
                    <line x1="100" y1="100" x2="100" y2="34" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
                  </g>
                  <circle cx="100" cy="100" r="8" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.5" />
                </svg>
                <p className="absolute inset-x-0 top-32 m-0 text-center font-mono text-xs text-ink-2">rerank score</p>
              </div>
              <p className="absolute left-[380px] top-[354px] m-0 w-[280px] text-center font-mono text-xs text-ink-2">keyword + vector search, then rerank</p>

              {/* Score buckets */}
              {OUTS.map((o) => (
                <div key={o.label} className="sheet absolute left-[700px] w-[170px]" style={{ top: o.top }}>
                  <div className={`${styles.earS} p-px`} style={{ background: o.color }}>
                    <div className={`${styles.earS} box-border flex h-[54px] items-center justify-between bg-sheet px-4 text-sm`}>
                      <span>{o.label}</span>
                      <span className="num font-mono text-[13px]">{o.score}</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="absolute left-[880px] top-[344px] m-0 flex items-center gap-1.5 font-mono text-xs text-ink-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
                dropped
              </p>

              {/* The cited answer */}
              <div className="sheet absolute left-[930px] top-[140px] w-[250px]">
                <div className="ear bg-red p-px">
                  <div
                    className="ear relative box-border h-[196px] bg-sheet pb-4 pl-11 pr-[18px] pt-[18px]"
                    style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 25px, var(--rule) 25px 26px)" }}
                  >
                    <span aria-hidden="true" className="absolute bottom-0 left-8 top-0 w-px bg-margin" />
                    <span className="absolute left-3 top-[18px] font-mono text-xs font-medium text-red">A.</span>
                    <p className="m-0 text-[15px] leading-[26px]">
                      Use DP when <span className={styles.swipeLoop} style={{ backgroundImage: hlBand }}>the greedy choice can fail</span>{" "}
                      <span className="font-mono text-[13px] text-red">[1]</span>, as in 0/1 knapsack <span className="font-mono text-[13px] text-red">[2]</span>.
                    </p>
                  </div>
                </div>
                <span className="fold fold-red" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mb-0 mt-4 text-sm leading-[1.6] text-ink-2">Thresholds shown are illustrative. Dyno tunes them against a hand-labeled question set.</p>
    </section>
  );
}
