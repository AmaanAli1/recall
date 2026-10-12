"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Course } from "@/lib/api";
import { courseLabel } from "@/lib/courses";
import s from "../library.module.css";

/**
 * "… Course" next to the tabs: acts on the course you're viewing.
 * Edit (name, code, term, colour) · Archive / Unarchive · Delete (confirm, then Undo).
 * You can't archive or delete your last active course, so Ask always has one.
 */
export function CourseMenu({
  course,
  lastActive,
  onEdit,
  onArchive,
  onDelete,
}: {
  course: Course;
  lastActive: boolean;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const label = courseLabel(course);
  const docs = course.documents.length;
  const docText = `${docs} PDF${docs === 1 ? "" : "s"}`;

  const close = (refocus = false) => {
    setOpen(false);
    setConfirming(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus moves into the menu (first item, or Cancel on the confirm step).
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>(confirming ? "[data-cancel]" : '[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [open, confirming]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const blocked = lastActive && !course.archived;

  return (
    <div ref={root} onKeyDown={onKey} className="relative flex items-center pb-2">
      <button
        ref={trigger}
        type="button"
        className={s.cGhost}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${label}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
        Course
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label={`Options for ${label}`} className={s.cMenu}>
          {confirming ? (
            <div className="px-2 pb-1.5 pt-2">
              <p className="m-0 text-[13px] leading-[1.45]">
                Delete <strong className="font-semibold">{label}</strong>? Its {docText} and their chats go too. You can undo right after.
              </p>
              <div className="mt-2.5 flex gap-1.5">
                <button
                  type="button"
                  className="btn btn-red min-h-[34px] rounded border-0 px-3 py-1.5 text-[13px] font-medium"
                  onClick={() => {
                    close();
                    onDelete();
                  }}
                >
                  Delete
                </button>
                <button type="button" data-cancel="" className="btn btn-ghost min-h-[34px] rounded bg-paper! px-3 py-1.5 text-[13px]" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={s.cMi}
                onClick={() => {
                  close();
                  onEdit();
                }}
              >
                <Icon d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                Edit name, term, colour
              </button>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={blocked}
                className={s.cMi}
                onClick={() => {
                  if (blocked) return;
                  close();
                  onArchive(!course.archived);
                }}
              >
                <Icon d="M3 4h18v4H3z M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8 M10 12h4" />
                <span>
                  {course.archived ? "Unarchive" : "Archive"}
                  <span className={s.cMiHint}>
                    {course.archived ? "Show it in Ask and the tabs again" : blocked ? "Keep at least one active course" : "Hide it from Ask, keep its PDFs"}
                  </span>
                </span>
              </button>
              <div role="separator" className="mx-1 my-1.5 h-px bg-line" />
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={blocked}
                className={`${s.cMi} ${s.cMiDanger}`}
                onClick={() => {
                  if (!blocked) setConfirming(true);
                }}
              >
                <Icon d="M4 7h16 M10 11v6 M14 11v6 M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12 M9 7V4h6v3" />
                <span>
                  Delete course
                  <span className={s.cMiHint}>{blocked ? "Keep at least one active course" : `${docText} and its chats`}</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="flex-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
