"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export interface FloatingPos {
  style: CSSProperties;
  /** True when it opened upward because there wasn't room below. */
  up: boolean;
}

const HIDDEN: FloatingPos = { style: { position: "fixed", top: 0, left: 0, visibility: "hidden" }, up: false };

/**
 * Places a floating menu next to its trigger button, the way Radix and Floating UI do:
 * - render the menu in a portal (outside any clipping parent), then
 * - measure: open below the button if it fits, otherwise above (a "flip"),
 * - line up the right edges, and keep it inside the window.
 *
 * Runs before paint (useLayoutEffect), so the menu never flashes in the wrong spot.
 * Re-measures on scroll, resize and when `key` changes (e.g. the menu swaps to a
 * taller confirm step).
 */
export function useFloating(
  /** The trigger: a ref, or a getter (read only inside effects, never during render). */
  anchor: RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined),
  floating: RefObject<HTMLElement | null>,
  open: boolean,
  key?: unknown,
  gap = 6,
): FloatingPos {
  const [pos, setPos] = useState<FloatingPos>(HIDDEN);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = (typeof anchor === "function" ? anchor() : anchor.current)?.getBoundingClientRect();
      const f = floating.current;
      if (!a || !f) return;
      const h = f.offsetHeight;
      const w = f.offsetWidth;
      const below = window.innerHeight - a.bottom;
      const above = a.top;
      const up = below < h + gap + 8 && above > below;
      const top = up ? a.top - h - gap : a.bottom + gap;
      const left = Math.min(Math.max(8, a.right - w), window.innerWidth - w - 8);
      // Only update when it actually moved: a getter anchor is a new function every
      // render, so this effect re-runs often, and an unconditional setState would loop.
      setPos((p) =>
        p.style.top === top && p.style.left === left && p.up === up && p.style.visibility === undefined
          ? p
          : { style: { position: "fixed", top, left, transformOrigin: up ? "bottom right" : "top right" }, up },
      );
    };
    place();
    window.addEventListener("resize", place);
    // Capture phase catches scrolling inside any scroll box, not just the window.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, floating, open, key, gap]);

  return open ? pos : HIDDEN;
}
