import styles from "../demo.module.css";
import { BootStep } from "./BootStep";
import { STEP_LABELS, type BootState } from "./useDemoBoot";

const FIELD_ROW = "flex gap-4";
const FIELD_LABEL = "w-[88px] flex-none text-[13px] text-ink-2 max-[479px]:w-[72px]";

/** The "[recall] library card": fields, live checklist, ISSUED stamp, and an inline error. */
export function LibraryCard({ state, onRetry }: { state: BootState; onRetry: () => void }) {
  const { error } = state;
  return (
    <div className={styles.card}>
      <div className={`${styles.ear} ${styles.edge}`}>
        <div className={`${styles.ear} ${styles.inner}`}>
          <span aria-hidden="true" className={styles.marginLine} />

          <div className="flex h-9 items-baseline justify-between">
            <span translate="no" className="inline-flex items-center gap-[5px] text-base font-semibold">
              <span aria-hidden="true" className="font-mono text-red">[</span>
              recall
              <span aria-hidden="true" className="font-mono text-red">]</span> library card
            </span>
            <span className="font-mono text-xs text-ink-2">DEMO</span>
          </div>

          <dl className="num m-0 text-[15px] leading-9">
            <div className={`${styles.f1} ${FIELD_ROW}`}>
              <dt className={FIELD_LABEL}>Session</dt>
              <dd className="m-0">
                <span className={`${styles.fieldV} font-mono`} translate="no">{state.sessionId}</span>
              </dd>
            </div>
            <div className={`${styles.f2} ${FIELD_ROW}`}>
              <dt className={FIELD_LABEL}>Courses</dt>
              <dd className="m-0">
                <span className={styles.fieldV}>{state.coursesLabel}</span>
              </dd>
            </div>
            <div className={`${styles.f3} ${FIELD_ROW}`}>
              <dt className={FIELD_LABEL}>Expires</dt>
              <dd className="m-0">
                <span className={styles.fieldV}>24 hours after your last question</span>
              </dd>
            </div>
          </dl>

          <ol
            aria-live="polite"
            className="m-0 mt-[18px] flex list-none flex-col gap-1 border-t border-dashed border-line-2 p-0 pt-3.5 text-sm leading-7"
          >
            {STEP_LABELS.map((label, i) => (
              <BootStep key={label} label={label} status={state.steps[i]} />
            ))}
          </ol>

          {error && (
            <div role="alert" className={styles.error}>
              <span>
                <strong className="font-semibold">Couldn’t finish: {STEP_LABELS[error.step].toLowerCase()}.</strong>{" "}
                <span className="text-ink-2">{error.message}</span>
              </span>
              <button
                type="button"
                onClick={onRetry}
                className="btn btn-ghost inline-flex min-h-9 items-center rounded-[5px] px-3.5 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          <span className={styles.stamp} aria-hidden="true">
            ISSUED
            <span className={styles.stampDate}>{state.stampDate}</span>
          </span>
        </div>
      </div>
      <span aria-hidden="true" className={styles.fold} />
    </div>
  );
}
