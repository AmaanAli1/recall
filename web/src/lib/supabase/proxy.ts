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
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // No Supabase configured (e.g. CI, where the app runs on the mock API):
  // nothing to refresh, so let the request through untouched.
  if (!url || !key) return response;

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
  await supabase.auth.getClaims();

  // Return THIS response object, or the refreshed cookies are lost.
  return response;
}