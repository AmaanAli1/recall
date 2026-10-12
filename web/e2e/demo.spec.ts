import { expect, test } from "@playwright/test";

test.describe("demo boot", () => {
  test("fresh visitor gets a session card and opens the notebook @mobile", async ({ page }) => {
    await page.goto("/demo");

    const steps = page.getByRole("listitem");
    for (const label of [
      "Creating your private session",
      "Copying 3 sample courses into your notebook",
      "Warming up search and the reranker",
    ]) {
      await expect(steps.filter({ hasText: label })).toContainText("done");
    }

    await expect(page.getByRole("heading", { level: 1, name: "Your demo notebook is ready." })).toBeVisible();
    await expect(page.getByText(/demo-[A-Z0-9]{4}-[A-Z0-9]{2}/)).toBeVisible();
    await expect(page.getByText("3 sample courses · 15 lecture PDFs")).toBeVisible();

    await page.getByRole("link", { name: /Open my notebook/ }).click();
    await expect(page).toHaveURL(/\/ask$/);
  });

  test("replay re-runs the card without issuing a new session", async ({ page }) => {
    await page.goto("/demo");
    const sid = page.getByText(/demo-[A-Z0-9]{4}-[A-Z0-9]{2}/);
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible();
    const first = await sid.textContent();

    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.getByRole("heading", { name: "Preparing your demo session…" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible();
    await expect(sid).toHaveText(first ?? "");
  });

  test("returning visitor with a session skips straight to Ask", async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      window.localStorage.setItem("recall-demo", JSON.stringify({ id: "demo-AB12-CD", createdAt: now, lastActiveAt: now }));
    });
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/ask$/);
  });
});
