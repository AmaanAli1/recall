import styles from "../demo.module.css";
import type { StepStatus } from "./useDemoBoot";

const STATUS_CLASS: Record<StepStatus, string> = {
  idle: "",
  busy: styles.busy,
  done: styles.done,
  failed: styles.failed,
};

// Spoken through the list's aria-live region; the dot and tick are decorative.
const STATUS_TEXT: Record<StepStatus, string> = {
  idle: "",
  busy: ", in progress",
  done: ", done",
  failed: ", failed",
};

/** One line of the boot checklist: a dot that pulses while busy and draws a tick when done. */
export function BootStep({ label, status }: { label: string; status: StepStatus }) {
  return (
    <li className={`${styles.step} ${STATUS_CLASS[status]} flex items-center gap-2.5`}>
      <span className={styles.dot} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="absolute inset-0">
          <path
            className={styles.tick}
            pathLength={1}
            d="M4.5 8.3l2.2 2.2 4.8-4.8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        {label}
        <span className="sr-only">{STATUS_TEXT[status]}</span>
      </span>
    </li>
  );
}
