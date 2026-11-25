"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { REAL_ASK, listCourses, type Course } from "@/lib/api";
import { CreditLine } from "@/components/CreditLine";
import { DocumentLedger } from "./DocumentLedger";

/**
 * The Library: the documents behind the demo, read-only.
 *
 * Since 2026-11-25 Recall's public demo is Algorithms only (Jeff Erickson's
 * book, 4 chapters, CC BY 4.0): no uploads, no courses of your own. A note in
 * the sheet says so and links to "About this demo" on the landing page, which
 * explains why. See recall-algorithms-only-checklist.md.
 */
export function LibraryScreen() {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCourses()
      .then((cs) => {
        // The demo's course is the (only) sample course.
        if (alive) setCourse(cs.find((c) => c.sample) ?? cs[0] ?? null);
      })
      .catch(() => alive && setCourse(null));
    return () => {
      alive = false;
    };
  }, []);

  // Outside click and Escape close a row's menu.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-menu-root]")) return;
      setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  return (
    <main id="main" className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 pb-[88px] pt-14">
      <h1 className="m-0 text-[54px] font-normal leading-[1.04] tracking-[-0.036em]">Library</h1>
      <p className="mt-3 max-w-[36em] text-[17px] leading-relaxed text-ink-2">
        The course behind this demo, split into passages Recall can search and cite.
      </p>
      {REAL_ASK && <CreditLine className="mt-1.5" />}

      {course === undefined ? (
        <p aria-busy="true" className="mt-10 text-sm text-ink-2">Loading the course…</p>
      ) : course === null ? (
        <p role="alert" className="mt-10 text-sm text-ink-2">Couldn’t load the course. Refresh to try again.</p>
      ) : (
        <section aria-labelledby="course-h" className="sheet relative mt-10">
          <div className="ear bg-line-2 p-px">
            <div className="ear relative bg-sheet pb-8 pl-12 pr-4 pt-7 sm:pl-[76px] sm:pr-8">
              {/* The red margin line of ruled paper. */}
              <span aria-hidden="true" className="absolute bottom-0 left-[34px] top-0 w-px bg-margin sm:left-[54px]" />
              <h2 id="course-h" className="m-0 text-[26px] font-normal tracking-[-0.02em]">
                {course.name}
              </h2>
              <p className="m-0 mt-1 text-sm text-ink-2">The demo’s one course, shared by every visitor and read-only.</p>
              {/* Where the drop zone used to be: say plainly why there isn't one. */}
              <div className="mt-5 rounded-[5px] border border-dashed border-line-2 bg-sheet-2 px-5 py-4 text-[15px] leading-relaxed">
                <p className="m-0">
                  <strong className="font-semibold">Uploading your own PDFs isn’t part of this demo.</strong>{" "}
                  <span className="text-ink-2">
                    These chapters were loaded with Recall’s ingest pipeline, and every answer is measured against them on Dyno.
                  </span>
                </p>
                <p className="m-0 mt-2 text-sm">
                  <Link href="/#about-this-demo" className="lnk lnk-hl text-ink">
                    Why, and what this demo covers →
                  </Link>
                </p>
              </div>
              <DocumentLedger
                docs={course.documents}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                onNavigate={(href) => router.push(href)}
                courseId={course.id}
              />
            </div>
          </div>
          <span className="fold" aria-hidden="true" />
        </section>
      )}
    </main>
  );
}
