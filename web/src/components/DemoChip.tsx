"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { endDemoSession, getDemoSession, type DemoSession } from "@/lib/api";

/**
 * "● Demo · kept 24 h" chip in the app nav. Opens a popover with the session
 * details and a guarded "Start fresh" that deletes the session.
 */
export function DemoChip() {
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDemoSession().then(setSession).catch(() => setSession(null));
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    // Escape closes it from anywhere, even after focus moved (e.g. the confirm step).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  const startFresh = async () => {
    await endDemoSession();
    close();
    router.push("/demo");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="demo-chip"
        aria-expanded={open}
        aria-controls="demo-pop"
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
      >
        <span className="demo-dot" aria-hidden="true" />
        Demo · kept 24&nbsp;h
        <svg className="demo-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div id="demo-pop" role="dialog" aria-labelledby="demo-pop-h" aria-hidden={!open} inert={!open} className={`pop pop-down ${open ? "open" : ""}`}>
        <div className="pop-card">
          <p id="demo-pop-h" className="m-0 text-[15px] font-semibold">Your demo session</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
            Your chats and uploads are saved for 24 hours after your last visit. Nobody else can see them.
          </p>
          <dl className="num mt-3.5 grid grid-cols-[74px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 border-t border-dashed border-line-2 pt-3 text-[13px]">
            <dt className="text-ink-3">Session</dt>
            <dd className="m-0 font-mono" translate="no">{session?.id ?? "Not started"}</dd>
            <dt className="text-ink-3">Courses</dt>
            <dd className="m-0">3 sample courses + your uploads</dd>
            <dt className="text-ink-3">Expires</dt>
            <dd className="m-0">24 h after your last visit</dd>
          </dl>
          {!confirming ? (
            <div className="mt-4 flex justify-between gap-2">
              <button type="button" className="ghost-sm" onClick={() => setConfirming(true)}>
                Start fresh
              </button>
              <button type="button" className="ghost-sm text-ink" onClick={close}>
                Done
              </button>
            </div>
          ) : (
            <div role="group" aria-label="Confirm starting fresh" className="mt-4 rounded bg-[#fbefea] p-3 shadow-[0_0_0_1px_rgba(200,37,14,0.45)]">
              <p className="m-0 text-[13px] leading-normal">Start fresh? This deletes the chats and uploads in this session.</p>
              <div className="mt-2.5 flex gap-2">
                <button type="button" autoFocus className="btn btn-red rounded px-3 py-[7px] text-[13px] font-medium" onClick={startFresh}>
                  Delete and restart
                </button>
                <button type="button" className="ghost-sm" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
