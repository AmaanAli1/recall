"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, type KeyboardEvent } from "react";
import type { CourseDocument } from "@/lib/api";
import s from "../library.module.css";

const ICON = {
  open: "M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  ask: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  rename: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  reembed: "M20 11a8 8 0 0 0-14.5-4.5L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.5 4.5L20 16 M20 20v-4h-4",
  move: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 11v5 M9.5 13.5L12 16l2.5-2.5",
  download: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  ocr: "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M8 10h8 M8 14h5",
  cancel: "M6 6l12 12 M18 6L6 18",
  delete: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12 M9 7V4h6v3",
} as const;

interface MenuItem {
  label: string;
  icon: keyof typeof ICON;
  run: () => void;
  danger?: boolean;
  /** Draw a separator above this item. */
  sep?: boolean;
}

export interface DocumentRowProps {
  doc: CourseDocument;
  n: number;
  menuOpen: boolean;
  confirming: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  /** Navigate through the page's leave guard (menu items aren't links). */
  onNavigate: (href: string) => void;
}

/** One ledger line: margin number, dog-eared icon, status, and the actions menu. */
export function DocumentRow({ doc, n, menuOpen, confirming, onToggleMenu, onCloseMenu, onConfirmDelete, onCancelDelete, onDelete, onNavigate }: DocumentRowProps) {
  const ready = doc.status === "ready";
  const busy = doc.status === "embedding";
  const failed = doc.status === "failed";
  const pct = doc.progress ?? 0;
  const passages = doc.passages ?? "—";
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // TODO(backend): Run OCR, Open, Rename, Re-embed/Cancel, Move and Download need endpoints; for now they just close the menu.
  const items: MenuItem[] = [];
  if (failed) items.push({ label: "Run OCR", icon: "ocr", run: onCloseMenu });
  items.push({ label: "Open PDF", icon: "open", run: onCloseMenu });
  if (ready) items.push({ label: "Ask about this document", icon: "ask", run: () => { onCloseMenu(); onNavigate("/ask"); } });
  items.push({ label: "Rename", icon: "rename", run: onCloseMenu });
  if (busy) items.push({ label: "Cancel processing", icon: "cancel", run: onCloseMenu });
  else items.push({ label: "Re-embed passages", icon: "reembed", run: onCloseMenu });
  items.push({ label: "Move to another course", icon: "move", run: onCloseMenu });
  items.push({ label: "Download original", icon: "download", run: onCloseMenu });
  items.push({ label: "Delete", icon: "delete", run: onConfirmDelete, danger: true, sep: true });

  // Move focus into the menu when it opens (and to Cancel on the confirm step), per the ARIA menu pattern.
  useEffect(() => {
    if (!menuOpen) return;
    const first = menu.current?.querySelector<HTMLElement>(confirming ? "[data-cancel]" : '[role="menuitem"]');
    first?.focus();
  }, [menuOpen, confirming]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCloseMenu();
      trigger.current?.focus();
      return;
    }
    if (e.key === "Tab") {
      onCloseMenu();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const list = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!list.length) return;
    e.preventDefault();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[next].focus();
  };

  return (
    <tr className={`${s.row} ${failed ? s.failed : ""} ${menuOpen ? s.on : ""} border-t border-rule`}>
      <th scope="row" className="relative py-4 pl-0 pr-3 text-left font-normal">
        <span aria-hidden="true" className={`${s.rowN} absolute -left-[44px] top-[18px] w-[26px] sm:-left-[52px] sm:w-[30px] text-right font-mono text-xs`}>
          {n}.
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={`${s.rowDoc} relative h-5 w-4 flex-none`}>
            <span className="block h-full w-full bg-line-2 [clip-path:polygon(0_0,calc(100%_-_6px)_0,100%_6px,100%_100%,0_100%)]" />
            <span className="absolute inset-px bg-sheet [clip-path:polygon(0_0,calc(100%_-_5px)_0,100%_5px,100%_100%,0_100%)]" />
          </span>
          <span translate="no" className={`${s.rowName} overflow-hidden text-ellipsis whitespace-nowrap`}>
            {doc.name}
          </span>
        </span>
      </th>
      <td className="px-3 py-4 text-right font-mono text-sm">{doc.pages ?? "—"}</td>
      <td className="px-3 py-4 text-right font-mono text-sm">{passages}</td>
      <td className="min-w-[210px] px-3 py-4">
        {ready && (
          <span className="inline-flex items-center gap-2 text-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Ready
          </span>
        )}
        {busy && (
          <span className="flex flex-col gap-[7px]">
            <span className="text-sm">
              Embedding passages… <span className="font-mono">{pct}%</span>
            </span>
            <span
              role="progressbar"
              aria-label={`Embedding ${doc.name}`}
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="block h-[3px] overflow-hidden bg-line"
            >
              <span className="block h-full w-full origin-left bg-red" style={{ transform: `scaleX(${pct / 100})` }} />
            </span>
          </span>
        )}
        {failed && (
          <span className="flex flex-col gap-[3px]">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-bad">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16.5v.5" />
              </svg>
              No text found
            </span>
            <span className="text-[13px] text-ink-2">This PDF is a scan. Run OCR to make it searchable.</span>
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm text-ink-2">{doc.added}</td>
      <td data-menu-root="" className="relative whitespace-nowrap py-4 pl-3 pr-0 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          {ready && (
            <Link
              href="/ask"
              aria-label={`Ask about ${doc.name}`}
              className={`${s.rowAsk} box-border inline-flex min-h-9 items-center gap-1.5 rounded border border-line-2 bg-sheet px-3 py-[7px] text-sm font-medium text-red`}
            >
              Ask
              <svg className={s.rowAskArrow} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </Link>
          )}
          {failed && (
            // TODO(backend): start OCR for this document.
            <button type="button" className="btn btn-red min-h-9 rounded border-0 px-3 py-[7px] text-[13px] font-medium">
              Run OCR
            </button>
          )}
          <button
            ref={trigger}
            type="button"
            aria-label={`More actions for ${doc.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
            className={`${s.more} ${menuOpen ? s.moreOpen : "border-line-2 bg-sheet text-ink"} inline-flex h-9 w-9 items-center justify-center rounded border`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </span>
        {menuOpen && (
          <div
            ref={menu}
            role="menu"
            aria-label={`More actions for ${doc.name}`}
            onKeyDown={onMenuKey}
            className={`${s.menu} absolute right-0 top-[calc(100%_-_8px)] z-20 box-border w-[248px] whitespace-normal rounded-md border border-line-2 bg-sheet p-1.5 text-left shadow-[0_2px_3px_rgba(70,45,20,0.08),0_18px_36px_-12px_rgba(70,45,20,0.32)]`}
          >
            {confirming ? (
              <div className="px-2 pb-1.5 pt-2">
                <p className="m-0 text-[13px] leading-[1.45]">
                  Delete{" "}
                  <strong translate="no" className="break-all font-semibold">
                    {doc.name}
                  </strong>
                  ? {doc.passages != null ? `Recall forgets its ${doc.passages} passages too.` : "Recall forgets it too."}
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <button type="button" onClick={onDelete} className="btn btn-red min-h-[34px] rounded border-0 px-3 py-1.5 text-[13px] font-medium">
                    Delete
                  </button>
                  <button
                    type="button"
                    data-cancel=""
                    onClick={onCancelDelete}
                    className="btn btn-ghost min-h-[34px] rounded bg-paper! px-3 py-1.5 text-[13px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              items.map((it) => (
                <Fragment key={it.label}>
                  {it.sep && <div role="separator" className="mx-1 my-1.5 h-px bg-line" />}
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={it.run}
                    className={`${s.mi} ${it.danger ? s.miDanger : ""} flex min-h-9 w-full items-center gap-2.5 rounded border-0 bg-transparent px-2.5 py-2 text-left text-sm`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={ICON[it.icon]} />
                    </svg>
                    <span className="flex-auto">{it.label}</span>
                  </button>
                </Fragment>
              ))
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
