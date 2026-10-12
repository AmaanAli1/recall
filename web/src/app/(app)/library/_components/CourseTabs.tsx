"use client";

import { useRef, type KeyboardEvent } from "react";
import type { Course } from "@/lib/api";
import { colorHex, courseLabel } from "@/lib/courses";
import s from "../library.module.css";

export const tabId = (courseId: string) => `tab-${courseId}`;
export const PANEL_ID = "docs";

/**
 * Binder index tabs, one per course. Follows the ARIA tabs pattern: only the
 * selected tab is in the tab order, and arrow keys / Home / End move between
 * tabs (selection follows focus, since switching is instant).
 */
export function CourseTabs({ courses, current, onPick }: { courses: Course[]; current: string; onPick: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = courses.findIndex((c) => c.id === current);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % courses.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + courses.length) % courses.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = courses.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onPick(courses[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Courses" onKeyDown={onKeyDown} className="flex flex-wrap items-end gap-1 pl-3">
      {courses.map((c, i) => {
        const on = c.id === current;
        return (
          <button
            key={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(c.id)}
            aria-selected={on}
            aria-controls={PANEL_ID}
            tabIndex={on ? 0 : -1}
            onClick={() => onPick(c.id)}
            title={c.term ? `${courseLabel(c)} · ${c.term}` : courseLabel(c)}
            className={`${s.earTab} ${s.tab} ${on ? s.tabOn : s.tabOff} ${c.archived ? s.tabArchived : ""}`}
          >
            <span aria-hidden="true" className={s.tabDot} style={{ background: colorHex(c.color) }} />
            {courseLabel(c)}
            {c.archived && <span className="sr-only"> (archived)</span>} <span className={`num ${s.tabCount}`}>[{c.documents.length}]</span>
          </button>
        );
      })}
    </div>
  );
}
