import { expect, test, type Page } from "@playwright/test";

const runsTable = (page: Page) => page.getByRole("region", { name: "Runs", exact: true });

test.describe("dyno", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dyno");
  });

  test("shows the verdict and the five logged runs", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Clear of the redline." })).toBeVisible();
    await expect(page.getByText("Run 12 · Reranker: cross-encoder on top 20")).toBeVisible();
    const table = runsTable(page);
    await expect(table.getByRole("rowheader")).toHaveCount(5);
    for (const id of ["R8", "R9", "R10", "R11", "R12"]) {
      await expect(table.getByRole("rowheader", { name: new RegExp(`^${id}\\b`) })).toBeVisible();
    }
    await expect(table.getByRole("link", { name: "Open run R9 in MLflow" })).toBeAttached();
  });

  test("metric tabs switch the trend chart", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Recall@5 rose 0.14 over 4 changes" })).toBeVisible();
    const tab = page.getByRole("group", { name: "Metric" }).getByRole("button", { name: "Faithfulness" });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Faithfulness rose 0.04 over 4 changes" })).toBeVisible();
  });

  test("Run Dyno runs to completion and logs run 13 @mobile", async ({ page }) => {
    await page.getByRole("button", { name: "Run Dyno" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Running the numbers…" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Questions evaluated" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Run 13 finished" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Clear of the redline." })).toBeVisible();
    await expect(runsTable(page).getByRole("rowheader", { name: /^R13\b/ })).toBeVisible();
    await expect(runsTable(page).getByRole("rowheader")).toHaveCount(6);
    await page.getByRole("button", { name: "Close run summary" }).click();
    await expect(page.getByRole("heading", { name: "Run 13 finished" })).toBeHidden();
  });

  test("Cancel run returns to the previous verdict", async ({ page }) => {
    await page.getByRole("button", { name: "Run Dyno" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Running the numbers…" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel run" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Clear of the redline." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Dyno" })).toBeVisible();
    await expect(runsTable(page).getByRole("rowheader")).toHaveCount(5);
  });

  test("Compare opens on latest vs baseline, swaps, and closes", async ({ page }) => {
    await page.getByRole("button", { name: /^Compare runs/ }).click();
    // While open, the header toggle reads "Close compare C" and reports its state.
    await expect(page.getByRole("button", { name: /^Close compare C/ })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("heading", { name: "Compare runs" })).toBeVisible();

    const groupA = page.getByRole("group", { name: "Run A" });
    const groupB = page.getByRole("group", { name: "Compare against" });
    await expect(groupA.getByRole("button", { name: "R12", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(groupB.getByRole("button", { name: "R8 · baseline", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("cell", { name: "Real gain" }).first()).toBeVisible();

    await groupB.getByRole("button", { name: "Swap A and B" }).click();
    await expect(groupA.getByRole("button", { name: "R8 · baseline", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(groupB.getByRole("button", { name: "R12", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(groupB.getByRole("button", { name: "Reset to baseline" })).toBeVisible();

    await groupA.getByRole("button", { name: "R12", exact: true }).click();
    await expect(page.getByText("Pick two different runs to compare.")).toBeVisible();

    // The × in the panel (exact name) closes it; the header toggle reads "Close compare C" while open.
    await page.getByRole("button", { name: "Close compare", exact: true }).click();
    await expect(page.getByRole("button", { name: /Compare runs/ })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("heading", { name: "Compare runs" })).toBeHidden();
  });
});
