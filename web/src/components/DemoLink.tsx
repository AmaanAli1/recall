"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { DEMO_STANDBY, STANDBY_PARAM } from "@/lib/demo-standby";
import s from "./standby.module.css";

/*
 * While the RAG pipeline is being connected to the live site, "Try the demo"
 * opens a "please stand by" dialog instead of starting a session
 * (NEXT_PUBLIC_DEMO_STANDBY, see lib/demo-standby.ts). The server side of the
 * same rule is in proxy.ts: the demo pages redirect home with ?standby=1.
 */

const REPO = "https://github.com/AmaanAli1/recall";

/**
 * A "Try the demo" link. With standby off it's a plain link; with standby on
 * it's a button that opens the dialog (a button, because it no longer goes anywhere).
 */
export function DemoLink({
  href = "/demo",
  className,
  children,
  standby = DEMO_STANDBY,
  "aria-label": ariaLabel,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  standby?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  if (!standby) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  const close = () => {
    setOpen(false);
    // Put focus back where the visitor was, so keyboard users don't lose their place.
    trigger.current?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={`${className ?? ""} cursor-pointer border-0 text-left font-[inherit]`}
      >
        {children}
      </button>
      <StandbyDialog open={open} onClose={close} />
    </>
  );
}

/**
 * On the landing page: if the visitor was sent here from a demo page
 * (?standby=1, added by proxy.ts), open the dialog straight away to say why.
 */
export function StandbyOnArrival({ standby = DEMO_STANDBY }: { standby?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!standby) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(STANDBY_PARAM)) return;
    // Tidy the address bar, so a refresh or a shared link doesn't reopen it.
    url.searchParams.delete(STANDBY_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // Reading the URL is only possible after the page loads, hence an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [standby]);

  if (!standby) return null;
  return <StandbyDialog open={open} onClose={() => setOpen(false)} />;
}

/** The dialog itself. "Got it" is the default: it gets focus; Escape or a click outside also closes. */
export function StandbyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  // Every "Try the demo" on the page has its own dialog, so ids must be unique.
  const id = useId();

  useEffect(() => {
    if (!open) return;
    // The card turns visible on open; focus it a moment later.
    const t = setTimeout(() => ok.current?.focus(), 30);
    // No scrolling the page behind an open dialog.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    // Keep Tab inside the dialog while it's open.
    if (e.key === "Tab") {
      const items = Array.from(card.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className={`${s.wrap} ${open ? s.open : ""}`} aria-hidden={!open} inert={!open} onKeyDown={onKeyDown}>
      <div className={s.scrim} onClick={onClose} />
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} aria-describedby={`${id}-d`} className={s.card}>
        <p className="m-0 flex items-center gap-2 font-mono text-xs text-ink-2">
          <span aria-hidden="true" className={s.dot} />
          status · in development
        </p>
        <h2 id={`${id}-h`} className="mb-0 mt-3 text-[19px] font-semibold">
          RAG in development, please stand by
        </h2>
        <div id={`${id}-d`} className="mt-2 text-[15px] leading-[1.6] text-ink-2">
          <p className="m-0">
            The live demo is paused while the retrieval pipeline is connected to the site. Real answers, written from course PDFs and cited to
            the page, are coming soon.
          </p>
          <p className="mb-0 mt-2.5">Meanwhile, see how it works or read the code.</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <a href={REPO} className={`btn ${s.ghost} box-border inline-flex min-h-10 items-center rounded-[5px] border border-line-2 px-3.5 py-[9px] text-sm text-ink-2`}>
            View the code
          </a>
          <Link
            href="/#pipeline"
            onClick={onClose}
            className={`btn ${s.ghost} box-border inline-flex min-h-10 items-center rounded-[5px] border border-line-2 px-3.5 py-[9px] text-sm text-ink-2`}
          >
            See how it works
          </Link>
          <button ref={ok} type="button" onClick={onClose} className="btn btn-red min-h-10 rounded-[5px] border-0 px-4 py-[9px] text-sm font-medium">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
