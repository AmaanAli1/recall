import { NextResponse, type NextRequest } from "next/server";
import { DEMO_STANDBY, STANDBY_PARAM, isDemoPage } from "@/lib/demo-standby";
import { NEXT_PARAM, SESSION_GATE, isSessionPage } from "@/lib/session-gate";
import { checkSession, updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 "proxy" (called middleware before v16): code that runs on the
 * server before a request reaches the route.
 *
 * 1. Demo on standby: the demo's pages and "start a session" are closed here,
 *    on the server, so no link, bookmark or typed URL gets around it.
 * 2. Ask and Library need a demo session: without one, the visitor is sent to
 *    /demo (which issues one) and then on to the page they asked for.
 * 3. /api: refresh the Supabase session. The browser only talks to Supabase
 *    through our /api routes, so other pages don't need it, which keeps the
 *    landing page fast (no auth work on every visit).
 */
export async function proxy(request: NextRequest) {
  const closed = standbyGate(request, DEMO_STANDBY);
  if (closed) return closed;
  const gated = await sessionGate(request, SESSION_GATE);
  if (gated) return gated;
  if (request.nextUrl.pathname.startsWith("/api/")) return await updateSession(request);
  return NextResponse.next();
}

/**
 * The session rule on its own, so tests can switch it on and off (like
 * standbyGate). Returns null for requests it doesn't handle.
 */
export async function sessionGate(request: NextRequest, enabled: boolean): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  if (!enabled || !isSessionPage(pathname)) return null;

  const { response, userId } = await checkSession(request);
  // Signed in: carry on, with any refreshed cookies.
  if (userId) return response;

  // No session: /demo?next=/library (the page asked for, query included).
  // 307 = temporary, so browsers don't remember it.
  const demo = new URL("/demo", request.url);
  demo.searchParams.set(NEXT_PARAM, pathname + search);
  const redirect = NextResponse.redirect(demo, 307);
  // If Supabase cleared a dead session's cookies, keep that on the redirect too.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
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
  // The demo pages are listed so the standby and session gates see them. /demo
  // and (in mock mode) /ask and /library just pass through: no auth work.
  matcher: ["/api/:path*", "/demo", "/demo/:path*", "/ask", "/ask/:path*", "/library", "/library/:path*"],
};
