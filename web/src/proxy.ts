import { NextResponse, type NextRequest } from "next/server";
import { DEMO_STANDBY, STANDBY_PARAM, isDemoPage } from "@/lib/demo-standby";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 "proxy" (called middleware before v16): code that runs on the
 * server before a request reaches the route.
 *
 * 1. Demo on standby: the demo's pages and "start a session" are closed here,
 *    on the server, so no link, bookmark or typed URL gets around it.
 * 2. /api: refresh the Supabase session. The browser only talks to Supabase
 *    through our /api routes, so pages don't need it, which keeps the landing
 *    page fast (no auth work on every visit).
 */
export async function proxy(request: NextRequest) {
  const closed = standbyGate(request, DEMO_STANDBY);
  if (closed) return closed;
  if (request.nextUrl.pathname.startsWith("/api/")) return await updateSession(request);
  return NextResponse.next();
}

/** The standby rules on their own, so tests can switch `standby` on and off. */
export function standbyGate(request: NextRequest, standby: boolean): NextResponse | null {
  if (!standby) return null;
  const { pathname } = request.nextUrl;

  if (isDemoPage(pathname)) {
    // 307 = temporary: browsers mustn't remember it, the demo will reopen.
    const home = new URL("/", request.url);
    home.searchParams.set(STANDBY_PARAM, "1");
    return NextResponse.redirect(home, 307);
  }

  // Starting a session is the door into the demo; closing it means a script
  // calling the API directly can't start one either.
  if (pathname === "/api/demo-sessions" && request.method === "POST") {
    return NextResponse.json({ error: "The demo is paused while RAG is in development." }, { status: 503 });
  }
  return null;
}

export const config = {
  // The demo pages are listed so the standby gate sees them. With standby off,
  // they just pass through (NextResponse.next(): no auth work).
  matcher: ["/api/:path*", "/demo", "/demo/:path*", "/ask", "/ask/:path*", "/library", "/library/:path*"],
};
