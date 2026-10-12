/**
 * Pure geometry for the Dyno gauges and trend chart. No React, no DOM:
 * everything here is a number or an SVG path string, so it is unit-tested
 * in chart.test.ts and the components stay declarative.
 */

const round1 = (n: number) => Number(n.toFixed(1));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------- gauges (viewBox 0 0 200 140, pivot at 100,100) ----------

/** The dial sweeps 240°: 0 sits at 210° (lower left), 1 at −30° (lower right). */
const SWEEP = 240;
const START_DEG = 210;

/** Point on a circle around the pivot. Angles are maths-style (0° = right, counter-clockwise). */
export function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [round1(100 + r * Math.cos(a)), round1(100 - r * Math.sin(a))];
}

/** Dial angle for a 0–1 score. */
export const dialDeg = (f: number) => START_DEG - SWEEP * clamp(f, 0, 1);

/** Arc along the dial from score f0 to f1 at radius r. */
export function gaugeArc(f0: number, f1: number, r: number): string {
  const a = clamp(f0, 0, 1);
  const b = clamp(f1, a, 1);
  const [sx, sy] = polar(dialDeg(a), r);
  const [ex, ey] = polar(dialDeg(b), r);
  const large = SWEEP * (b - a) > 180 ? 1 : 0;
  return `M${sx} ${sy} A${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

/** 21 ticks every 0.05; every fifth one (0, .25, .5, .75, 1) is longer. */
export function gaugeTicks(): string {
  let d = "";
  for (let i = 0; i <= 20; i++) {
    const deg = START_DEG - 12 * i;
    const [ax, ay] = polar(deg, 70);
    const [bx, by] = polar(deg, i % 5 === 0 ? 61 : 65);
    d += `M${ax} ${ay} L${bx} ${by} `;
  }
  return d.trim();
}

/** The needle is drawn pointing straight up, so 0.5 is 0° and the ends are ±120°. */
export const needleRotation = (f: number) => round1(SWEEP * clamp(f, 0, 1) - SWEEP / 2);

/** Short radial tick just outside the dial that marks the baseline score. */
export function baselineTick(f: number) {
  const deg = dialDeg(f);
  const [x1, y1] = polar(deg, 88);
  const [x2, y2] = polar(deg, 72);
  return { x1, y1, x2, y2 };
}

// ---------- trend chart (viewBox 0 0 720 300) ----------

export const CHART = {
  lo: 0.5,
  hi: 1.0,
  /** Plot area. */
  left: 56,
  right: 700,
  top: 24,
  bottom: 240,
  /** First and last point x: points sit inset from the axes. */
  x0: 80,
  span: 600,
  /** Tooltip card size. */
  tipW: 176,
  tipH: 92,
} as const;

/** Score → y. Values outside [lo, hi] are not clamped (the band/error bars clamp themselves). */
export function yScale(v: number): number {
  return round1(CHART.bottom - ((v - CHART.lo) / (CHART.hi - CHART.lo)) * (CHART.bottom - CHART.top));
}

/** Horizontal distance between neighbouring runs when `count` points share the axis. */
export function stepOf(count: number): number {
  return count > 1 ? CHART.span / (count - 1) : CHART.span;
}

/** Run index → x. A single run sits at the first slot. */
export function xScale(i: number, count: number): number {
  return round1(CHART.x0 + i * stepOf(count));
}

/** Clamp an interval end to the chart's range. */
const top = (v: number, h: number) => yScale(Math.min(CHART.hi, v + h));
const bottom = (v: number, h: number) => yScale(Math.max(CHART.lo, v - h));

/** I-beam error bar: caps 10 px wide at v ± h. */
export function errorBar(x: number, v: number, h: number): string {
  const yt = top(v, h);
  const yb = bottom(v, h);
  return `M${round1(x - 5)} ${yt} H${round1(x + 5)} M${x} ${yt} V${yb} M${round1(x - 5)} ${yb} H${round1(x + 5)}`;
}

export interface BandPoint {
  x: number;
  v: number;
  /** Half-width of the 95% interval. */
  h: number;
}

/** The shaded 95% interval: along the upper ends, back along the lower ends. */
export function bandPath(points: BandPoint[]): string {
  if (points.length === 0) return "";
  const up = points.map((p) => `${p.x} ${top(p.v, p.h)}`);
  const dn = points.map((p) => `${p.x} ${bottom(p.v, p.h)}`).reverse();
  return `M${up.join(" L")} L${dn.join(" L")} Z`;
}

export interface XY {
  x: number;
  y: number;
}

/** `points` attribute for the polyline. */
export const linePoints = (pts: XY[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

/** Soft fill under the line, closed along the chart floor. */
export function areaPath(pts: XY[]): string {
  if (pts.length === 0) return "";
  const floor = yScale(CHART.lo);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `M${first.x} ${floor} L${pts.map((p) => `${p.x} ${p.y}`).join(" L")} L${last.x} ${floor} Z`;
}

/** Tooltip card origin: flips to the left of points past the middle, stays inside the plot vertically. */
export function tooltipOrigin(p: XY): XY {
  const x = p.x > 400 ? p.x - 190 : p.x + 14;
  const y = Math.round(clamp(p.y - 46, 8, 140));
  return { x, y };
}

// ---------- live estimate ----------

/**
 * Deterministic "so far" estimate while a run is in flight: the anchor value
 * plus a sine wobble that decays to zero as questions finish. Deterministic so
 * the same progress always draws the same frame (no flicker on re-render).
 */
export function liveEstimate(anchor: number, done: number, total: number, seed: number): number {
  const left = total > 0 ? 1 - clamp(done / total, 0, 1) : 0;
  const wobble = Math.sin(done * 0.55 + seed) * 0.07 * left;
  return clamp(Number((anchor + wobble).toFixed(2)), 0.3, 0.99);
}
