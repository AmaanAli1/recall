import { BUILD, PHASES } from "@/lib/build-status";
import s from "./build-status.module.css";

/**
 * The footer's build bar: a small worker in a hard hat walks in with the roadmap
 * bar, then works in a 10-second loop: three hammer strikes, a break (hammer down,
 * wipes his brow, sweats, catches his breath), and back to work.
 * Pure CSS animation, no JavaScript. With reduced motion he just stands there.
 */
export function BuildStatus() {
  const n = PHASES.length;
  const pct = ((BUILD.current + BUILD.progress) / n) * 100;
  const done = PHASES.slice(0, BUILD.current);
  const now = PHASES[BUILD.current];
  const label = `Build progress: Phase ${BUILD.current} of ${n - 1}, ${now}. ${done.join(" and ")} ${done.length === 1 ? "is" : "are"} done.`;
  const title = PHASES.map((p, i) => `${i} ${p}${i < BUILD.current ? " ✓" : i === BUILD.current ? " (building)" : ""}`).join(" · ");

  return (
    <div className={s.bw} role="img" aria-label={label} title={title} style={{ "--p": `${pct.toFixed(1)}%` } as React.CSSProperties}>
      <div className={s.track}>
        <div className={s.fill} />
        {PHASES.slice(1).map((p, i) => (
          <span key={p} className={s.tick} style={{ left: `${(((i + 1) / n) * 100).toFixed(2)}%` }} />
        ))}
        <svg className={s.man} viewBox="0 0 44 40" aria-hidden="true">
          <g className={s.breath}>
            <g className={s.body} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="11.5" r="3.6" fill="var(--sheet)" />
              <path d="M13.2 10.4a4.8 4.8 0 0 1 9.6 0z" fill="var(--red)" stroke="var(--red)" strokeWidth="1.4" />
              <path d="M12 10.6h12.4" stroke="var(--red)" strokeWidth="1.6" />
              <path d="M18 15.6v11" />
              <path d="M18 26.6l-4 9.4M18 26.6l3.6 9.4" />
              <path className={s.wipe} d="M18 19.4l-5.4 5.2" />
              <g className={s.arm}>
                <path d="M18 19.4l7.4 1.6" />
                <path d="M25.4 21l2.2-8.4" stroke="#8A5605" strokeWidth="2" />
                <rect x="24.2" y="9.6" width="7" height="4" rx="1" transform="rotate(14 27.7 11.6)" fill="var(--ink)" stroke="none" />
              </g>
            </g>
            <path className={s.drop} d="M23.6 7.2c.9 1.3 1.4 2.1 1.4 2.7a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.7z" fill="#7FB2D6" />
            <path className={`${s.drop} ${s.drop2}`} d="M22.4 9.4c.7 1 1.1 1.7 1.1 2.1a1.1 1.1 0 0 1-2.2 0c0-.4.4-1.1 1.1-2.1z" fill="#7FB2D6" />
          </g>
          <g className={s.spark} stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round">
            <path d="M31 34.5v-3M34 36l2.2-1.6M28 36l-2.2-1.6" />
          </g>
        </svg>
      </div>
      <p className={`${s.cap} num`}>
        <span>
          Building <strong className="font-medium text-ink">Phase {BUILD.current}: {now}</strong>
        </span>
        <span className="font-mono text-xs text-ink-3">{BUILD.current} of {n} done</span>
      </p>
    </div>
  );
}
