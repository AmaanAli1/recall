import type { DynoRun, MetricKey } from "@/lib/api";
import { redline, signed } from "@/lib/stats";
import s from "../dyno.module.css";
import { baselineTick, gaugeArc, gaugeTicks, needleRotation } from "../_lib/chart";
import { GAUGE_METRICS, LABEL, cx, f2, runNum, type LiveView } from "../_lib/model";

const TICKS = gaugeTicks();
const TRACK = gaugeArc(0, 1, 80);

/** Four dials for the latest run. While a run is live, a dashed needle tracks its estimate. */
export function Gauges({ latest, base, live }: { latest: DynoRun; base: DynoRun; live: LiveView | null }) {
  return (
    <section aria-label={`Scores for run ${runNum(latest.id)}`} className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
      {GAUGE_METRICS.map((k, i) => (
        <Gauge key={k} k={k} i={i} latest={latest} base={base} live={live} />
      ))}
    </section>
  );
}

function Gauge({ k, i, latest, base, live }: { k: MetricKey; i: number; latest: DynoRun; base: DynoRun; live: LiveView | null }) {
  const v = latest.metrics[k];
  const b = base.metrics[k];
  const red = redline(b);
  const d = Number((v - b).toFixed(2));
  const e = live ? live.est(k) : null;
  const bt = baselineTick(b);

  return (
    <div className="sheet rise relative" style={{ animationDelay: `${i * 60}ms` }}>
      <div className="ear bg-line-2 p-px">
        <div className="ear bg-sheet px-[18px] pb-5 pt-[18px]">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[15px] font-medium">{LABEL[k]}</h2>
            <span className={cx("num font-mono text-xs", d > 0 ? "text-good" : d < 0 ? "text-bad" : "text-ink-2")}>{signed(d)}</span>
          </div>
          <svg
            width="100%"
            height="140"
            viewBox="0 0 200 140"
            role="img"
            aria-label={`${LABEL[k]} ${f2(v)}, baseline ${f2(b)}, redline ${f2(red)}${e != null && live ? `, run ${runNum(live.id)} estimate ${f2(e)}` : ""}`}
            className="mt-1.5"
          >
            <path d={TRACK} fill="none" stroke="var(--sheet-2)" strokeWidth="10" />
            <path d={gaugeArc(0, red, 80)} fill="none" stroke="var(--bad)" strokeOpacity="0.32" strokeWidth="10" />
            <path d={TICKS} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" />
            <path className={s.gval} d={gaugeArc(0, v, 80)} fill="none" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" />
            <line {...bt} stroke="var(--ink)" strokeWidth="2" />
            {/* Ghost needle: the in-flight run's estimate. Parks on the solid needle when idle. */}
            <g className={s.ghost} style={{ opacity: e != null ? 1 : 0, transform: `rotate(${needleRotation(e ?? v)}deg)` }}>
              <line x1="100" y1="100" x2="100" y2="38" stroke="var(--red)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
            </g>
            {/* Outer group transitions between values; inner group plays the one-off swing-in on mount. */}
            <g className={s.nwrap} style={{ transform: `rotate(${needleRotation(v)}deg)` }}>
              <g className={s.needle} style={{ animationDelay: `${120 + i * 60}ms` }}>
                <line x1="100" y1="100" x2="100" y2="42" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>
            <circle cx="100" cy="100" r="6" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" />
          </svg>
          <p className="num -mt-[18px] text-center text-[44px] font-normal tracking-[-0.03em]">{f2(v)}</p>
          <p className="num mt-1 text-center font-mono text-xs text-ink-2">
            baseline {f2(b)} · redline {f2(red)}
          </p>
          <p className="num mt-1 text-center font-mono text-xs text-red" style={{ opacity: e != null ? 1 : 0 }}>
            {e != null && live ? `${live.id} so far ${f2(e)}` : " "}
          </p>
        </div>
      </div>
      <span className="fold" aria-hidden="true" />
    </div>
  );
}
