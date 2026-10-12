import type { DynoRun } from "@/lib/api";
import { ci95, redline, signed } from "@/lib/stats";
import s from "../dyno.module.css";
import { CHART, areaPath, bandPath, errorBar, linePoints, stepOf, tooltipOrigin, xScale, yScale } from "../_lib/chart";
import { CHART_METRICS, LABEL, cx, f2, liveN, runNum, type ChartMetric, type LiveView, type Role } from "../_lib/model";

const METRICS: Record<ChartMetric, { axis: string; what: string }> = {
  recall: { axis: "recall@5", what: "of questions had the right page in the top 5" },
  mrr: { axis: "mean reciprocal rank", what: "" },
  faith: { axis: "faithfulness", what: "of answer claims were supported by the cited passages" },
  correct: { axis: "answer correctness", what: "of answers matched the reference answer" },
};

const GRID = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

interface Props {
  runs: DynoRun[];
  base: DynoRun;
  latest: DynoRun;
  metric: ChartMetric;
  onMetric: (m: ChartMetric) => void;
  hover: string | null;
  onHover: (id: string | null) => void;
  live: LiveView | null;
  roleOf: (id: string) => Role;
}

interface Pt {
  id: string;
  short: string;
  x: number;
  y: number;
  v: number;
  h: number;
  ghost: boolean;
  fail: boolean;
}

/** Score by run with 95% intervals, redline zone and baseline. Hover links to the runs table. */
export function TrendChart({ runs, base, latest, metric: mk, onMetric, hover, onHover, live, roleOf }: Props) {
  const M = METRICS[mk];
  const count = runs.length + (live ? 1 : 0);
  const step = stepOf(count);
  const red = redline(base.metrics[mk]);
  const baseV = base.metrics[mk];

  const pts: Pt[] = runs.map((r, i) => {
    const v = r.metrics[mk];
    return { id: r.id, short: r.short, x: xScale(i, count), y: yScale(v), v, h: ci95(v, r.n), ghost: false, fail: v < red };
  });
  const solid = pts.slice();
  if (live) {
    const v = live.est(mk);
    pts.push({ id: live.id, short: "running", x: xScale(runs.length, count), y: yScale(v), v, h: ci95(v, liveN(live.done)), ghost: true, fail: false });
  }
  const lastP = solid[solid.length - 1];
  const ghostP = live ? pts[pts.length - 1] : null;

  const last = latest.metrics[mk];
  const gain = Number((last - baseV).toFixed(2));
  const real = Math.abs(gain) > ci95(baseV, base.n);
  const changes = runs.length - 1;
  const redY = yScale(red);
  const floor = yScale(CHART.lo);

  // Tooltip for the hovered point (chart or table row).
  const hi = pts.findIndex((p) => p.id === hover);
  const tipP = hi >= 0 ? pts[hi] : null;
  const tip = tipP ? tooltipOrigin(tipP) : null;
  const prev = hi > 0 ? pts[hi - 1] : null;
  const tipD = prev && tipP ? Number((tipP.v - prev.v).toFixed(2)) : 0;

  return (
    <section aria-labelledby="trend-h" className="sheet min-w-0 [flex:999_1_560px]">
      <div className="rounded border border-line bg-sheet p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2 id="trend-h" className="m-0 text-[22px] font-normal tracking-[-0.02em]">
              {LABEL[mk]} {gain >= 0 ? "rose" : "fell"} {Math.abs(gain).toFixed(2)} over {changes} {changes === 1 ? "change" : "changes"}
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-2">
              {mk === "mrr"
                ? `Run ${runNum(latest.id)}: MRR ${f2(last)}, so the right page usually ranks first or second`
                : `Run ${runNum(latest.id)}: ${Math.round(last * 100)}% ${M.what}`}
              . {latest.n} golden questions per run.
            </p>
          </div>
          <div role="group" aria-label="Metric" className="flex gap-0.5 rounded-[5px] border border-line-2 bg-paper p-[3px]">
            {CHART_METRICS.map((k) => (
              <button key={k} type="button" className={s.mtab} aria-pressed={k === mk} onClick={() => onMetric(k)}>
                {LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <svg
          viewBox="0 0 720 300"
          width="100%"
          role="img"
          aria-label={`${LABEL[mk]} by run with 95% intervals: ${runs.map((r) => `run ${runNum(r.id)} ${f2(r.metrics[mk])}`).join(", ")}. Redline ${f2(red)}.`}
          className="mt-4 overflow-visible"
        >
          <defs>
            <linearGradient id="dynoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C8250E" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#C8250E" stopOpacity="0" />
            </linearGradient>
          </defs>
          <text x="16" y="132" transform="rotate(-90 16 132)" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--ink-3)">
            {M.axis}
          </text>
          {GRID.map((v) => (
            <g key={v}>
              <line x1={CHART.left} x2={CHART.right} y1={yScale(v)} y2={yScale(v)} stroke={v === CHART.lo ? "var(--line-2)" : "var(--line)"} strokeWidth="1" />
              <text x="46" y={yScale(v) + 4} textAnchor="end" fontSize="12" fontFamily="var(--font-mono)" fill="var(--ink-2)" className="num">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {/* Red zone below the redline, and the dotted baseline. */}
          <rect x={CHART.left} y={redY} width={CHART.right - CHART.left} height={Math.max(0, Number((floor - redY).toFixed(1)))} fill="var(--bad)" fillOpacity="0.06" />
          <line x1={CHART.left} x2={CHART.right} y1={redY} y2={redY} stroke="var(--bad)" strokeWidth="1.5" strokeDasharray="6 5" />
          <text x="155" y={redY + 15} textAnchor="middle" fontSize="12" fontFamily="var(--font-mono)" fill="var(--bad)">
            redline {f2(red)}
          </text>
          <line x1={CHART.left} x2={CHART.right} y1={yScale(baseV)} y2={yScale(baseV)} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="1 4" />

          <path className={s.morph} d={bandPath(solid)} fill="var(--red)" fillOpacity="0.09" />
          <path className={s.morph} d={areaPath(solid)} fill="url(#dynoArea)" />
          <polyline className={s.morph} points={linePoints(solid)} fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinejoin="round" />
          {ghostP && <path d={`M${lastP.x} ${lastP.y} L${ghostP.x} ${ghostP.y}`} fill="none" stroke="var(--red)" strokeWidth="2" strokeDasharray="5 5" />}

          {pts.map((p) => {
            const on = hover === p.id;
            const role = p.ghost ? null : roleOf(p.id);
            return (
              <g key={p.id}>
                <line className={cx(s.guide, on && s.on)} x1={p.x} x2={p.x} y1={CHART.top} y2={CHART.bottom} stroke="var(--red)" strokeWidth="1" strokeDasharray="3 4" />
                <path className={s.morph} d={errorBar(p.x, p.v, p.h)} stroke="var(--ink-2)" strokeWidth="1.25" fill="none" />
                <circle className={s.ring} cx={p.x} cy={p.y} r="11" fill="none" stroke={role === "A" ? "var(--red)" : "var(--ink)"} strokeWidth="1.5" style={{ opacity: role ? 1 : 0 }} />
                <circle
                  className={cx(s.pt, on && s.on)}
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill={p.fail ? "var(--bad)" : "var(--sheet)"}
                  stroke={p.fail ? "var(--bad)" : "var(--red)"}
                  strokeWidth="2.5"
                  strokeDasharray={p.ghost ? "3 2" : undefined}
                />
                <text
                  x={p.x + 9}
                  y={p.y - 10}
                  fontSize="12"
                  fontFamily="var(--font-mono)"
                  fill={p.ghost ? "var(--red)" : "var(--ink)"}
                  className="num"
                  style={{ fontWeight: on ? 600 : 400 }}
                >
                  {f2(p.v)}
                  {p.ghost ? "…" : ""}
                </text>
                <text x={p.x} y="262" textAnchor="middle" fontSize="12" fontFamily="var(--font-mono)" fill={on || p.ghost ? "var(--red)" : "var(--ink-2)"} className="num">
                  run {runNum(p.id)}
                </text>
                <text x={p.x} y="280" textAnchor="middle" fontSize="11" fill="var(--ink-3)">
                  {p.short}
                </text>
                {/* Full-height hit area per run, so hovering anywhere in its column works. */}
                <rect
                  x={Number((p.x - step / 2).toFixed(1))}
                  y="16"
                  width={Number(step.toFixed(1))}
                  height="272"
                  fill="transparent"
                  onMouseEnter={() => onHover(p.id)}
                  onMouseLeave={() => onHover(null)}
                />
              </g>
            );
          })}

          <g aria-hidden="true" pointerEvents="none" className={s.tip} style={{ opacity: tipP ? 1 : 0 }}>
            {tipP && tip && (
              <>
                <rect x={tip.x} y={tip.y} width={CHART.tipW} height={CHART.tipH} rx="4" fill="var(--ink)" />
                <text x={tip.x + 12} y={tip.y + 22} fontSize="12" fontWeight="500" fill="#FBF9F3">
                  {tipP.id} · {tipP.ghost ? "running" : tipP.short}
                </text>
                <text x={tip.x + 12} y={tip.y + 42} fontSize="12" fontFamily="var(--font-mono)" fill="#FBF9F3" className="num" xmlSpace="preserve">
                  {LABEL[mk]}  {f2(tipP.v)}
                </text>
                <text x={tip.x + 12} y={tip.y + 60} fontSize="12" fontFamily="var(--font-mono)" fill="#CFC8BA" className="num" xmlSpace="preserve">
                  95% CI  {f2(Math.max(0, tipP.v - tipP.h))}–{f2(Math.min(1, tipP.v + tipP.h))}
                </text>
                <text
                  x={tip.x + 12}
                  y={tip.y + 78}
                  fontSize="12"
                  fontFamily="var(--font-mono)"
                  fill={!prev ? "#CFC8BA" : tipD > 0 ? "#5FD3A0" : tipD < 0 ? "#FF8A73" : "#CFC8BA"}
                  className="num"
                  xmlSpace="preserve"
                >
                  {prev ? `vs ${prev.id}  ${signed(tipD)}` : "baseline run"}
                </text>
              </>
            )}
          </g>
        </svg>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2.5 border-t border-line pt-3.5 text-[13px] text-ink-2">
          <div className="flex flex-wrap gap-x-[18px] gap-y-2">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="block h-0.5 w-[18px] bg-red" />
              {LABEL[mk]}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="box-border block h-2.5 w-[18px] border-y border-ink-2 bg-[rgba(200,37,14,0.12)]" />
              95% interval
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="block w-[18px] border-t border-dotted border-ink-3" />
              Baseline
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="block w-[18px] border-t-2 border-dashed border-bad" />
              Redline
            </span>
          </div>
          <span>
            Run {runNum(latest.id)} vs baseline: {signed(gain)}
            {real
              ? `, outside the baseline’s interval, so a real ${gain >= 0 ? "gain" : "drop"}`
              : ", inside the baseline’s interval, so it could be noise"}
          </span>
        </div>
      </div>
    </section>
  );
}
