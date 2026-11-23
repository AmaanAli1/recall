import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

/*
 * The whole proxy with the demo ON STANDBY (as on Vercel Production), to prove
 * proxy() really calls the gate. proxy.test.ts covers the rules themselves.
 */
vi.mock("@/lib/demo-standby", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/demo-standby")>()),
  DEMO_STANDBY: true,
}));
vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => NextResponse.next({ headers: { "x-session-refreshed": "1" } })),
  // The session gate is off in these tests (mock mode); if it ran, it would see a session.
  checkSession: vi.fn(async () => ({ response: NextResponse.next(), userId: "user-1" })),
}));

const { proxy } = await import("./proxy");
const req = (path: string, method = "GET") => new NextRequest(new URL(path, "https://recall.test"), { method });

describe("proxy with the demo on standby", () => {
  it.each(["/demo", "/ask", "/library"])("sends %s home", async (path) => {
    const res = await proxy(req(path));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://recall.test/?standby=1");
  });

  it("refuses POST /api/demo-sessions before any auth work", async () => {
    const res = await proxy(req("/api/demo-sessions", "POST"));
    expect(res.status).toBe(503);
    expect(res.headers.get("x-session-refreshed")).toBeNull();
  });

  it("leaves the rest of the API working", async () => {
    const res = await proxy(req("/api/demo-sessions"));
    expect(res.headers.get("x-session-refreshed")).toBe("1");
  });
});
