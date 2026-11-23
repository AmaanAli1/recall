import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The session gate in proxy.ts: with real sessions (Preview + Production),
 * /ask and /library need a demo session; without one, the visitor goes to
 * /demo?next=<the page>. checkSession is faked: these tests are about who gets
 * through, not Supabase itself.
 */
const session = vi.hoisted(() => ({ userId: null as string | null, clearCookie: false }));

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(async () => NextResponse.next({ headers: { "x-session-refreshed": "1" } })),
  checkSession: vi.fn(async () => {
    const response = NextResponse.next({ headers: { "x-session-refreshed": "1" } });
    // Supabase clears a dead session's cookies on the response it hands back.
    if (session.clearCookie) response.cookies.set("sb-test-auth-token", "", { maxAge: 0 });
    return { response, userId: session.userId };
  }),
}));
// The whole proxy with the gate ON, as on Vercel (NEXT_PUBLIC_REAL_SESSIONS=true).
vi.mock("@/lib/session-gate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session-gate")>()),
  SESSION_GATE: true,
}));

const { proxy, sessionGate } = await import("./proxy");
const { checkSession } = await import("@/lib/supabase/proxy");
const req = (path: string) => new NextRequest(new URL(path, "https://recall.test"));

beforeEach(() => {
  session.userId = null;
  session.clearCookie = false;
  vi.mocked(checkSession).mockClear();
});

describe("sessionGate", () => {
  it.each([
    ["/ask", "https://recall.test/demo?next=%2Fask"],
    ["/library", "https://recall.test/demo?next=%2Flibrary"],
    ["/library?course=os", "https://recall.test/demo?next=%2Flibrary%3Fcourse%3Dos"],
    ["/ask/anything", "https://recall.test/demo?next=%2Fask%2Fanything"],
  ])("sends %s to /demo first when there's no session", async (path, location) => {
    const res = await sessionGate(req(path), true);
    expect(res?.status).toBe(307); // temporary: browsers mustn't cache it
    expect(res?.headers.get("location")).toBe(location);
  });

  it("lets a visitor with a session through, with the refreshed cookies", async () => {
    session.userId = "user-1";
    const res = await sessionGate(req("/ask"), true);
    expect(res?.status).toBe(200);
    expect(res?.headers.get("x-session-refreshed")).toBe("1");
  });

  it("keeps Supabase's cleared cookies on the redirect", async () => {
    session.clearCookie = true;
    const res = await sessionGate(req("/library"), true);
    expect(res?.status).toBe(307);
    expect(res?.cookies.get("sb-test-auth-token")?.value).toBe("");
  });

  it.each(["/", "/dyno", "/demo", "/asking", "/api/courses"])("ignores %s (no auth work)", async (path) => {
    expect(await sessionGate(req(path), true)).toBeNull();
    expect(checkSession).not.toHaveBeenCalled();
  });

  it("does nothing at all when switched off (mock mode)", async () => {
    for (const path of ["/ask", "/library"]) expect(await sessionGate(req(path), false)).toBeNull();
    expect(checkSession).not.toHaveBeenCalled();
  });
});

describe("proxy with the session gate on", () => {
  it("really calls the gate: no session → /demo?next=", async () => {
    const res = await proxy(req("/library"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://recall.test/demo?next=%2Flibrary");
  });

  it("lets /demo itself through, so a session can be issued there", async () => {
    const res = await proxy(req("/demo?next=%2Fask"));
    expect(res.status).toBe(200);
    expect(checkSession).not.toHaveBeenCalled();
  });
});
