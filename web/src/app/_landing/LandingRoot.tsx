"use client";

import type { MouseEvent, ReactNode } from "react";
import { scrollToId } from "@/lib/scroll";
import styles from "./landing.module.css";

/**
 * Page root (`#top`). One delegated click handler turns every in-page `#` link on the
 * landing page into the shared eased scroll (plus the heading "arrival" highlight),
 * instead of wiring each link separately.
 *
 * It listens in the capture phase so it runs before next/link's own handler; calling
 * preventDefault there makes next/link stand down (it skips default-prevented clicks).
 */
export function LandingRoot({ children }: { children: ReactNode }) {
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    // Let modifier / middle clicks do their normal thing (new tab, etc.).
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href")?.slice(1);
    // BackToTop handles "#top" itself; scrolling twice would restart the glide.
    if (!id || id === "top") return;
    if (scrollToId(id)) e.preventDefault();
  };

  return (
    <div id="top" className={styles.root} onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
