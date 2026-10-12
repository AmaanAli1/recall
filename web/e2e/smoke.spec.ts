import { expect, test } from "@playwright/test";

// First E2E check: the production build serves the home page.
test("home page renders the headline @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask your notes");
});
