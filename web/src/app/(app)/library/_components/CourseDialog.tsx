"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Course, CourseColor, CourseInput } from "@/lib/api";
import { CODE_MAX, COURSE_COLORS, COURSE_LIMIT, FILES_PER_BATCH, NAME_MAX, TERMS, cleanCode, cleanName, courseNameError } from "@/lib/courses";
import { isPdf } from "@/lib/files";
import s from "../library.module.css";

export type DialogMode = { kind: "new" } | { kind: "edit"; course: Course };

/** How long the exit animation runs before the dialog is removed. */
const EXIT_MS = 160;

/**
 * "New course" / "Edit course", built on the native <dialog> element.
 * showModal() gives us a real modal for free: the page behind is inert (no clicks,
 * no Tab, hidden from screen readers), Escape fires "cancel", and focus returns to
 * the button that opened it. We add the scroll lock, the open/close motion, and
 * the "Discard?" check when you'd lose what you typed.
 */
export function CourseDialog({
  mode,
  courses,
  onCreate,
  onSave,
  onClosed,
}: {
  mode: DialogMode;
  /** Every course, archived included (for the duplicate check and the limit). */
  courses: Course[];
  onCreate: (input: CourseInput, files: File[]) => Promise<void>;
  onSave: (id: string, input: CourseInput) => Promise<void>;
  /** Called after the exit animation, when the dialog is gone. */
  onClosed: () => void;
}) {
  const editing = mode.kind === "edit" ? mode.course : null;
  const atLimit = !editing && courses.length >= COURSE_LIMIT;
  const ids = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);

  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [term, setTerm] = useState(editing?.term ?? "");
  // New courses get the next colour in the palette, so tabs stay easy to tell apart.
  const [color, setColor] = useState<CourseColor>(editing?.color ?? COURSE_COLORS[courses.length % COURSE_COLORS.length][0]);
  const [files, setFiles] = useState<File[]>([]);
  const [skipped, setSkipped] = useState("");
  const [drag, setDrag] = useState(false);
  const [tried, setTried] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [closing, setClosing] = useState(false);

  // Open as a modal on mount, and lock the page's scroll while open.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // showModal() focuses the first focusable element (the ×), so move focus to the field we want.
    d?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const root = document.documentElement;
    const sw = window.innerWidth - root.clientWidth; // keep the layout from jumping when the scrollbar hides
    root.style.overflow = "hidden";
    if (sw > 0) root.style.paddingRight = `${sw}px`;
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Play the exit animation, then close for real. */
  const finish = () => {
    if (closing) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const done = () => {
      dialog.current?.close();
      onClosed();
    };
    if (reduce) return done();
    setClosing(true);
    timer.current = setTimeout(done, EXIT_MS);
  };

  const others = courses.filter((c) => c.id !== editing?.id).map((c) => c.name);
  const nameError = courseNameError(name, others);
  const showError = tried || (name.trim() !== "" && nameError !== null && nameError.startsWith("You already"));
  const dirty = editing
    ? cleanName(name) !== editing.name || cleanCode(code) !== (editing.code ?? "") || term !== (editing.term ?? "") || color !== editing.color
    : cleanName(name) !== "" || code.trim() !== "" || files.length > 0;

  /** Every way out (×, Cancel, Escape, backdrop) asks first if you'd lose something. */
  const tryClose = () => {
    if (pending) return;
    if (dirty && !discarding && !atLimit) setDiscarding(true);
    else finish();
  };

  const addFiles = (list: FileList | null) => {
    const all = Array.from(list ?? []);
    const pdfs = all.filter((f) => isPdf(f.name, f.type));
    const have = new Set(files.map((f) => f.name));
    const fresh = pdfs.filter((f) => !have.has(f.name));
    const room = Math.max(0, FILES_PER_BATCH - files.length);
    const notes: string[] = [];
    const nonPdf = all.length - pdfs.length;
    const dupes = pdfs.length - fresh.length;
    if (nonPdf) notes.push(`Skipped ${nonPdf} non-PDF file${nonPdf === 1 ? "" : "s"}.`);
    if (dupes) notes.push(`Skipped ${dupes} duplicate${dupes === 1 ? "" : "s"}.`);
    if (fresh.length > room) notes.push(`Up to ${FILES_PER_BATCH} PDFs at once. Add the rest after.`);
    setFiles((f) => [...f, ...fresh.slice(0, room)]);
    setSkipped(notes.join(" "));
    setDiscarding(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return; // a double-click must not create two courses
    if (nameError) {
      setTried(true);
      dialog.current?.querySelector<HTMLInputElement>(`#${CSS.escape(ids)}-name`)?.focus();
      return;
    }
    const input: CourseInput = { name: cleanName(name), code: cleanCode(code) || undefined, term: term || undefined, color };
    setPending(true);
    setServerError("");
    try {
      if (editing) await onSave(editing.id, input);
      else await onCreate(input, files);
      finish();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPending(false);
    }
  };

  // Radio groups move with arrow keys, like native radio buttons.
  const onColorKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = COURSE_COLORS.findIndex((c) => c[0] === color);
    const next = COURSE_COLORS[(i + step + COURSE_COLORS.length) % COURSE_COLORS.length][0];
    setColor(next);
    setDiscarding(false);
    requestAnimationFrame(() => e.currentTarget.querySelector<HTMLElement>(`[data-color="${next}"]`)?.focus());
  };

  const heading = atLimit ? "Course limit reached" : editing ? "Edit course" : "New course";
  const total = courses.length + (editing ? 0 : 1);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${ids}-h`}
      aria-describedby={`${ids}-d`}
      className={`${s.dlg} ${closing ? s.dlgOut : ""}`}
      onCancel={(e) => {
        // Escape: run our own close so "Discard?" and the exit animation still happen.
        e.preventDefault();
        tryClose();
      }}
      // Clicking the dark backdrop closes it. (Only when the press also started there,
      // so selecting text in a field and releasing outside doesn't close it.)
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === dialog.current;
      }}
      onClick={(e) => {
        if (e.target === dialog.current && downOnBackdrop.current) tryClose();
      }}
    >
      <div className={s.dlgCard}>
        <div className="-mr-2 -mt-1 flex items-start justify-between gap-3">
          <h2 id={`${ids}-h`} className="m-0 text-[22px] font-medium tracking-[-0.015em]">{heading}</h2>
          <button type="button" className={s.dlgX} aria-label="Close" onClick={tryClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {atLimit ? (
          <>
            <p id={`${ids}-d`} className="mt-2 text-[15px] leading-relaxed text-ink-2">
              You have {COURSE_LIMIT} courses, the most a demo can hold. Delete a course you don’t need to make room for a new one.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" data-autofocus="" className="btn btn-ghost min-h-11 rounded-[5px] bg-paper! px-4 py-[9px] text-sm" onClick={finish}>
                Got it
              </button>
            </div>
          </>
        ) : (
          <>
            <p id={`${ids}-d`} className="mt-1.5 text-sm leading-normal text-ink-2">
              {editing
                ? "Changes show everywhere this course appears. Its PDFs and chats stay as they are."
                : "A course keeps its own PDFs and chats. Recall only answers from the course you’re in."}
            </p>
            <form onSubmit={submit} noValidate className="mt-[18px] flex flex-col gap-4">
              <div>
                <label htmlFor={`${ids}-name`} className={s.dlgLabel}>Course name</label>
                <input
                  id={`${ids}-name`}
                  className={s.dlgIn}
                  type="text"
                  autoComplete="off"
                  data-autofocus=""
                  maxLength={NAME_MAX}
                  placeholder="e.g. Data Structures"
                  value={name}
                  aria-invalid={showError && !!nameError}
                  aria-describedby={`${ids}-name-h`}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDiscarding(false);
                  }}
                />
                <p id={`${ids}-name-h`} className={`${s.dlgHint} num`}>
                  <span className={showError && nameError ? s.dlgErr : ""}>{showError && nameError ? nameError : "Shows in the course tabs and in Ask."}</span>
                  <span>{name.length}/{NAME_MAX}</span>
                </p>
              </div>

              <div>
                <label htmlFor={`${ids}-code`} className={s.dlgLabel}>
                  <span>Course code</span>
                  <span className={s.dlgOpt}>Optional</span>
                </label>
                <input
                  id={`${ids}-code`}
                  className={`${s.dlgIn} font-mono uppercase`}
                  type="text"
                  autoComplete="off"
                  maxLength={CODE_MAX}
                  placeholder="e.g. CP213"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setDiscarding(false);
                  }}
                />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 max-[460px]:grid-cols-1">
                <div>
                  <label htmlFor={`${ids}-term`} className={s.dlgLabel}>
                    <span>Term</span>
                    <span className={s.dlgOpt}>Optional</span>
                  </label>
                  <select
                    id={`${ids}-term`}
                    className={`${s.dlgIn} text-[15px]`}
                    value={term}
                    onChange={(e) => {
                      setTerm(e.target.value);
                      setDiscarding(false);
                    }}
                  >
                    {TERMS.map((t) => (
                      <option key={t} value={t}>{t || "No term"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span id={`${ids}-col`} className={s.dlgLabel}>Colour</span>
                  <div role="radiogroup" aria-labelledby={`${ids}-col`} onKeyDown={onColorKey} className="mt-3 flex gap-2">
                    {COURSE_COLORS.map(([id, label, hex]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        data-color={id}
                        aria-checked={color === id}
                        aria-label={label}
                        tabIndex={color === id ? 0 : -1}
                        className={s.swatch}
                        style={{ background: hex }}
                        onClick={() => {
                          setColor(id);
                          setDiscarding(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!editing && (
                <div>
                  <span className={s.dlgLabel}>
                    <span id={`${ids}-pdfs`}>Lecture PDFs</span>
                    <span className={s.dlgOpt}>Optional, add more any time</span>
                  </span>
                  <label
                    htmlFor={`${ids}-files`}
                    className={`${s.dlgDrop} ${drag ? s.dlgDropOn : ""}`}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      addFiles(e.dataTransfer.files);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V4" />
                      <path d="M7 9l5-5 5 5" />
                      <path d="M5 20h14" />
                    </svg>
                    <span>
                      <span className="font-medium text-ink">Drop PDFs here</span> or choose files
                    </span>
                    <input
                      id={`${ids}-files`}
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      aria-labelledby={`${ids}-pdfs`}
                      className="sr-only"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {files.length > 0 && (
                    <ul aria-label="PDFs to add" className="m-0 mt-2 list-none p-0">
                      {files.map((f) => (
                        <li key={f.name} className={s.dlgFile}>
                          <span translate="no" className="min-w-0 flex-auto truncate font-mono">{f.name}</span>
                          <button
                            type="button"
                            className={s.dlgRm}
                            aria-label={`Remove ${f.name}`}
                            onClick={() => setFiles((fs) => fs.filter((x) => x.name !== f.name))}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div aria-live="polite">{skipped && <p className="m-0 mt-2 text-[13px] text-bad">{skipped}</p>}</div>
                </div>
              )}

              {discarding && (
                <div role="group" aria-label="Discard changes?" className={s.dlgDiscard}>
                  <p className="m-0 text-sm">
                    {editing ? "Discard your changes?" : "Discard this course? What you typed and the PDFs you picked will be lost."}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" autoFocus className="btn btn-red min-h-9 rounded border-0 px-3 py-[7px] text-[13px] font-medium" onClick={finish}>
                      Discard
                    </button>
                    <button type="button" className="btn btn-ghost min-h-9 rounded px-3 py-[7px] text-[13px]" onClick={() => setDiscarding(false)}>
                      Keep editing
                    </button>
                  </div>
                </div>
              )}

              <div aria-live="assertive">{serverError && <p className="m-0 text-sm font-medium text-bad">{serverError}</p>}</div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
                <span className="num text-[13px] text-ink-2">{editing ? "" : `${total} of ${COURSE_LIMIT} courses`}</span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-ghost min-h-11 rounded-[5px] bg-paper! px-4 py-[9px] text-sm" onClick={tryClose}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    aria-disabled={pending || (tried && !!nameError)}
                    className={`btn btn-red min-h-11 rounded-[5px] border-0 px-4 py-[9px] text-sm font-medium ${s.dlgCreate}`}
                  >
                    {pending ? "Saving…" : editing ? "Save changes" : files.length ? `Create and add ${files.length} PDF${files.length === 1 ? "" : "s"}` : "Create course"}
                  </button>
                </span>
              </div>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
