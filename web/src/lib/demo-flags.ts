/**
 * One-shot flag: set by the demo boot screen right before it sends the visitor
 * to Ask, so Ask can show its first-visit starter questions exactly once.
 */
const KEY = "recall-demo-fresh";

export function markFreshArrival(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked: Ask just opens normally */
  }
}

export function consumeFreshArrival(): boolean {
  try {
    const fresh = window.sessionStorage.getItem(KEY) === "1";
    if (fresh) window.sessionStorage.removeItem(KEY);
    return fresh;
  } catch {
    return false;
  }
}
