/**
 * Eased smooth scrolling used by in-page links and the back-to-top button.
 * Native `scroll-behavior: smooth` is flat and differs per browser; this gives
 * one consistent ease-in-out whose duration scales with distance, and a wheel
 * or touch cancels it immediately.
 */
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

let frame = 0;

export function easedScrollTo(to: number, onArrive?: () => void): void {
  cancelAnimationFrame(frame);
  const from = window.scrollY;
  const dist = Math.abs(to - from);
  if (prefersReducedMotion() || dist < 4) {
    window.scrollTo(0, to);
    onArrive?.();
    return;
  }
  const duration = Math.min(1100, Math.max(520, dist * 0.45));
  const start = performance.now();
  const cancel = () => cancelAnimationFrame(frame);
  window.addEventListener("wheel", cancel, { passive: true, once: true });
  window.addEventListener("touchstart", cancel, { passive: true, once: true });
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + (to - from) * easeInOutCubic(t));
    if (t < 1) frame = requestAnimationFrame(step);
    else {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      onArrive?.();
    }
  };
  frame = requestAnimationFrame(step);
}

/** Scroll to an element by id, landing 24px above it, then move focus there. */
export function scrollToId(id: string): boolean {
  const target = id === "top" ? document.body : document.getElementById(id);
  if (!target) return false;
  const to = id === "top" ? 0 : Math.max(0, target.getBoundingClientRect().top + window.scrollY - 24);
  easedScrollTo(to, () => {
    try {
      history.replaceState(null, "", id === "top" ? location.pathname : `#${id}`);
    } catch {
      /* ignore */
    }
    const focusEl = id === "top" ? document.getElementById("main") : target;
    if (focusEl) {
      if (!focusEl.hasAttribute("tabindex")) focusEl.setAttribute("tabindex", "-1");
      focusEl.focus({ preventScroll: true });
    }
    const heading = id === "top" ? null : target.querySelector("h1, h2");
    if (heading && !prefersReducedMotion()) {
      heading.classList.remove("arrived");
      void (heading as HTMLElement).offsetWidth;
      heading.classList.add("arrived");
      setTimeout(() => heading.classList.remove("arrived"), 2300);
    }
  });
  return true;
}
