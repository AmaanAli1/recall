"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useFloating } from "@/lib/use-floating";
import s from "../ask.module.css";

/**
 * A chat's "…" menu: Rename, Pin to top / Unpin, Delete.
 * It renders in a portal (on <body>) so the scrolling chat list can't clip it, and
 * opens upward when there's no room below the button.
 */
export function ChatMenu({
  title,
  pinned,
  anchor,
  onClose,
  onRename,
  onTogglePin,
  onDelete,
}: {
  title: string;
  pinned: boolean;
  anchor: () => HTMLElement | null | undefined;
  onClose: (refocus: boolean) => void;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const pos = useFloating(anchor, menu, true, undefined, 2);

  // Focus the first item when the menu opens (ARIA menu pattern).
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, []);

  // A click anywhere else closes it (the "…" button toggles it itself).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || anchor()?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(true);
      return;
    }
    if (e.key === "Tab") {
      onClose(false);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={`Options for ${title}`}
      onKeyDown={onKey}
      className={`${s.chatMenu} ${pos.up ? s.chatMenuUp : ""}`}
      style={pos.style}
    >
      <button type="button" role="menuitem" tabIndex={-1} className={s.cmItem} onClick={onRename}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
        Rename
      </button>
      <button type="button" role="menuitem" tabIndex={-1} className={s.cmItem} onClick={onTogglePin}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-5-5 5-1-1 5-5-5-4 2-2 5 1 4-4z" />
        </svg>
        {pinned ? "Unpin" : "Pin to top"}
      </button>
      <button type="button" role="menuitem" tabIndex={-1} className={`${s.cmItem} ${s.cmDanger}`} onClick={onDelete}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
          <path d="M9 7V4h6v3" />
        </svg>
        Delete
      </button>
    </div>,
    document.body,
  );
}
