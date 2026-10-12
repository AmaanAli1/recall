import s from "../library.module.css";

export interface Rejection {
  files: { name: string; kind: string }[];
  /** PDFs from the same drop that were still added. */
  added: number;
}

/**
 * Explains which files were skipped and how to fix them. It collapses with a
 * grid-rows transition and keeps its last content while closing, so the text
 * doesn't vanish mid-animation.
 */
export function RejectionSlip({ rejection, open, inputId, onDismiss }: { rejection: Rejection | null; open: boolean; inputId: string; onDismiss: () => void }) {
  const files = rejection?.files ?? [];
  const added = rejection?.added ?? 0;
  const n = files.length;
  const title = added
    ? `Added ${added} PDF${added === 1 ? "" : "s"}. Skipped ${n} file${n === 1 ? "" : "s"}.`
    : "PDFs only, for now";
  const these = n === 1 ? "this file" : `these ${n} files`;

  return (
    <div className={`${s.collapse} ${open ? s.open : ""}`} aria-hidden={!open}>
      <div className={s.clip}>
        <div className={`${s.slide} pt-3`}>
          {rejection && (
            <div role="alert" className="relative flex gap-4 rounded border border-[rgba(200,37,14,0.38)] border-l-[3px] border-l-red bg-[#fdf4f0] py-4 pl-[18px] pr-4">
              <span aria-hidden="true" className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-red text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 7v6" />
                  <path d="M12 17h.01" />
                </svg>
              </span>
              <div className="min-w-0 flex-auto">
                <p className="mt-[3px] text-base font-semibold text-ink">{title}</p>
                <p className="mt-1 text-sm text-ink-2">Recall reads the text inside PDFs, so it couldn’t add {these}:</p>
                <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
                      <span translate="no" className="font-mono text-ink [overflow-wrap:anywhere]">{f.name}</span>
                      <span className="whitespace-nowrap rounded-[3px] border border-line-2 px-2 py-0.5 text-xs font-medium text-ink-2">{f.kind}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] text-ink-2">
                  Slides and Word docs: use File › Export › PDF, then drop the PDF here. Photos of notes: combine them into a PDF and run OCR.
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <label htmlFor={inputId} className="btn btn-ghost inline-flex cursor-pointer items-center rounded-[5px] px-3.5 py-2 text-sm">
                    Choose PDFs instead
                  </label>
                  <button type="button" onClick={onDismiss} className={`btn ${s.rejOk} inline-flex items-center gap-2 rounded-[5px] border border-transparent px-3 py-2 text-sm text-ink-2`}>
                    <svg className={s.okTick} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                    <span className={s.okWord}>Got it</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className={`${s.iconBtn} -mr-1.5 -mt-1.5 inline-flex h-[34px] w-[34px] flex-none items-center justify-center self-start rounded border-0 bg-transparent text-ink-2`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
