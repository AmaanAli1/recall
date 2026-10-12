import s from "../dyno.module.css";
import { cx } from "../_lib/model";

/**
 * Height-animating disclosure used by the run and compare panels. Grid rows go
 * 0fr → 1fr so the real content height animates without measuring. `inert`
 * keeps a closing panel out of the tab order straight away.
 */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={cx(s.collapse, open && s.open)} aria-hidden={!open} inert={!open}>
      <div className={s.clip}>
        <div className={cx(s.slide, "pt-4")}>{children}</div>
      </div>
    </div>
  );
}

/** Small × used to close a panel. */
export function CloseButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={cx(s.xBtn, className)} onClick={onClick} aria-label={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export type ChipTone = "good" | "bad" | "mid" | "neutral";

/** Outlined status chip (gate, verdicts, run status). */
export function Chip({ tone, fill = false, children }: { tone: ChipTone; fill?: boolean; children: React.ReactNode }) {
  return (
    <span className={cx(s.chip, s[tone], fill && tone === "bad" && s.badFill, fill && tone === "mid" && s.midFill)}>{children}</span>
  );
}
