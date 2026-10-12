import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("hero headline renders and Try the demo goes to /demo @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask your notes");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("cited");
    // No horizontal scrollbar, even at phone width (the pipeline scales to fit).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("link", { name: "Try the demo" }).first().click();
    await expect(page).toHaveURL(/\/demo$/);
  });

  test("nav How it works scrolls the pipeline section into view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How it works" }).click();
    await expect(page.getByRole("heading", { name: "From pages to proof." })).toBeInViewport();
    await expect(page).toHaveURL(/#pipeline$/);
  });

  test("pipeline pause button toggles its pressed state and label", async ({ page }) => {
    await page.goto("/");
    const pause = page.getByRole("button", { name: "Pause animation" });
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await pause.click();
    const play = page.getByRole("button", { name: "Play animation" });
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await play.click();
    await expect(page.getByRole("button", { name: "Pause animation" })).toHaveAttribute("aria-pressed", "false");
  });

  test("dyno bench metric toggle changes the shown metric", async ({ page }) => {
    await page.goto("/");
    const metric = page.getByRole("group", { name: "Metric" });
    const gauge = page.getByRole("img", { name: /for run 12/ });
    await expect(metric.getByRole("button", { name: "Recall@5" })).toHaveAttribute("aria-pressed", "true");
    await expect(gauge).toHaveAccessibleName(/^Recall@5 for run 12: 0\.86/);
    await metric.getByRole("button", { name: "Faithfulness" }).click();
    await expect(metric.getByRole("button", { name: "Faithfulness" })).toHaveAttribute("aria-pressed", "true");
    await expect(metric.getByRole("button", { name: "Recall@5" })).toHaveAttribute("aria-pressed", "false");
    await expect(gauge).toHaveAccessibleName(/^Faithfulness for run 12: 0\.91/);
  });

  test("dyno bench: picking the blocked run switches to the failing metric", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("group", { name: "Choose a run" }).getByRole("button", { name: /^Run 9,/ }).click();
    await expect(page.getByRole("img", { name: /^Faithfulness for run 9: 0\.83.*below the redline/ })).toBeVisible();
    await expect(page.getByText("REDLINE · BLOCKED")).toBeVisible();
  });

  test("returning visitor sees Resume your demo", async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      window.localStorage.setItem("recall-demo", JSON.stringify({ id: "demo-K7QF-3M", createdAt: now, lastActiveAt: now }));
    });
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Resume your demo" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/ask");
    await expect(page.getByText(/Your session demo-K7QF-3M is saved, kept for another 24\s*h/)).toBeVisible();
  });
});
