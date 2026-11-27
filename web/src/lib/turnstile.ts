/**
 * Loads Cloudflare Turnstile's script once, on demand (only /demo needs it).
 *
 * Explicit rendering (?render=explicit): the script doesn't scan the page for
 * widgets; we call turnstile.render() ourselves when a session is needed.
 * No npm package: this file is the whole integration.
 */

export interface TurnstileOptions {
  sitekey: string;
  /** "interaction-only": the widget stays hidden unless Cloudflare needs a click. */
  appearance?: "always" | "execute" | "interaction-only";
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "error-callback"?: (code?: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
}

export interface TurnstileApi {
  render(el: HTMLElement, options: TurnstileOptions): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

/** Resolves with window.turnstile once the script has loaded. A failed load can be retried. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile needs a browser."));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't start.")));
    script.onerror = () => {
      script.remove();
      loading = null; // let Retry try again
      reject(new Error("Couldn't load the human check."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Test helper: forget a previous load. */
export function resetTurnstileLoader() {
  loading = null;
}
