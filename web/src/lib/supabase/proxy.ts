import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every matched request (see src/proxy.ts) and keeps the
 * visitor's Supabase session fresh.
 *
 * Login tokens expire after about an hour. getClaims() checks the token in
 * the request's cookies and, if it has expired, uses the refresh token to
 * get a new one. The new cookies are copied onto both the request (so the
 * route handler that runs next sees them) and the response (so the browser
 * stores them).
 */
export async function updateSession(request: NextRequest) {
  return (await checkSession(request)).response;
}

/** What checkSession found: the response to send on, and who's signed in. */
export interface SessionCheck {
  /** NextResponse.next() carrying any refreshed cookies: return THIS one. */
  response: NextResponse;
  /** The visitor's user id, or null: no session, or Supabase isn't configured. */
  userId: string | null;
}

/**
 * The same refresh as updateSession, but it also says whether there is a
 * session, so the proxy can send a visitor without one to /demo first.
 */
export async function checkSession(request: NextRequest): Promise<SessionCheck> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No Supabase configured (e.g. CI, where the app runs on the mock API):
  // nothing to refresh, so let the request through untouched.
  if (!url || !key) return { response, userId: null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cache headers from Supabase, so a CDN never caches one visitor's
        // fresh cookies and serves them to someone else.
        Object.entries(headers).forEach(([k, v]) =>
          response.headers.set(k, v),
        );
      },
    },
  });

  // Don't put any code between createServerClient and getClaims():
  // Supabase's docs warn it can cause random sign-outs.
  const { data } = await supabase.auth.getClaims();

  // Return THIS response object, or the refreshed cookies are lost.
  // `sub` is the user id; an anonymous demo visitor has one too.
  return { response, userId: data?.claims.sub ?? null };
}