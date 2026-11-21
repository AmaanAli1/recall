/**
 * "Demo on standby": while the RAG pipeline is being connected to the live site,
 * the demo is closed. NEXT_PUBLIC_DEMO_STANDBY=true is set on Vercel Production
 * only; local dev, CI and Preview keep the normal demo. Remove in RAG Phase 5c.
 *
 * Plain module (no "use client"), so both the server (proxy.ts) and the browser
 * (DemoLink) can read it. NEXT_PUBLIC_ values are baked in at build time.
 */
export const DEMO_STANDBY = process.env.NEXT_PUBLIC_DEMO_STANDBY === "true";

/** The demo's pages. /dyno stays open: it's the public results page, not the demo. */
export const DEMO_PAGES = ["/demo", "/ask", "/library"] as const;

/** True for a demo page or anything under it ("/ask", "/ask/x"), not "/asking". */
export function isDemoPage(pathname: string): boolean {
  return DEMO_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/** Query flag the redirect adds, so the landing page opens the dialog by itself. */
export const STANDBY_PARAM = "standby";
