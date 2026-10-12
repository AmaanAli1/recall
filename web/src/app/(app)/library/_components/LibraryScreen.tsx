"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDocument, listCourses, uploadDocument, type Course, type CourseDocument } from "@/lib/api";
import { CourseTabs, PANEL_ID, tabId } from "./CourseTabs";
import { DocumentLedger, UndoBar, type MenuState, type UndoState } from "./DocumentLedger";
import { DropZone } from "./DropZone";
import { EmptyCourse } from "./EmptyCourse";
import { LeaveGuard, type InFlight } from "./LeaveGuard";

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
  const uploadSeq = useRef(0);
  // The link that triggered the guard, so "Stay" can hand focus back to it.
  const guardOpener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    listCourses().then((cs) => {
      if (!alive) return;
      setCourses(cs);
      setCurrent((c) => c ?? cs[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const course = courses?.find((c) => c.id === current) ?? null;
  const inFlight: InFlight[] = (courses ?? []).flatMap((c) => c.documents.filter(isInFlight).map((d) => ({ name: d.name, pct: d.progress ?? 0 })));
  const uploading = inFlight.length > 0;
  // The dialog closes itself once every upload has finished.
  const guardOpen = leaveHref !== null && uploading;
  const courseUndo = undo && course && undo.courseId === course.id ? undo : null;

  // ---------- uploads ----------
  const accept = (files: File[]) => {
    if (!course) return;
    const courseId = course.id;
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
          {/* TODO: "New course" needs a create-course flow and API (POST /courses). */}
          <button type="button" className="btn btn-ghost inline-flex min-h-11 items-center gap-2 rounded-[5px] px-3.5 py-[9px] text-sm font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            New course
          </button>
        </div>

        {courses && course ? (
          <>
            <CourseTabs courses={courses} current={course.id} onPick={pick} />
            <section id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(course.id)} className="sheet relative">
              <div className="ear bg-line-2 p-px">
                <div className="ear relative bg-sheet pb-8 pl-12 pr-4 pt-7 sm:pl-[76px] sm:pr-8">
                  {/* The red margin line of ruled paper. */}
                  <span aria-hidden="true" className="absolute bottom-0 left-[34px] top-0 w-px bg-margin sm:left-[54px]" />
                  <DropZone courseName={course.name} onAccept={accept} />
                  {course.documents.length > 0 ? (
                    <DocumentLedger
                      docs={course.documents}
                      menu={menu}
                      undo={courseUndo}
                      setMenu={setMenu}
                      onDelete={remove}
                      onUndo={restore}
                      onNavigate={navigate}
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
      <LeaveGuard open={guardOpen} uploads={inFlight} href={leaveHref ?? "/ask"} onStay={stay} onLeave={leave} />
    </>
  );
}
