import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, isSessionPage, safeNext } from "./session-gate";

describe("isSessionPage", () => {
  it("matches Ask and Library and anything under them", () => {
    expect(["/ask", "/ask/1", "/library", "/library/x"].every(isSessionPage)).toBe(true);
  });

  it("leaves the public pages and /demo alone", () => {
    expect(["/", "/dyno", "/demo", "/asking", "/api/ask", "/libraryx"].some(isSessionPage)).toBe(false);
  });
});

describe("safeNext (where /demo continues to)", () => {
  it.each([
    ["/ask", "/ask"],
    ["/library", "/library"],
    ["/library?course=os", "/library?course=os"], // the query survives
    ["/ask?chat=123", "/ask?chat=123"],
    ["/library/anything", "/library/anything"],
  ])("keeps %s", (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["/dyno"], // a real page, but not one that needs a session
    ["/demo"], // would loop back to /demo
    ["/asking"],
    ["https://evil.example/library"], // another site: refused, not quietly turned into our /library
    ["//evil.example/ask"], // "//" means another site too
    ["/\\evil.example"], // browsers read "\" as "/"
    ["javascript:alert(1)"],
    ["/ask/../dyno"], // normalises to /dyno
    ["ask"], // not a path
  ])("refuses %s and falls back to /ask", (next) => {
    expect(safeNext(next)).toBe(DEFAULT_NEXT);
  });
});
