import { describe, expect, it } from "vitest";

// Smoke test so the unit job has something real to run from day one.
// Real unit tests (stats, file checks, API client) arrive with the features.
describe("test setup", () => {
  it("runs TypeScript tests with jsdom", () => {
    const el = document.createElement("p");
    el.textContent = "recall";
    expect(el.textContent).toBe("recall");
  });
});
