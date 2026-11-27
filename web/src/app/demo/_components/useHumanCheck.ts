"use client";

import { useCallback, useEffect, useRef } from "react";
import { loadTurnstile, type TurnstileApi } from "@/lib/turnstile";

/** Shown when the check fails, can't load, or never finishes. Retry runs it again. */
export const HUMAN_CHECK_FAILED = "We couldn't confirm you're human. Try again.";
/** Give up after this long, so a blocked script or an abandoned checkbox can't hang the card. */
export const HUMAN_CHECK_TIMEOUT_MS = 60_000;

/**
 * The human check before a new demo session (Cloudflare Turnstile, Managed
 * mode). Most visitors never see it; when Cloudflare is unsure, a checkbox
 * appears in the element given to `container` (a callback ref).
 *
 * getToken() returns a FRESH token every call. Tokens are single-use: after
 * one has been sent (even if the request failed), the next attempt needs a
 * new one, so a second call resets the widget instead of reusing the token.
 */
export function useHumanCheck(siteKey: string) {
  const el = useRef<HTMLDivElement | null>(null);
  /** Callback ref for the element the widget renders into. */
  const container = useCallback((node: HTMLDivElement | null) => {
    el.current = node;
  }, []);
  const api = useRef<TurnstileApi | null>(null);
  const widgetId = useRef<string | undefined>(undefined);
  // The promise currently waiting for a token, if any.
  const pending = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);

  const settle = (outcome: { token: string } | { error: Error }) => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    if ("token" in outcome) p.resolve(outcome.token);
    else p.reject(outcome.error);
  };

  const getToken = useCallback(async (): Promise<string> => {
    // A stale wait (e.g. a Replay mid-check) is abandoned, not left hanging.
    settle({ error: new Error(HUMAN_CHECK_FAILED) });

    const target = el.current;
    if (!target) throw new Error(HUMAN_CHECK_FAILED);

    let turnstile: TurnstileApi;
    try {
      turnstile = api.current ??= await loadTurnstile();
    } catch {
      throw new Error(HUMAN_CHECK_FAILED);
    }

    const token = new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
    });

    if (widgetId.current === undefined) {
      widgetId.current = turnstile.render(target, {
        sitekey: siteKey,
        appearance: "interaction-only",
        action: "demo-session",
        theme: "light",
        callback: (t) => settle({ token: t }),
        "error-callback": () => settle({ error: new Error(HUMAN_CHECK_FAILED) }),
        "expired-callback": () => settle({ error: new Error(HUMAN_CHECK_FAILED) }),
        "timeout-callback": () => settle({ error: new Error(HUMAN_CHECK_FAILED) }),
      });
    } else {
      turnstile.reset(widgetId.current); // runs the challenge again for a new token
    }

    const timer = setTimeout(() => settle({ error: new Error(HUMAN_CHECK_FAILED) }), HUMAN_CHECK_TIMEOUT_MS);
    try {
      return await token;
    } finally {
      clearTimeout(timer);
    }
  }, [siteKey]);

  // Remove the widget when the page goes away.
  useEffect(
    () => () => {
      settle({ error: new Error(HUMAN_CHECK_FAILED) });
      if (api.current && widgetId.current !== undefined) api.current.remove(widgetId.current);
    },
    [],
  );

  return { container, getToken };
}
