"use client";

import type { CourseDocument } from "@/lib/api";
import { DocumentRow } from "./DocumentRow";
import s from "../library.module.css";

interface Props {
  docs: CourseDocument[];
  /** The row whose "…" menu is open, if any. */
  openMenu: string | null;
  setOpenMenu: (docId: string | null) => void;
  onNavigate: (href: string) => void;
  /** For "Ask" links, so Ask opens on this course. */
  courseId: string;
}

/** Stats line and the ruled ledger of documents (read-only: the demo's course is fixed). */
export function DocumentLedger({ docs, openMenu, setOpenMenu, onNavigate, courseId }: Props) {
  const passages = docs.reduce((sum, d) => sum + (d.passages ?? 0), 0);

  return (
    <>
      <div className="num mb-2.5 mt-[26px] flex flex-wrap gap-x-[22px] gap-y-2 text-sm text-ink-2">
        <span><strong className="font-semibold text-ink">{docs.length}</strong> documents</span>
        <span><strong className="font-semibold text-ink">{passages.toLocaleString("en-CA")}</strong> passages ready to cite</span>
      </div>
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
              const open = openMenu === d.id;
              return (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  n={i + 1}
                  menuOpen={open}
                  onToggleMenu={() => setOpenMenu(open ? null : d.id)}
                  onCloseMenu={() => setOpenMenu(null)}
                  onNavigate={onNavigate}
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
