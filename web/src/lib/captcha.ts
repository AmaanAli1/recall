/**
 * CAPTCHA for new demo sessions (security pass, 2026-11-27).
 *
 * "Try the demo" creates an anonymous Supabase user. Without a human check,
 * a script could create thousands of sessions, each with its own token
 * budget. Cloudflare Turnstile runs in the browser and hands us a one-time
 * token; we pass it to signInAnonymously(), and SUPABASE verifies it with
 * the secret key set in its dashboard. That secret never touches this repo.
 *
 * We don't verify the token ourselves: a Turnstile token can only be
 * verified once, so if we used it up here, Supabase's check would fail.
 */

/** Turnstile tokens are at most 2048 characters (Cloudflare's limit). */
export const MAX_CAPTCHA_TOKEN_LENGTH = 2048;

/**
 * The widget's public site key, per environment (Vercel: Preview = the
 * staging widget, Production = the production widget). Public by design:
 * it only identifies the widget. Read on each call so tests can change it.
 */
export function captchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
}

/** A site key is set, so every NEW session must come with a token. */
export function captchaRequired(): boolean {
  return captchaSiteKey() !== "";
}

/**
 * The token from the request body, or null if there's no usable one.
 *
 * The body is untrusted: it may be missing, not JSON, not an object, or
 * hold something that isn't a string. All of those mean "no token", never
 * an exception. Anything that passes is only a candidate: Supabase decides
 * whether it's real.
 */
export async function readCaptchaToken(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null; // no body, or not JSON
  }
  if (typeof body !== "object" || body === null) return null;

  const token = (body as { captchaToken?: unknown }).captchaToken;
  if (typeof token !== "string") return null;
  if (token.length === 0 || token.length > MAX_CAPTCHA_TOKEN_LENGTH) return null;
  return token;
}
