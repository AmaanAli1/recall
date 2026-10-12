"use client";

import type { CourseDocument } from "@/lib/api";
import { DocumentRow } from "./DocumentRow";
import s from "../library.module.css";

export interface MenuState {
  docId: string;
  confirming: boolean;
}

export interface UndoState {
  courseId: string;
  doc: CourseDocument;
  index: number;
}

interface Props {
  docs: CourseDocument[];
  menu: MenuState | null;
  undo: UndoState | null;
  setMenu: (m: MenuState | null) => void;
  onDelete: (doc: CourseDocument) => void;
  onUndo: () => void;
  onNavigate: (href: string) => void;
  onRunOcr: (doc: CourseDocument) => void;
  /** For "Ask" links, so Ask opens on this course. */
  courseId: string;
}

/**
 * Dark "deleted" bar with Undo. The aria-live wrapper stays mounted so the
 * message is announced when it appears.
 */
export function UndoBar({ undo, onUndo }: { undo: UndoState | null; onUndo: () => void }) {
  return (
    <div aria-live="polite">
      {undo && (
        <div className={`${s.popIn} mb-3 flex items-center justify-between gap-3 rounded bg-ink px-3.5 py-2.5 text-sm text-paper`}>
          <span>
            <span translate="no">{undo.doc.name}</span> deleted, with its passages.
          </span>
          <button type="button" onClick={onUndo} className={`${s.undo} min-h-[34px] rounded-[3px] border-0 bg-transparent px-2.5 py-1.5 text-sm font-semibold text-[#ffb4a6]`}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

/** Stats line, Undo bar and the ruled ledger of documents. */
export function DocumentLedger({ docs, menu, undo, setMenu, onDelete, onUndo, onNavigate, onRunOcr, courseId }: Props) {
  const ready = docs.filter((d) => d.status === "ready");
  const busy = docs.filter((d) => d.status === "embedding").length;
  const failed = docs.filter((d) => d.status === "failed").length;
  const passages = ready.reduce((sum, d) => sum + (d.passages ?? 0), 0);

  return (
    <>
      <div className="num mb-2.5 mt-[26px] flex flex-wrap gap-x-[22px] gap-y-2 text-sm text-ink-2">
        <span><strong className="font-semibold text-ink">{docs.length}</strong> documents</span>
        <span><strong className="font-semibold text-ink">{passages.toLocaleString("en-CA")}</strong> passages ready to cite</span>
        {busy > 0 && <span><strong className="font-semibold text-ink">{busy}</strong> processing</span>}
        {failed > 0 && <span className="text-bad"><strong className="font-semibold">{failed}</strong> needs attention</span>}
      </div>
      <UndoBar undo={undo} onUndo={onUndo} />
      {/* Pulled into the left margin so the row numbers sit beside the red margin line. */}
      <div className={`${s.ledgerWrap} -ml-12 pl-12 sm:-ml-[76px] sm:pl-[76px]`}>
        <table className="num w-full min-w-[780px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-xs text-ink-2">
              <th scope="col" className="py-2.5 pl-0 pr-3 font-medium">Document</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Pages</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Passages</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Added</th>
              <th scope="col" className="py-2.5 pl-3 pr-0 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => {
              const open = menu?.docId === d.id;
              return (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  n={i + 1}
                  menuOpen={open}
                  confirming={open && !!menu?.confirming}
                  onToggleMenu={() => setMenu(open ? null : { docId: d.id, confirming: false })}
                  onCloseMenu={() => setMenu(null)}
                  onConfirmDelete={() => setMenu({ docId: d.id, confirming: true })}
                  onCancelDelete={() => setMenu({ docId: d.id, confirming: false })}
                  onDelete={() => onDelete(d)}
                  onNavigate={onNavigate}
                  onRunOcr={() => onRunOcr(d)}
                  askHref={`/ask?course=${encodeURIComponent(courseId)}`}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
