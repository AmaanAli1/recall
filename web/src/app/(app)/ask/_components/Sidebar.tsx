"use client";

import Link from "next/link";
import type { Course } from "@/lib/api";
import type { Glance } from "./AskWorkspace";
import { ChatList } from "./ChatList";
import { IdentityRow } from "./IdentityRow";
import type { Settings } from "./settings";
import s from "../ask.module.css";

/** Left pane: new question, courses, chats, course glance card, identity + settings. */
export function Sidebar({
  courses,
  currentCourse,
  currentChat,
  glance,
  onNew,
  settings,
  onSettings,
}: {
  courses: Course[];
  currentCourse: string;
  currentChat: string | null;
  glance: Glance | null;
  onNew: () => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
}) {
  const current = courses.find((c) => c.id === currentCourse);
  return (
    <aside aria-label="Courses and chats" className={s.paneLeft}>
      <button
        type="button"
        aria-keyshortcuts="N"
        onClick={onNew}
        className="btn btn-red flex min-h-11 items-center justify-between gap-2.5 rounded-[5px] border-0 py-[9px] pl-3.5 pr-[9px] text-[15px] font-medium"
      >
        New question <kbd className="kbd">N</kbd>
      </button>

      <nav aria-labelledby="courses-h">
        <h2 id="courses-h" className="m-0 mb-2 px-2.5 text-[13px] font-medium text-ink-2">Courses</h2>
        {courses.map((c) =>
          c.id === currentCourse ? (
            <Link
              key={c.id}
              href="/ask"
              aria-current="true"
              className="flex justify-between rounded bg-sheet p-2.5 text-[15px] font-medium shadow-[0_0_0_1px_var(--line-2)]"
            >
              {c.name}
              <span className={`num ${s.courseNum} text-red`}>[{c.documents.length}]</span>
            </Link>
          ) : (
            // Other courses open in Library until Ask can switch course.
            <Link key={c.id} href="/library" className={`${s.sideL} flex justify-between rounded p-2.5 text-[15px] text-ink-2`}>
              {c.name}
              <span className={`num ${s.courseNum}`}>[{c.documents.length}]</span>
            </Link>
          ),
        )}
      </nav>

      <ChatList currentChat={currentChat} />

      <div className="sheet relative">
        <div className="ear bg-line-2 p-px">
          <div className="ear bg-sheet px-3.5 pb-3 pt-3.5">
            <p className="m-0 text-[13px] font-medium">{current?.name ?? "Algorithms"} at a glance</p>
            <div className="num mt-2.5 grid grid-cols-2 gap-2">
              <div>
                <p className="m-0 font-mono text-[17px]">{glance ? glance.passages : "—"}</p>
                <p className="m-0 mt-0.5 text-xs text-ink-2">passages</p>
              </div>
              <div>
                <p className="m-0 font-mono text-[17px]">{glance?.recall != null ? glance.recall.toFixed(2) : "—"}</p>
                <p className="m-0 mt-0.5 text-xs text-ink-2">recall@5{glance ? ` · ${glance.clear ? "clear" : "below the line"}` : ""}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 border-t border-line pt-2.5 text-[13px]">
              <Link href="/library" className="lnk lnk-hl text-ink">Documents</Link>
              <Link href="/dyno" className="lnk lnk-hl text-ink">Dyno report</Link>
            </div>
          </div>
        </div>
        <span aria-hidden="true" className="fold" />
      </div>

      <IdentityRow settings={settings} onSettings={onSettings} />
    </aside>
  );
}
