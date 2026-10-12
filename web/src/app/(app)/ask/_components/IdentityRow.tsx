"use client";

import { useEffect, useRef, useState } from "react";
import { getDemoSession } from "@/lib/api";
import type { Settings } from "./settings";
import s from "../ask.module.css";

/** "Demo visitor" + session id, and the Settings gear with its upward popover. */
export function IdentityRow({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [sid, setSid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gear = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    getDemoSession()
      .then((d) => {
        if (live) setSid(d?.id ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Outside click and Escape close it; Escape hands focus back to the gear if it was inside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) gear.current?.focus();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = sid ?? "demo-…";
  // Badge = the first two characters after "demo-".
  const badge = sid ? sid.replace(/^demo-/, "").slice(0, 2) : "DE";
  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch });

  return (
    <div ref={root} className="relative flex items-center gap-2.5 border-t border-line px-1 pt-2.5">
      <div
        id="settings-pop"
        role="dialog"
        aria-labelledby="set-h"
        aria-hidden={!open}
        inert={!open}
        className={`pop pop-up ${s.setPop} ${open ? "open" : ""}`}
      >
        <div className={`pop-card ${s.setCard}`}>
          <div className="-mr-1.5 -mt-1 mb-1 flex items-center justify-between">
            <p id="set-h" className="m-0 text-[15px] font-semibold">Settings</p>
            {/* A visible way out for everyone: clicking outside isn't obvious, and keyboard users can't. */}
            <button
              type="button"
              className={s.setX}
              aria-label="Close settings"
              onClick={() => {
                setOpen(false);
                gear.current?.focus();
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className={s.setRow}>
            <span>
              <span className="block text-sm">Answer length</span>
              <span className="mt-0.5 block text-xs text-ink-2">Short gets to the point. Detailed walks through it.</span>
            </span>
            <span role="radiogroup" aria-label="Answer length" className={s.seg}>
              {(["short", "detailed"] as const).map((len) => (
                <button
                  key={len}
                  type="button"
                  role="radio"
                  aria-checked={settings.length === len}
                  className={s.segB}
                  onClick={() => set({ length: len })}
                >
                  {len === "short" ? "Short" : "Detailed"}
                </button>
              ))}
            </span>
          </div>

          <Toggle id="set-strict" label="Only answer from my notes" hint="Say “not in your notes” instead of guessing." on={settings.strict} onChange={(v) => set({ strict: v })} />
          <Toggle id="set-timing" label="Show retrieval timing" hint="The embed, search, rerank, generate bar." on={settings.timing} onChange={(v) => set({ timing: v })} />
          <Toggle id="set-motion" label="Reduce motion" hint="Turns off animations. Follows your system by default." on={settings.calm} onChange={(v) => set({ calm: v })} />
        </div>
      </div>

      <span aria-hidden="true" className={s.badge}>
        {badge}
        <span className={s.badgeDot} />
      </span>
      <span className="min-w-0 flex-auto leading-[1.3]">
        <span className="block text-sm font-medium">Demo visitor</span>
        <span translate="no" className="block truncate font-mono text-xs text-ink-2">{shown}</span>
      </span>
      <button
        ref={gear}
        type="button"
        className={`${s.iconBtn} ${s.setBtn}`}
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
        aria-controls="settings-pop"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

function Toggle({ id, label, hint, on, onChange }: { id: string; label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={s.setRow}>
      <span>
        <span id={id} className="block text-sm">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-2">{hint}</span>
      </span>
      <button type="button" role="switch" aria-labelledby={id} aria-checked={on} className={s.sw} onClick={() => onChange(!on)}>
        <span className={s.swK} />
      </button>
    </div>
  );
}
