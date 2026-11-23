/**
 * "No demo session, no demo pages": Ask and Library need a session, so a visitor
 * without one is sent to /demo first (which issues one), then on to the page they
 * wanted. The check runs on the server, in proxy.ts, like the standby gate, so no
 * link, bookmark or typed URL gets around it.
 *
 * Plain module (no "use client"): the proxy (server) and /demo (browser) both use it.
 */

/**
 * Only when sessions are real (Vercel Preview + Production). In mock mode (local
 * dev, CI) the session lives in the browser's localStorage, which the server can't
 * see, so the gate stays off there. NEXT_PUBLIC_ values are baked in at build time.
 */
export const SESSION_GATE = process.env.NEXT_PUBLIC_REAL_SESSIONS === "true";

/** The pages that need a session. /demo issues one; /dyno is public. */
export const SESSION_PAGES = ["/ask", "/library"] as const;

/** True for a session page or anything under it ("/ask", "/library/x"), not "/asking". */
export function isSessionPage(pathname: string): boolean {
  return SESSION_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/** Query parameter that carries "where to go after the session exists". */
export const NEXT_PARAM = "next";

/** Where /demo sends a visitor when `next` is missing or not allowed. */
export const DEFAULT_NEXT = "/ask";

/**
 * The page to continue to after /demo, from an untrusted `?next=` value.
 *
 * Anyone can type a link like /demo?next=https://evil.example, so this only
 * ever returns a path on THIS site that is a session page (an "open redirect"
 * would let a phishing link borrow our domain). Anything else → DEFAULT_NEXT.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_NEXT;
  // Resolve it against a dummy origin, the way a browser would. If the result
  // still has that origin, it's a path on this site. This one check also
  // refuses the classic tricks: "https://evil.example", "//evil.example" and
  // "/\evil.example" (browsers read "\" as "/") all resolve to ANOTHER origin,
  // and "/ask/../dyno" normalises to "/dyno".
  const base = "https://recall.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== base || !isSessionPage(url.pathname)) return DEFAULT_NEXT;
  return url.pathname + url.search;
}
