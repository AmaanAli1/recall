"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import s from "../library.module.css";

export interface InFlight {
  name: string;
  pct: number;
}

/**
 * "Uploads still in progress" alertdialog shown when a link would leave the
 * page mid-upload. Stay is the safe default: it gets focus, and Escape or a
 * click on the scrim also means stay.
 */
export function LeaveGuard({ open, uploads, href, onStay, onLeave }: { open: boolean; uploads: InFlight[]; href: string; onStay: () => void; onLeave: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Wait a frame-ish so the card is visible (visibility flips on open) before focusing.
    const t = setTimeout(() => stay.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const n = uploads.length;
  const avg = n ? Math.round(uploads.reduce((sum, u) => sum + u.pct, 0) / n) : 100;
  const title = n === 1 ? "1 upload is still in progress" : `${n} uploads are still in progress`;
  const body =
    (n === 1 ? `${uploads[0].name} is ${Math.round(uploads[0].pct)}% embedded.` : `They’re ${avg}% done on average.`) +
    ` If you leave now, it stops and you’ll need to drop ${n === 1 ? "it" : "them"} again. Everything else is already saved.`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onStay();
      return;
    }
    // Keep Tab inside the dialog while it's modal.
    if (e.key === "Tab") {
      const focusables = Array.from(card.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const leave = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab clicks through
    e.preventDefault();
    onLeave();
  };

  return (
    <div className={`${s.guard} ${open ? s.open : ""}`} aria-hidden={!open} inert={!open} onKeyDown={onKeyDown}>
      <div className={s.guardScrim} onClick={onStay} />
      <div ref={card} role="alertdialog" aria-modal="true" aria-labelledby="guard-h" aria-describedby="guard-d" className={s.guardCard}>
        <div className="flex gap-3.5">
          <span aria-hidden="true" className="relative h-[34px] w-[34px] flex-none">
            <svg width="34" height="34" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--sheet-2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${avg} 100`} transform="rotate(-90 18 18)" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="guard-h" className="mt-0.5 text-[17px] font-semibold">{title}</h2>
            <p id="guard-d" className="mt-1.5 text-sm leading-[1.55] text-ink-2">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {/* data-guard-ok: the page's link interceptor lets this one through. */}
          <a
            href={href}
            data-guard-ok=""
            onClick={leave}
            className={`btn ${s.guardLeave} box-border inline-flex min-h-10 items-center rounded-[5px] border border-line-2 px-3.5 py-[9px] text-sm text-ink-2`}
          >
            Leave anyway
          </a>
          <button ref={stay} type="button" onClick={onStay} className="btn btn-red min-h-10 rounded-[5px] border-0 px-4 py-[9px] text-sm font-medium">
            Stay until it finishes
          </button>
        </div>
      </div>
    </div>
  );
}
