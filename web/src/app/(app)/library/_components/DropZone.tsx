"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { dragVerdict, splitFiles } from "@/lib/files";
import { RejectionSlip, type Rejection } from "./RejectionSlip";
import s from "../library.module.css";

const INPUT_ID = "upload";

/**
 * The drop zone is a <label> for the hidden file input, so the whole card is
 * clickable and keyboard users get the native file picker. Drag-over shows a
 * verdict before the drop (only MIME types are readable mid-drag), and a drop
 * with non-PDFs shakes the card and opens the rejection slip below it.
 */
export function DropZone({ courseName, onAccept }: { courseName: string; onAccept: (files: File[]) => void }) {
  const [drag, setDrag] = useState<"ok" | "bad" | null>(null);
  const [shake, setShake] = useState(0);
  // The slip keeps its last content after closing so the collapse animates with text in it.
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [slipOpen, setSlipOpen] = useState(false);
  // dragenter/dragleave fire for every child element; count depth so the state doesn't flicker.
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    setDrag(null);
    if (!files.length) return;
    const { accepted, rejected } = splitFiles(files);
    if (accepted.length) onAccept(accepted);
    if (rejected.length) {
      setRejection({ files: rejected.map((r) => ({ name: r.file.name, kind: r.kind })), added: accepted.length });
      setSlipOpen(true);
      setShake((n) => n + 1);
    } else {
      setSlipOpen(false);
    }
  };

  // "U" opens the file picker (the keycap on the button), unless the user is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "u" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      input.current?.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    depth.current++;
    setDrag(dragVerdict(Array.from(e.dataTransfer.items)));
  };
  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (!depth.current) setDrag(null);
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    depth.current = 0;
    take(e.dataTransfer.files);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    take(e.target.files);
    e.target.value = ""; // so choosing the same file again still fires change
  };

  const cls = [
    s.drop,
    drag === "ok" ? s.dragOk : drag === "bad" ? s.dragBad : "",
    shake ? (shake % 2 ? s.shakeA : s.shakeB) : "",
  ].join(" ");

  return (
    <>
      <label
        htmlFor={INPUT_ID}
        className={`${cls} relative flex cursor-pointer flex-wrap items-center justify-between gap-5 rounded-md px-6 py-[22px]`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <span className="flex items-center gap-[18px]">
          <span aria-hidden="true" className="relative h-12 w-[38px] flex-none">
            <span className="ear box-border block h-full w-full bg-line-2 p-px">
              <span className="ear flex h-full w-full items-center justify-center bg-sheet text-red">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17V7" />
                  <path d="M8 11l4-4 4 4" />
                </svg>
              </span>
            </span>
            <span className="fold" />
          </span>
          <span>
            <span aria-live="polite" className={`block text-[17px] font-medium ${drag === "bad" ? "text-bad" : "text-ink"}`}>
              {drag === "ok" ? `Release to add to ${courseName}` : drag === "bad" ? "PDFs only" : `Drop lecture PDFs into ${courseName}`}
            </span>
            <span className="mt-1 block text-sm text-ink-2">
              {drag === "bad"
                ? "Recall reads text from PDFs. Export this file as a PDF first."
                : "PDFs with selectable text, up to [MAX SIZE] each. Scans need OCR first."}
            </span>
          </span>
        </span>
        <span className="btn btn-red inline-flex items-center gap-2.5 rounded-[5px] py-[9px] pl-4 pr-[9px] text-[15px] font-medium">
          Choose files <kbd className="kbd">U</kbd>
        </span>
        <input
          ref={input}
          id={INPUT_ID}
          name="documents"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          aria-label={`Upload PDFs to ${courseName}`}
          onChange={onPick}
          className={s.fileInput}
        />
      </label>
      <RejectionSlip rejection={rejection} open={slipOpen} inputId={INPUT_ID} onDismiss={() => setSlipOpen(false)} />
    </>
  );
}
