"use client";

import Link from "next/link";
import { useState } from "react";
import { BENCH_METRICS, BENCH_RUNS, baselineOf, delta, redlineOf, type BenchMetric, type BenchRun } from "./bench-data";
import styles from "./landing.module.css";

// ---- Gauge geometry: a 240° dial (from 210° to -30°) centred at (100, 100). ----
const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [(100 + r * Math.cos(a)).toFixed(1), (100 - r * Math.sin(a)).toFixed(1)] as const;
};
const [s0x, s0y] = point(210, 80);
const [s1x, s1y] = point(-30, 80);
/** The full dial arc; with pathLength=1, a dasharray of "v 2" draws exactly v of it. */
const ARC = `M${s0x} ${s0y} A80 80 0 1 1 ${s1x} ${s1y}`;
/** 21 ticks, a longer one every 0.25. */
const TICKS = Array.from({ length: 21 }, (_, i) => {
  const deg = 210 - 12 * i;
  const [ax, ay] = point(deg, 70);
  const [bx, by] = point(deg, i % 5 === 0 ? 61 : 65);
  return `M${ax} ${ay} L${bx} ${by}`;
}).join(" ");

const LATEST_ID = BENCH_RUNS[BENCH_RUNS.length - 1].id;

function verdictFor(run: BenchRun, metric: BenchMetric, value: number) {
  if (run.gate === "base") return "The baseline. Every later run is measured against these scores, and the redline sits 0.02 below each one.";
  if (run.gate === "fail" && run.failed) {
    const f = run.failed;
    return `${BENCH_METRICS[f].label} fell to ${run[f].toFixed(2)}, under its ${redlineOf(f).toFixed(2)} redline. Dyno blocked the merge, so this change never shipped.`;
  }
  return `Every score cleared its redline, so the change merged. ${BENCH_METRICS[metric].label} moved ${delta(value, baselineOf(metric))} against the baseline.`;
}

/** "Every change goes on the dyno": interactive gauge + run rail + the selected run's card. */
export function DynoBench() {
  const [runId, setRunId] = useState(LATEST_ID);
  const [metric, setMetric] = useState<BenchMetric>("recall");

  const run = BENCH_RUNS.find((r) => r.id === runId) ?? BENCH_RUNS[BENCH_RUNS.length - 1];
  const m = BENCH_METRICS[metric];
  const value = run[metric];
  const red = redlineOf(metric);
  const inRed = value < red;
  const fail = run.gate === "fail";
  // Short tick across the dial marking the redline.
  const bDeg = 210 - 240 * baselineOf(metric);
  const [b1x, b1y] = point(bDeg, 88);
  const [b2x, b2y] = point(bDeg, 72);

  const pick = (r: BenchRun) => {
    setRunId(r.id);
    // A blocked run jumps to the metric that blocked it, so the needle shows why.
    if (r.failed) setMetric(r.failed);
  };

  return (
    <section id="dyno" aria-labelledby="dyno-h" className="relative mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-6 pb-28 pt-12">
      <div className="sheet relative min-w-0 flex-[1_1_420px]">
        <div className="ear bg-line-2 p-px">
          <div className="ear bg-sheet px-6 pb-[26px] pt-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-ink-2">DYNO BENCH</span>
              <div role="group" aria-label="Metric" className="inline-flex gap-0.5 rounded-md border border-line-2 bg-paper p-[3px]">
                {(Object.keys(BENCH_METRICS) as BenchMetric[]).map((k) => (
                  <button key={k} type="button" className={styles.seg} aria-pressed={metric === k} onClick={() => setMetric(k)}>
                    {BENCH_METRICS[k].label}
                  </button>
                ))}
              </div>
            </div>

            <svg
              width="100%"
              viewBox="0 0 200 150"
              role="img"
              aria-label={`${m.label} for run ${run.id}: ${value.toFixed(2)}, redline ${red.toFixed(2)}${inRed ? ", below the redline" : ", clear of the redline"}`}
              className={`${styles.gauge} mx-auto mt-3.5 block max-w-[380px]`}
            >
              <path d={ARC} pathLength={1} fill="none" stroke="var(--sheet-2)" strokeWidth="12" />
              {/* Red zone: everything below the redline */}
              <path
                d={ARC}
                pathLength={1}
                fill="none"
                stroke="var(--bad)"
                strokeOpacity="0.3"
                strokeWidth="12"
                style={{ strokeDasharray: `${red} 2`, transition: "stroke-dasharray 500ms cubic-bezier(.23,1,.32,1)" }}
              />
              <path d={TICKS} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" />
              <path
                d={ARC}
                pathLength={1}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{
                  stroke: inRed ? "var(--bad)" : "var(--red)",
                  strokeDasharray: `${value} 2`,
                  transition: "stroke-dasharray 650ms cubic-bezier(.23,1,.32,1)",
                }}
              />
              <line x1={b1x} y1={b1y} x2={b2x} y2={b2y} stroke="var(--ink)" strokeWidth="2" />
              {/* Needle: slight overshoot on the spring so it "settles" like a real gauge */}
              <g
                style={{
                  transformBox: "view-box",
                  transformOrigin: "100px 100px",
                  transform: `rotate(${(240 * value - 120).toFixed(1)}deg)`,
                  transition: "transform 700ms cubic-bezier(.34,1.3,.64,1)",
                }}
              >
                <line x1="100" y1="100" x2="100" y2="40" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: inRed ? "var(--bad)" : "var(--ink)" }} />
              </g>
              <circle cx="100" cy="100" r="6" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" />
              <text x="100" y="134" textAnchor="middle" className="font-sans" fontSize="22" fontWeight="400" style={{ fill: inRed ? "var(--bad)" : "var(--ink)" }}>
                {value.toFixed(2)}
              </text>
              <text x="100" y="147" textAnchor="middle" className="font-mono" fontSize="7" fill="var(--ink-2)">
                {m.name} · redline {red.toFixed(2)}
              </text>
            </svg>

            <div role="group" aria-label="Choose a run" className="relative mt-[18px] pt-1.5">
              <span aria-hidden="true" className="absolute inset-x-[10%] top-[21px] h-px bg-line-2" />
              <div className="relative grid" style={{ gridTemplateColumns: `repeat(${BENCH_RUNS.length}, minmax(0, 1fr))` }}>
                {BENCH_RUNS.map((r) => {
                  const on = r.id === run.id;
                  const rFail = r.gate === "fail";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={styles.stop}
                      aria-pressed={on}
                      aria-label={`Run ${r.id}, ${r.change}${rFail ? ", blocked at the redline" : ""}`}
                      onClick={() => pick(r)}
                    >
                      <span
                        aria-hidden="true"
                        className="box-border block rounded-full"
                        style={{
                          width: on ? 14 : 10,
                          height: on ? 14 : 10,
                          marginTop: on ? 8 : 10,
                          transition: "width 200ms ease, height 200ms ease",
                          background: on ? (rFail ? "var(--bad)" : "var(--red)") : rFail ? "#FBEFEA" : "var(--sheet)",
                          border: `2px solid ${rFail ? "var(--bad)" : on ? "var(--red)" : "var(--ink-3)"}`,
                          boxShadow: on ? "0 0 0 4px rgba(200,37,14,0.15)" : undefined,
                        }}
                      />
                      <span className={`num font-mono text-xs ${on ? "font-medium text-ink" : "font-normal text-ink-2"}`}>Run {r.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <span className="fold" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-[1_1_440px]">
        <h2 id="dyno-h" className="m-0 text-[46px] font-normal leading-[1.06] tracking-[-0.032em]">
          Every change goes on the dyno. <span className="text-red">Below the redline, it doesn’t ship.</span>
        </h2>
        <p className="mb-0 mt-5 max-w-[32em] text-[17px] leading-[1.6] text-ink-2">
          Dyno runs a hand-labeled question set on every pull request. Pick a run on the bench to see how each change scored.
        </p>
        <div
          aria-live="polite"
          className={`mt-[26px] rounded px-5 py-[18px] border ${fail ? "border-red bg-[#FBEFEA]" : "border-line-2 bg-sheet"}`}
          style={{ transition: "background-color 200ms ease, border-color 200ms ease" }}
        >
          <div className="flex flex-wrap justify-between gap-2 font-mono text-xs text-ink-2">
            <span className="num">
              Run {run.id} · {run.date}
            </span>
            <span className={`font-medium ${fail ? "text-bad" : run.gate === "pass" ? "text-good" : "text-ink-2"}`}>
              {run.gate === "base" ? "BASELINE" : fail ? "REDLINE · BLOCKED" : "CLEAR · MERGED"}
            </span>
          </div>
          <p className="mb-0 mt-2.5 text-lg font-medium">{run.change}</p>
          <p className="mb-0 mt-1.5 text-[15px] leading-[1.55] text-ink-2">{verdictFor(run, metric, value)}</p>
          <div className="num mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3.5">
            <div>
              <p className="m-0 text-xs text-ink-2">Recall@5</p>
              <p className={`mb-0 mt-1 font-mono text-[17px] ${run.failed === "recall" ? "text-bad" : ""}`}>{run.recall.toFixed(2)}</p>
            </div>
            <div>
              <p className="m-0 text-xs text-ink-2">Faithfulness</p>
              <p className={`mb-0 mt-1 font-mono text-[17px] ${run.failed === "faith" ? "text-bad" : ""}`}>{run.faith.toFixed(2)}</p>
            </div>
            <div>
              <p className="m-0 text-xs text-ink-2">p95 latency</p>
              <p className="mb-0 mt-1 font-mono text-[17px]">{run.p95}</p>
            </div>
          </div>
        </div>
        <div className="mt-[26px] flex flex-wrap items-center gap-5">
          <Link href="/dyno" className="btn btn-ghost inline-flex items-center gap-3 rounded-[5px] py-[11px] pl-5 pr-[11px] text-base font-medium">
            Open the dashboard <kbd className="kbd kbd-ink" aria-hidden="true">D</kbd>
          </Link>
          <span className="text-[13px] text-ink-2">Scores shown are sample data.</span>
        </div>
      </div>
    </section>
  );
}
