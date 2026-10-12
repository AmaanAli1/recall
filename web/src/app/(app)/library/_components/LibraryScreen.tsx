"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCourse,
  deleteCourse,
  deleteDocument,
  listCourses,
  runOcr,
  updateCourse,
  uploadDocument,
  type Course,
  type CourseDocument,
  type CourseInput,
} from "@/lib/api";
import { courseLabel } from "@/lib/courses";
import { CourseDialog, type DialogMode } from "./CourseDialog";
import { CourseMenu } from "./CourseMenu";
import { CourseTabs, PANEL_ID, tabId } from "./CourseTabs";
import { DocumentLedger, UndoBar, type MenuState, type UndoState } from "./DocumentLedger";
import { DropZone } from "./DropZone";
import { EmptyCourse } from "./EmptyCourse";
import { LeaveGuard, type InFlight } from "./LeaveGuard";
import s from "../library.module.css";

/** How long "Course deleted. Undo" stays before the delete is sent to the server. */
const COURSE_UNDO_MS = 8000;

/** Local rows for uploads in flight get this id prefix until the server returns the real document. */
const UPLOAD_PREFIX = "upload-";
const isInFlight = (d: CourseDocument) => d.id.startsWith(UPLOAD_PREFIX) && d.status === "embedding";

/** Apply `fn` to one course's document list. */
function editDocs(courses: Course[] | null, courseId: string, fn: (docs: CourseDocument[]) => CourseDocument[]): Course[] | null {
  return courses?.map((c) => (c.id === courseId ? { ...c, documents: fn(c.documents) } : c)) ?? null;
}

/** The Library: course tabs, drop zone, document ledger, and the mid-upload leave guard. */
export function LibraryScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [announce, setAnnounce] = useState("");
  // A deleted course hides at once; the server delete waits until the Undo window closes.
  const [deletedCourse, setDeletedCourse] = useState<Course | null>(null);
  // Courses whose first batch of PDFs earns the one-time "ready to ask" nudge.
  const [nudgeFor, setNudgeFor] = useState<ReadonlySet<string>>(new Set());
  const courseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingCourse = useRef<string | null>(null);
  const uploadSeq = useRef(0);
  // The link that triggered the guard, so "Stay" can hand focus back to it.
  const guardOpener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    // /library?course=os (from Ask's "Manage in Library →") opens on that course.
    const wanted = new URLSearchParams(window.location.search).get("course");
    listCourses().then((cs) => {
      if (!alive) return;
      setCourses(cs);
      const active = cs.filter((c) => !c.archived);
      setCurrent((c) => c ?? (active.find((x) => x.id === wanted) ?? active[0] ?? cs[0])?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Leaving the page closes the undo window: send any pending course delete.
  useEffect(
    () => () => {
      clearTimeout(courseTimer.current);
      if (pendingCourse.current) void deleteCourse(pendingCourse.current).catch(() => {});
    },
    [],
  );

  const all = courses ?? [];
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const tabs = showArchived ? [...active, ...archived] : active;
  const course = tabs.find((c) => c.id === current) ?? active[0] ?? null;
  const inFlight: InFlight[] = (courses ?? []).flatMap((c) => c.documents.filter(isInFlight).map((d) => ({ name: d.name, pct: d.progress ?? 0 })));
  const uploading = inFlight.length > 0;
  // The dialog closes itself once every upload has finished.
  const guardOpen = leaveHref !== null && uploading;
  const courseUndo = undo && course && undo.courseId === course.id ? undo : null;

  // ---------- uploads ----------
  const accept = (files: File[], courseId = course?.id) => {
    if (!courseId) return;
    // The first batch into an empty course earns the "ready to ask" nudge.
    const target = courses?.find((c) => c.id === courseId);
    if (files.length && (!target || target.documents.length === 0)) setNudgeFor((n) => new Set(n).add(courseId));
    setLeaveHref(null); // a stale "leave" request must not reopen the guard for these new uploads
    const rows = files.map((file) => ({
      file,
      row: {
        id: `${UPLOAD_PREFIX}${++uploadSeq.current}`,
        name: file.name,
        pages: null,
        passages: null,
        status: "embedding",
        progress: 2,
        added: "Just now",
      } satisfies CourseDocument,
    }));
    // Newest first, matching where the server lists them.
    setCourses((cs) => editDocs(cs, courseId, (docs) => [...rows.map((r) => r.row), ...docs]));

    for (const { file, row } of rows) {
      const patch = (fn: (d: CourseDocument) => CourseDocument) =>
        setCourses((cs) => editDocs(cs, courseId, (docs) => docs.map((d) => (d.id === row.id ? fn(d) : d))));
      uploadDocument(courseId, file, (pct) => patch((d) => ({ ...d, progress: Math.max(2, Math.round(Math.min(pct, 99))) })))
        .then((doc) => {
          patch(() => doc);
          // If the row was deleted mid-upload, Undo should bring back the finished document.
          setUndo((u) => (u?.doc.id === row.id ? { ...u, doc } : u));
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : "Upload failed.";
          patch((d) => ({ ...d, status: "failed", progress: undefined, error }));
        });
    }
  };

  // ---------- delete + undo ----------
  const remove = (doc: CourseDocument) => {
    if (!course) return;
    const courseId = course.id;
    const index = course.documents.findIndex((d) => d.id === doc.id);
    setCourses((cs) => editDocs(cs, courseId, (docs) => docs.filter((d) => d.id !== doc.id)));
    setUndo({ courseId, doc, index });
    setMenu(null);
    // Local upload rows don't exist on the server yet.
    // TODO(backend): Undo only restores locally; the real API needs a restore endpoint or a delayed delete.
    if (!doc.id.startsWith(UPLOAD_PREFIX)) deleteDocument(courseId, doc.id).catch(() => {});
  };

  // ---------- OCR: read a scanned PDF into text, then embed it ----------
  const ocr = (doc: CourseDocument) => {
    if (!course) return;
    const courseId = course.id;
    const patch = (fn: (d: CourseDocument) => CourseDocument) =>
      setCourses((cs) => editDocs(cs, courseId, (docs) => docs.map((d) => (d.id === doc.id ? fn(d) : d))));
    patch((d) => ({ ...d, status: "embedding", stage: "ocr", progress: 2, error: undefined }));
    setAnnounce(`Running OCR on ${doc.name}.`);
    runOcr(courseId, doc.id, (pct, stage) => patch((d) => ({ ...d, stage, progress: Math.max(2, Math.min(99, pct)) })))
      .then((done) => {
        patch(() => done);
        setAnnounce(`${doc.name} is ready.`);
      })
      .catch((err: unknown) => {
        patch((d) => ({ ...d, status: "failed", stage: undefined, progress: undefined, error: err instanceof Error ? err.message : "OCR failed." }));
      });
  };

  // ---------- courses: create, edit, archive, delete ----------
  const create = async (input: CourseInput, files: File[]) => {
    const made = await createCourse(input);
    setCourses((cs) => [...(cs ?? []), made]);
    setCurrent(made.id);
    setAnnounce(`Created ${courseLabel(made)}.`);
    // Same upload path as the drop zone.
    if (files.length) accept(files, made.id);
  };

  const save = async (id: string, input: CourseInput) => {
    const next = await updateCourse(id, input);
    setCourses((cs) => cs?.map((c) => (c.id === id ? { ...next, documents: c.documents } : c)) ?? null);
    setAnnounce(`Saved ${courseLabel(next)}.`);
  };

  const archive = (c: Course, on: boolean) => {
    setCourses((cs) => cs?.map((x) => (x.id === c.id ? { ...x, archived: on } : x)) ?? null);
    // Archiving the course you're on moves you to another active one.
    if (on && !showArchived) setCurrent(active.find((x) => x.id !== c.id)?.id ?? null);
    setAnnounce(`${on ? "Archived" : "Unarchived"} ${courseLabel(c)}.`);
    updateCourse(c.id, { archived: on }).catch(() => {
      setCourses((cs) => cs?.map((x) => (x.id === c.id ? { ...x, archived: !on } : x)) ?? null);
    });
  };

  const commitCourseDelete = (id: string) => {
    void deleteCourse(id).catch(() => {
      // The server refused: bring it back.
      listCourses().then(setCourses).catch(() => {});
    });
  };

  const removeCourse = (c: Course) => {
    clearTimeout(courseTimer.current);
    if (pendingCourse.current) commitCourseDelete(pendingCourse.current); // a second delete closes the first window
    pendingCourse.current = c.id;
    setCourses((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
    setDeletedCourse(c);
    setCurrent(active.find((x) => x.id !== c.id)?.id ?? null);
    courseTimer.current = setTimeout(() => {
      commitCourseDelete(c.id);
      pendingCourse.current = null;
      setDeletedCourse(null);
    }, COURSE_UNDO_MS);
  };

  const undoCourse = () => {
    const c = deletedCourse;
    clearTimeout(courseTimer.current);
    pendingCourse.current = null;
    setDeletedCourse(null);
    if (!c) return;
    setCourses((cs) => [...(cs ?? []), c]);
    setCurrent(c.id);
  };

  const restore = () => {
    if (!undo) return;
    const { courseId, doc, index } = undo;
    setCourses((cs) => editDocs(cs, courseId, (docs) => [...docs.slice(0, index), doc, ...docs.slice(index)]));
    setUndo(null);
  };

  // ---------- menu: outside click + Escape close it ----------
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-menu-root]")) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // A file dropped just outside the drop zone shouldn't make the browser open it and leave the page.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
    };
    document.addEventListener("dragover", stop);
    document.addEventListener("drop", stop);
    return () => {
      document.removeEventListener("dragover", stop);
      document.removeEventListener("drop", stop);
    };
  }, []);

  // ---------- leave guard ----------
  const openGuard = useCallback((href: string, opener: HTMLElement | null) => {
    guardOpener.current = opener;
    setMenu(null);
    setLeaveHref(href);
  }, []);

  useEffect(() => {
    if (!uploading) return;
    // Capture phase on document runs before next/link's own click handler, so we can stop it.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("data-guard-ok")) return;
      const raw = a.getAttribute("href") ?? "";
      if (!raw || raw.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin) return; // external, mailto:, etc.
      if (url.pathname === window.location.pathname) return; // same page (e.g. a hash on /library)
      e.preventDefault();
      e.stopPropagation();
      openGuard(url.pathname + url.search + url.hash, a);
    };
    // Closing the tab or reloading would also kill the uploads: ask the browser to confirm.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [uploading, openGuard]);

  const navigate = (href: string) => {
    if (uploading) openGuard(href, null);
    else router.push(href);
  };

  const stay = () => {
    setLeaveHref(null);
    guardOpener.current?.focus();
  };

  const leave = () => {
    const href = leaveHref;
    setLeaveHref(null);
    if (href) router.push(href);
  };

  const pick = (id: string) => {
    setCurrent(id);
    setMenu(null);
  };

  // Smart rules for the nudge: only the first batch into an empty course, only once every
  // PDF in it has finished, only once per course, and it never steals focus.
  const nudge =
    course && nudgeFor.has(course.id) && course.documents.length > 0 && course.documents.every((d) => d.status !== "embedding")
      ? course
      : null;
  const dismissNudge = (id: string) => setNudgeFor((n) => {
    const next = new Set(n);
    next.delete(id);
    return next;
  });

  return (
    <>
      <main id="main" className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 pb-[88px] pt-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 text-[54px] font-normal leading-[1.04] tracking-[-0.036em]">Library</h1>
            <p className="mt-3 max-w-[36em] text-[17px] leading-relaxed text-ink-2">Your course PDFs, split into passages Recall can search and cite.</p>
            <p className="mt-2.5 flex items-center gap-2 text-sm text-ink-2">
              <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full bg-good shadow-[0_0_0_3px_rgba(11,112,70,0.14)]" />
              Your demo comes with 3 sample courses. Add your own PDFs to any of them, or start a new course.
            </p>
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setDialog({ kind: "new" })}
            className="btn btn-ghost inline-flex min-h-11 items-center gap-2 rounded-[5px] px-3.5 py-[9px] text-sm font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            New course
          </button>
        </div>

        <p aria-live="polite" className="sr-only">{announce}</p>
        <div aria-live="polite">
          {deletedCourse && (
            <div className={`${s.popIn} mt-6 flex items-center justify-between gap-3 rounded bg-ink px-3.5 py-2.5 text-sm text-paper`}>
              <span>{courseLabel(deletedCourse)} deleted, with its PDFs and chats.</span>
              <button type="button" onClick={undoCourse} className={`${s.undo} min-h-[34px] rounded-[3px] border-0 bg-transparent px-2.5 py-1.5 text-sm font-semibold text-[#ffb4a6]`}>
                Undo
              </button>
            </div>
          )}
        </div>

        {courses && course ? (
          <>
            <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
              <CourseTabs courses={tabs} current={course.id} onPick={pick} />
              <div className="flex items-center gap-1.5">
                {archived.length > 0 && (
                  <span className="pb-2">
                    <button type="button" className={s.cGhost} aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
                      Archived <span className="num font-mono text-xs text-ink-3">[{archived.length}]</span>
                    </button>
                  </span>
                )}
                <CourseMenu
                  course={course}
                  lastActive={active.length <= 1}
                  onEdit={() => setDialog({ kind: "edit", course })}
                  onArchive={(on) => archive(course, on)}
                  onDelete={() => removeCourse(course)}
                />
              </div>
            </div>
            <section id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(course.id)} className="sheet relative">
              <div className="ear bg-line-2 p-px">
                <div className="ear relative bg-sheet pb-8 pl-12 pr-4 pt-7 sm:pl-[76px] sm:pr-8">
                  {/* The red margin line of ruled paper. */}
                  <span aria-hidden="true" className="absolute bottom-0 left-[34px] top-0 w-px bg-margin sm:left-[54px]" />
                  <DropZone courseName={course.name} onAccept={(files) => accept(files)} />
                  {course.archived && (
                    <div role="status" className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-[5px] bg-sheet-2 px-4 py-3 text-sm text-ink-2">
                      <span>
                        <strong className="font-semibold text-ink">Archived.</strong> {courseLabel(course)} is hidden from Ask and the course tabs. Its PDFs are kept.
                      </span>
                      <button type="button" className={s.cGhost} onClick={() => archive(course, false)}>Unarchive</button>
                    </div>
                  )}
                  <div aria-live="polite">
                    {nudge && (
                      <div className={s.nudge}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                        <span className="min-w-0 flex-[1_1_260px] text-[15px]">
                          <strong className="font-semibold">{nudge.name} is ready.</strong>{" "}
                          <span className="num text-ink-2">
                            {nudge.documents.length} PDF{nudge.documents.length === 1 ? "" : "s"} · {nudge.documents.reduce((n, d) => n + (d.passages ?? 0), 0)} passages to ask about.
                          </span>
                        </span>
                        <Link
                          href={`/ask?course=${encodeURIComponent(nudge.id)}`}
                          onClick={() => dismissNudge(nudge.id)}
                          className="btn btn-red box-border inline-flex min-h-10 items-center rounded-[5px] px-3.5 py-2 text-sm font-medium"
                        >
                          Ask about {nudge.name} →
                        </Link>
                        <button type="button" className={s.nudgeX} aria-label="Dismiss" onClick={() => dismissNudge(nudge.id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {course.documents.length > 0 ? (
                    <DocumentLedger
                      docs={course.documents}
                      menu={menu}
                      undo={courseUndo}
                      setMenu={setMenu}
                      onDelete={remove}
                      onUndo={restore}
                      onNavigate={navigate}
                      onRunOcr={ocr}
                      courseId={course.id}
                    />
                  ) : (
                    <>
                      {/* Deleting the last document lands here, so Undo must still be reachable. */}
                      <div className="mt-[26px]">
                        <UndoBar undo={courseUndo} onUndo={restore} />
                      </div>
                      <EmptyCourse courseName={course.name} />
                    </>
                  )}
                </div>
              </div>
              <span className="fold" aria-hidden="true" />
            </section>
          </>
        ) : (
          <p aria-busy="true" className="mt-10 text-sm text-ink-2">Loading your courses…</p>
        )}
      </main>
      {dialog && (
        <CourseDialog
          key={dialog.kind === "edit" ? dialog.course.id : "new"}
          mode={dialog}
          courses={all}
          onCreate={create}
          onSave={save}
          onClosed={() => setDialog(null)}
        />
      )}
      <LeaveGuard open={guardOpen} uploads={inFlight} href={leaveHref ?? "/ask"} onStay={stay} onLeave={leave} />
    </>
  );
}
