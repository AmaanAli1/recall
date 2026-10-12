import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("nav marks the current page and moves between screens", async ({ page }) => {
    await page.goto("/ask");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Ask" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(nav.getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
  });

  test("demo chip opens, closes with Escape, and confirms before starting fresh", async ({ page }) => {
    await page.goto("/library");
    const chip = page.getByRole("button", { name: /Demo · kept 24/ });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    const dialog = page.getByRole("dialog", { name: "Your demo session" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Start fresh" }).click();
    await expect(dialog.getByRole("button", { name: "Delete and restart" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(chip).toHaveAttribute("aria-expanded", "false");
  });

  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/dyno");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });

  test("footer shows the build status and the builder links", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("img", { name: /^Build progress: Phase 2 of 6/ })).toBeVisible();
    await expect(footer.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/amaan-ali-85967a1b1/");
    await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/AmaanAli1");
    await expect(footer.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:amaan.ali99@yahoo.com");
    await expect(footer.getByRole("link", { name: /Resume/ })).toHaveCount(0);
  });
});
