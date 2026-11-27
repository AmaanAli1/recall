import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_CAPTCHA_TOKEN_LENGTH, captchaRequired, readCaptchaToken } from "./captcha";

const req = (body?: string) => new Request("http://localhost/x", { method: "POST", body });

afterEach(() => vi.unstubAllEnvs());

describe("readCaptchaToken", () => {
  it("returns the token from a JSON body", async () => {
    expect(await readCaptchaToken(req(JSON.stringify({ captchaToken: "abc" })))).toBe("abc");
  });

  it.each([
    ["an empty body", undefined],
    ["invalid JSON", "{"],
    ["an array", "[]"],
    ["a number", "7"],
    ["a non-string token", JSON.stringify({ captchaToken: ["a"] })],
    ["an empty token", JSON.stringify({ captchaToken: "" })],
  ])("returns null for %s", async (_, body) => {
    expect(await readCaptchaToken(req(body))).toBeNull();
  });

  it("allows exactly the maximum length, and nothing longer", async () => {
    const at = "t".repeat(MAX_CAPTCHA_TOKEN_LENGTH);
    expect(await readCaptchaToken(req(JSON.stringify({ captchaToken: at })))).toBe(at);
    expect(await readCaptchaToken(req(JSON.stringify({ captchaToken: at + "t" })))).toBeNull();
  });
});

describe("captchaRequired", () => {
  it("is on exactly when a site key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "key");
    expect(captchaRequired()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(captchaRequired()).toBe(false);
  });
});
