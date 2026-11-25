import { MAX_PDF_MB, type SkipReason } from "@/lib/files";
import s from "../library.module.css";

export interface Rejection {
  /** `kind` is the label next to the name ("PowerPoint", or "48 MB" for a PDF over the limit). */
  files: { name: string; kind: string; reason: SkipReason | "sample" }[];
  /** PDFs from the same drop that were still added. */
  added: number;
  /** Set when the course is a sample course (its name): nothing can be added, whatever the file. */
  locked?: string;
}

/**
 * Explains which files were skipped (not a PDF, over the size limit, or a
 * sample course that takes no uploads) and how to fix it, with only the advice
 * that fits. It collapses with a
 * grid-rows transition and keeps its last content while closing, so the text
 * doesn't vanish mid-animation.
 */
export function RejectionSlip({
  rejection,
  open,
  inputId,
  onDismiss,
  onNewCourse,
}: {
  rejection: Rejection | null;
  open: boolean;
  inputId: string;
  onDismiss: () => void;
  onNewCourse?: () => void;
}) {
  const locked = rejection?.locked;
  const files = rejection?.files ?? [];
  const added = rejection?.added ?? 0;
  const n = files.length;
  const notPdf = files.some((f) => f.reason === "type");
  const tooBig = files.some((f) => f.reason === "size");
  const title = locked
    ? "Sample courses can’t be changed"
    : added
      ? `Added ${added} PDF${added === 1 ? "" : "s"}. Skipped ${n} file${n === 1 ? "" : "s"}.`
      : tooBig && !notPdf
        ? `Over the ${MAX_PDF_MB} MB limit`
        : notPdf && !tooBig
          ? "PDFs only, for now"
          : `Couldn’t add ${n} files`;
  const these = n === 1 ? "this file" : `these ${n} files`;
  // Why, in one line: the reason that applies, or both when the drop mixed them.
  const why = locked
    ? `${locked} is shared by every visitor, so PDFs can’t be added to it.`
    : tooBig && notPdf
      ? `Recall reads the text inside PDFs of up to ${MAX_PDF_MB} MB each (a demo limit, for now), so it couldn’t add ${these}:`
      : tooBig
        ? `PDFs can be up to ${MAX_PDF_MB} MB each in this demo, for now, so it couldn’t add ${these}:`
        : `Recall reads the text inside PDFs, so it couldn’t add ${these}:`;

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
                <p className="mt-1 text-sm text-ink-2">{why}</p>
                {n > 0 && (
                  <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
                        <span translate="no" className="font-mono text-ink [overflow-wrap:anywhere]">{f.name}</span>
                        <span className="whitespace-nowrap rounded-[3px] border border-line-2 px-2 py-0.5 text-xs font-medium text-ink-2">{f.kind}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {locked && (
                  <p className="mt-3 text-[13px] text-ink-2">Make a course of your own and add your PDFs there. The demo allows one.</p>
                )}
                {!locked && notPdf && (
                  <p className="mt-3 text-[13px] text-ink-2">
                    Slides and Word docs: use File › Export › PDF, then drop the PDF here. Photos of notes: combine them into a PDF and run OCR.
                  </p>
                )}
                {!locked && tooBig && (
                  <p className="mt-3 text-[13px] text-ink-2">
                    Big PDFs: split them into parts (a chapter each works well) or save a compressed copy, then drop those here.
                  </p>
                )}
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {locked ? (
                    onNewCourse && (
                      <button type="button" onClick={onNewCourse} className="btn btn-ghost inline-flex items-center rounded-[5px] px-3.5 py-2 text-sm">
                        New course
                      </button>
                    )
                  ) : (
                    <label htmlFor={inputId} className="btn btn-ghost inline-flex cursor-pointer items-center rounded-[5px] px-3.5 py-2 text-sm">
                      {notPdf ? "Choose PDFs instead" : "Choose other PDFs"}
                    </label>
                  )}
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
