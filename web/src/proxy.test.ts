import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { isDemoPage } from "@/lib/demo-standby";

/*
 * The standby gate in proxy.ts: with the demo on standby, the demo's pages
 * redirect home and "start a session" is refused, on the server. updateSession
 * is faked: these tests are about which requests get through, not Supabase.
 */
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => NextResponse.next({ headers: { "x-session-refreshed": "1" } })),
}));

const { config, proxy, standbyGate } = await import("./proxy");

const req = (path: string, method = "GET") => new NextRequest(new URL(path, "https://recall.test"), { method });

describe("standbyGate (demo on standby)", () => {
  it.each(["/demo", "/ask", "/library", "/ask/anything", "/library/x?y=1", "/demo/"])("redirects %s home with ?standby=1", (path) => {
    const res = standbyGate(req(path), true);
    expect(res?.status).toBe(307); // temporary: browsers mustn't cache it
    expect(res?.headers.get("location")).toBe("https://recall.test/?standby=1");
  });

  it("refuses to start a demo session through the API", async () => {
    const res = standbyGate(req("/api/demo-sessions", "POST"), true);
    expect(res?.status).toBe(503);
    expect(await res?.json()).toEqual({ error: "The demo is paused while RAG is in development." });
  });

  it.each([
    ["/", "GET"],
    ["/dyno", "GET"],
    ["/asking", "GET"], // a different page that just starts with "/ask"
    ["/api/demo-sessions", "GET"], // reading or ending a session is fine
    ["/api/demo-sessions", "DELETE"],
    ["/api/health", "GET"],
  ])("lets %s (%s) through", (path, method) => {
    expect(standbyGate(req(path, method), true)).toBeNull();
  });

  it("does nothing at all when standby is off", () => {
    for (const path of ["/demo", "/ask", "/library"]) expect(standbyGate(req(path), false)).toBeNull();
    expect(standbyGate(req("/api/demo-sessions", "POST"), false)).toBeNull();
  });
});

describe("proxy (standby off, as in tests and Preview)", () => {
  it("still refreshes the session on /api routes", async () => {
    const res = await proxy(req("/api/chats"));
    expect(res.headers.get("x-session-refreshed")).toBe("1");
  });

  it("passes demo pages straight through, without auth work", async () => {
    const res = await proxy(req("/ask"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-session-refreshed")).toBeNull();
  });
});

describe("matcher", () => {
  // If a demo page fell out of the matcher, the gate would never see it.
  it("sends every demo page and the API through the proxy", () => {
    for (const page of ["/demo", "/ask", "/library"]) {
      expect(config.matcher).toContain(page);
      expect(config.matcher).toContain(`${page}/:path*`);
    }
    expect(config.matcher).toContain("/api/:path*");
  });

  it("isDemoPage matches pages and sub-pages only", () => {
    expect(["/demo", "/ask/1", "/library"].every(isDemoPage)).toBe(true);
    expect(["/", "/dyno", "/asking", "/api/ask"].some(isDemoPage)).toBe(false);
  });
});
