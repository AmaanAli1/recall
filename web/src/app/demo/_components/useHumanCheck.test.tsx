import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTurnstileLoader, type TurnstileOptions } from "@/lib/turnstile";
import { HUMAN_CHECK_FAILED, HUMAN_CHECK_TIMEOUT_MS, useHumanCheck } from "./useHumanCheck";

/** A fake window.turnstile that records what we ask of it. */
function fakeTurnstile() {
  const t = {
    options: null as TurnstileOptions | null,
    render: vi.fn((_el: HTMLElement, o: TurnstileOptions) => {
      t.options = o;
      return "w1";
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = t;
  return t;
}

let getToken: () => Promise<string>;
/** Mount the hook and give it an element to render the widget into (what the callback ref does on the page). */
function mount() {
  const hook = renderHook(() => useHumanCheck("site-key"));
  act(() => hook.result.current.container(document.createElement("div")));
  getToken = hook.result.current.getToken;
  return hook;
}

beforeEach(() => resetTurnstileLoader());
afterEach(() => {
  cleanup();
  delete window.turnstile;
  vi.useRealTimers();
});

describe("useHumanCheck", () => {
  it("renders Managed Turnstile, hidden unless a click is needed, and resolves with its token", async () => {
    const t = fakeTurnstile();
    mount();
    const p = getToken();
    await act(async () => {});
    expect(t.render).toHaveBeenCalledOnce();
    expect(t.options).toMatchObject({ sitekey: "site-key", appearance: "interaction-only", action: "demo-session" });
    t.options!.callback!("tok-1");
    await expect(p).resolves.toBe("tok-1");
  });

  it("gets a FRESH token on the next attempt (tokens are single-use)", async () => {
    const t = fakeTurnstile();
    mount();
    const first = getToken();
    await act(async () => {});
    t.options!.callback!("tok-1");
    await first;

    const second = getToken();
    await act(async () => {});
    expect(t.render).toHaveBeenCalledOnce(); // same widget...
    expect(t.reset).toHaveBeenCalledWith("w1"); // ...challenged again
    t.options!.callback!("tok-2");
    await expect(second).resolves.toBe("tok-2");
  });

  it.each(["error-callback", "expired-callback", "timeout-callback"] as const)("rejects with a clear message on %s", async (cb) => {
    const t = fakeTurnstile();
    mount();
    const p = getToken();
    await act(async () => {});
    (t.options![cb] as () => void)();
    await expect(p).rejects.toThrow(HUMAN_CHECK_FAILED);
  });

  it("gives up after the timeout instead of hanging the card", async () => {
    vi.useFakeTimers();
    fakeTurnstile();
    mount();
    const p = getToken();
    const assertion = expect(p).rejects.toThrow(HUMAN_CHECK_FAILED);
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(HUMAN_CHECK_TIMEOUT_MS));
    await assertion;
  });

  it("rejects when Cloudflare's script can't load (blocked), so Retry can try again", async () => {
    const append = vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      queueMicrotask(() => (node as HTMLScriptElement).onerror?.(new Event("error")));
      return node;
    });
    mount();
    await expect(getToken()).rejects.toThrow(HUMAN_CHECK_FAILED);
    append.mockRestore();
  });

  it("removes the widget when the page unmounts", async () => {
    const t = fakeTurnstile();
    const { unmount } = mount();
    const p = getToken().catch((e: Error) => e.message);
    await act(async () => {});
    unmount();
    expect(t.remove).toHaveBeenCalledWith("w1");
    await expect(p).resolves.toBe(HUMAN_CHECK_FAILED);
  });
});
