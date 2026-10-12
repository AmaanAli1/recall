"use client";

import Link from "next/link";
import { useState } from "react";
import type { Course, CourseDocument } from "@/lib/api";
import { colorHex, courseLabel } from "@/lib/courses";
import type { Glance } from "./AskWorkspace";
import { ChatList } from "./ChatList";
import { IdentityRow } from "./IdentityRow";
import type { Settings } from "./settings";
import s from "../ask.module.css";

/** Left pane: new chat, courses, chats, course glance card, identity + settings. */
export function Sidebar({
  courses,
  currentCourse,
  onSelectCourse,
  currentChat,
  glance,
  onNew,
  settings,
  onSettings,
}: {
  courses: Course[];
  currentCourse: string;
  onSelectCourse: (id: string) => void;
  currentChat: string | null;
  glance: Glance | null;
  onNew: () => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
}) {
  const current = courses.find((c) => c.id === currentCourse);
  // Archived courses are hidden from Ask (they come back when unarchived in Library).
  const active = courses.filter((c) => !c.archived);
  return (
    <aside aria-label="Courses and chats" className={s.paneLeft}>
      <button
        type="button"
        aria-keyshortcuts="N"
        onClick={onNew}
        className="btn btn-red flex min-h-11 items-center justify-between gap-2.5 rounded-[5px] border-0 py-[9px] pl-3.5 pr-[9px] text-[15px] font-medium"
      >
        New chat <kbd className="kbd">N</kbd>
      </button>

      <nav aria-labelledby="courses-h">
        <h2 id="courses-h" className="m-0 mb-2 px-2.5 text-[13px] font-medium text-ink-2">Courses</h2>
        {/* Buttons, not links: choosing a course changes what Ask searches, it doesn't go anywhere. */}
        {active.map((c) => {
          const on = c.id === currentCourse;
          return (
            <button
              key={c.id}
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={on ? undefined : () => onSelectCourse(c.id)}
              className={
                on
                  ? "flex w-full items-center rounded border-0 bg-sheet p-2.5 text-left text-[15px] font-medium text-ink shadow-[0_0_0_1px_var(--line-2)]"
                  : `${s.sideL} flex w-full items-center rounded border-0 bg-transparent p-2.5 text-left text-[15px] text-ink-2`
              }
            >
              <span aria-hidden="true" className={s.courseDot} style={{ background: colorHex(c.color) }} />
              <span className="min-w-0 flex-auto truncate">{courseLabel(c)}</span>
              <span className={`num ${s.courseNum} ${on ? "text-red" : ""}`}>[{c.documents.length}]</span>
            </button>
          );
        })}
      </nav>

      <ChatList courseId={currentCourse} currentChat={currentChat} calm={settings.calm} />

      <GlanceCard course={current} glance={glance} />

      <IdentityRow settings={settings} onSettings={onSettings} />
    </aside>
  );
}

/**
 * "{Course} at a glance". It's for glancing, so Documents opens in place (a list of
 * this course's PDFs) and only "Manage in Library →" / "Open Dyno →" leave the page.
 */
function GlanceCard({ course, glance }: { course: Course | undefined; glance: Glance | null }) {
  const [open, setOpen] = useState(false);
  const docs = course?.documents ?? [];
  const name = course?.name ?? "Algorithms";
  const n = docs.length;
  return (
    <div className="sheet relative">
      <div className="ear bg-line-2 p-px">
        <div className="ear bg-sheet px-3.5 pb-2 pt-3.5">
          <p className="m-0 text-[13px] font-medium">{name} at a glance</p>
          <div className="num mt-2.5 grid grid-cols-2 gap-2">
            <div>
              <p className="m-0 font-mono text-[17px]">{glance ? glance.passages : "—"}</p>
              <p className="m-0 mt-0.5 text-xs text-ink-2">passages</p>
            </div>
            <div>
              <p className="m-0 font-mono text-[17px]">{glance?.recall != null ? glance.recall.toFixed(2) : "—"}</p>
              <p className="m-0 mt-0.5 text-xs text-ink-2">recall@5{glance?.recall != null ? ` · ${glance.clear ? "clear" : "below the line"}` : ""}</p>
            </div>
          </div>

          <div className="mt-2.5 border-t border-line pt-1">
            <button type="button" className={s.glDocs} aria-expanded={open} aria-controls="gl-docs" onClick={() => setOpen((o) => !o)}>
              <span className={s.glLbl}>
                Documents
                <svg className={s.glChev} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
              <span className={`${s.glMeta} num`}>{n === 1 ? "1 PDF" : `${n} PDFs`}</span>
            </button>
            <div id="gl-docs" className={`${s.collapse} ${open ? s.open : ""}`} inert={!open}>
              <div className={s.clip}>
                <div className={s.slide}>
                  {n > 0 ? (
                    <ul aria-label={`${name} documents`} className={s.glList}>
                      {docs.map((d) => (
                        <li key={d.id} className={s.glDoc}>
                          <span className={s.glName} translate="no" title={d.name}>{d.name}</span>
                          <span className={`${s.glSt} num`} style={{ color: statusColor(d) }}>{statusText(d)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 mt-1.5 text-xs text-ink-2">No PDFs in this course yet.</p>
                  )}
                  <p className="m-0 mb-1.5 mt-2 text-[13px]">
                    {/* Library opens on this same course. */}
                    <Link href={`/library?course=${encodeURIComponent(course?.id ?? "")}`} className="lnk-hl text-ink">
                      {n ? "Manage in Library →" : "Add PDFs in Library →"}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
            <Link href="/dyno" className={`${s.glDocs} mt-0.5 border-t border-line`}>
              <span className={s.glLbl}>
                Open Dyno<span className={s.glArr} aria-hidden="true">→</span>
              </span>
              <span className={`${s.glMeta} num`}>{glance?.run ? `run ${glance.run.id.slice(1)} · ${glance.run.date}` : "not run yet"}</span>
            </Link>
          </div>
        </div>
      </div>
      <span aria-hidden="true" className="fold" />
    </div>
  );
}

function statusText(d: CourseDocument) {
  if (d.status === "ready") return `${d.pages ?? "?"} pp`;
  if (d.status === "embedding") return `${d.stage === "ocr" ? "OCR" : "embedding"} ${d.progress ?? 0}%`;
  return "failed";
}

function statusColor(d: CourseDocument) {
  return d.status === "ready" ? "var(--ink-3)" : d.status === "embedding" ? "var(--mid)" : "var(--bad)";
}
