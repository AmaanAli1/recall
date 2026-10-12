import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated accessibility audit (WCAG 2.1 A/AA rules via axe-core) on every screen.
// Fails on serious or critical violations; the report lists each rule and element.
const PAGES = ["/", "/demo", "/ask", "/library", "/dyno"];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path} @mobile`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // Let entrance animations settle so contrast is measured on final colours.
    await page.waitForTimeout(path === "/demo" ? 3500 : 800);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

test("no horizontal scroll at phone width on any screen @mobile", async ({ page }) => {
  for (const path of PAGES.filter((p) => p !== "/demo")) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
