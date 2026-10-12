"use client";

import { useEffect, useState } from "react";
import { scrollToId } from "@/lib/scroll";

/**
 * Floating back-to-top button. Appears after ~one screen of scrolling; the red
 * ring fills with scroll progress. Clicking glides up with the shared easing.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        setShow(y > window.innerHeight * 0.8);
        setProgress(Math.round(Math.min(1, y / max) * 100) / 100);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <a
      href="#top"
      className={`totop ${show ? "show" : ""}`}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        scrollToId("top");
      }}
    >
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" className="absolute -inset-px -rotate-90">
        <circle cx="26" cy="26" r="24.5" fill="none" stroke="var(--red)" strokeWidth="1.75" pathLength={1} style={{ strokeDasharray: `${progress} 2` }} />
      </svg>
      <svg className="totop-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="M6 11l6-6 6 6" />
      </svg>
    </a>
  );
}
