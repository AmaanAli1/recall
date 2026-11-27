import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Unit tests for POST /api/demo-sessions ("Try the demo"), above all its
 * human check. Supabase is faked (vi.mock), so each test controls what
 * "Supabase" answers. Whether Supabase really rejects a fake token is a
 * dashboard setting, checked by hand on staging and production (STEPS.md).
 */

const fake = {
  claims: null as null | { sub: string },
  signIn: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: fake.claims ? { claims: fake.claims } : null, error: null }),
      signInAnonymously: fake.signIn,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { code: "demo-AB12-CD", created_at: "2026-11-27T05:00:00Z", last_active_at: "2026-11-27T05:00:00Z" },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const { POST, CAPTCHA_FAILED } = await import("./route");

const post = (body?: unknown) =>
  POST(
    new Request("http://localhost/api/demo-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const ok = { data: { user: { id: "user-1" } }, error: null };

beforeEach(() => {
  fake.claims = null;
  fake.signIn.mockReset().mockResolvedValue(ok);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/demo-sessions with the human check on", () => {
  it("passes the token to Supabase, which verifies it, and returns the new session", async () => {
    const res = await post({ captchaToken: "token-from-turnstile" });
    expect(res.status).toBe(201);
    expect(fake.signIn).toHaveBeenCalledExactlyOnceWith({ options: { captchaToken: "token-from-turnstile" } });
    expect((await res.json()).id).toBe("demo-AB12-CD");
  });

  it.each([
    ["no body", undefined],
    ["a body that isn't JSON", "not json"],
    ["JSON that isn't an object", 42],
    ["null", null],
    ["no captchaToken field", { other: "x" }],
    ["a token that isn't a string", { captchaToken: 12345 }],
    ["an empty token", { captchaToken: "" }],
    ["a token over 2048 characters", { captchaToken: "x".repeat(2049) }],
  ])("refuses %s with 400, without calling Supabase", async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(CAPTCHA_FAILED);
    expect(fake.signIn).not.toHaveBeenCalled();
  });

  it("accepts a token of exactly 2048 characters (the boundary)", async () => {
    const res = await post({ captchaToken: "x".repeat(2048) });
    expect(res.status).toBe(201);
  });

  it("returns 400 when Supabase rejects the token (fake, expired or reused)", async () => {
    fake.signIn.mockResolvedValue({ data: { user: null }, error: { code: "captcha_failed", status: 400, message: "captcha protection: request disallowed" } });
    const res = await post({ captchaToken: "forged" });
    expect(res.status).toBe(400);
    // The visitor gets our short message, never Supabase's wording.
    expect((await res.json()).error).toBe(CAPTCHA_FAILED);
  });

  it("still reports the per-IP rate limit as 429", async () => {
    fake.signIn.mockResolvedValue({ data: { user: null }, error: { code: "over_request_rate_limit", status: 429 } });
    const res = await post({ captchaToken: "t" });
    expect(res.status).toBe(429);
  });

  it("any other Supabase failure is a 503 with a generic message", async () => {
    fake.signIn.mockResolvedValue({ data: { user: null }, error: { code: "unexpected_failure", status: 500 } });
    const res = await post({ captchaToken: "t" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Couldn't start a demo session.");
  });

  it("reuses an existing session without asking for a token", async () => {
    fake.claims = { sub: "user-1" };
    const res = await post();
    expect(res.status).toBe(201);
    expect(fake.signIn).not.toHaveBeenCalled();
  });
});

describe("POST /api/demo-sessions with no site key (a local real-sessions build)", () => {
  it("signs in without a token or options", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const res = await post();
    expect(res.status).toBe(201);
    expect(fake.signIn).toHaveBeenCalledExactlyOnceWith(undefined);
  });
});
