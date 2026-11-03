import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 "proxy" (called middleware before v16): code that runs before
 * a request reaches the route.
 *
 * The browser only talks to Supabase through our /api routes, so refreshing
 * the session there is enough. Pages don't need it, which keeps the landing
 * page fast (no auth work on every visit).
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/api/:path*"],
};