import { expect, test, type Page } from "@playwright/test";

const runsTable = (page: Page) => page.getByRole("region", { name: "Runs", exact: true });

/** Opt into the sample runs (the mock serves none by default, like the real API before launch). */
async function withSampleRuns(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("recall-fixtures", "dyno");
    } catch {
      /* ignore */
    }
  });
}

test.describe("dyno with the real runs (no sample runs)", () => {
  test("shows run 2: core recall 20/20 and MRR like run 1, nothing invented @mobile", async ({ page }) => {
    await page.goto("/dyno");
    await expect(page.getByRole("heading", { level: 1, name: "Run 2: Query rewriting + follow-ups + off-topic" })).toBeVisible();
    const scores = page.getByRole("region", { name: "Latest run's scores" });
    await expect(scores.getByRole("heading", { level: 2 })).toHaveText(["Recall@5", "MRR", "Faithfulness", "Answer relevancy"]);
    await expect(scores.getByText("20 of 20 questions")).toHaveCount(1);
    await expect(scores.getByText("95% interval 0.63–0.89")).toBeVisible();
    await expect(scores.getByText("Not measured yet")).toHaveCount(2);
    await expect(scores.getByText("Same as run 1 (0.76)")).toBeVisible();
    // Real runs only: no Run Dyno button, and none of the sample run ids.
    await expect(page.getByRole("button", { name: "Run Dyno" })).toHaveCount(0);
    await expect(page.getByText(/\bR1[0-3]\b|\bR[89]\b/)).toHaveCount(0);
    const table = runsTable(page);
    await expect(table.getByRole("rowheader", { name: /R1/ })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: /R2/ })).toBeVisible();
    await table.getByRole("button", { name: "Show details for run 1" }).click();
    await expect(table.getByRole("link", { name: /^[0-9a-f]{7}$/ })).toHaveAttribute("href", /github\.com\/AmaanAli1\/recall\/commit\//);
    // The ranks table starts collapsed behind a summary; opening it shows every golden question.
    await expect(page.getByText("12 × 1st · 5 × 2nd · 1 × 3rd · 2 × 5th")).toBeVisible();
    const ranks = page.getByRole("button", { name: "Show all 20 questions" });
    await expect(ranks).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("group", { name: "Question ranks table" })).toBeHidden();
    await ranks.click();
    await expect(page.getByRole("button", { name: "Hide the questions" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("group", { name: "Question ranks table" }).getByRole("rowheader")).toHaveCount(20);
  });
});

test.describe("run 2's follow-ups and off-topic questions", () => {
  test("shows the follow-ups before and after rewriting, and the off-topic verdicts @mobile", async ({ page }) => {
    await page.goto("/dyno");
    const fu = page.getByRole("region", { name: "Follow-up questions: query rewriting" });
    await expect(fu.getByText("0.20 as typed, 0.92 rewritten")).toBeAttached();
    await expect(fu.getByText("0.20 → 0.92")).toBeVisible();
    const fuTable = fu.getByRole("group", { name: "Follow-up questions table" });
    await expect(fuTable.getByRole("rowheader")).toHaveCount(8);
    await expect(fuTable.getByRole("row", { name: /fu-07/ })).toContainText("How fast is Dijkstra's algorithm with a binary heap?");
    const off = page.getByRole("region", { name: "Off-topic questions: does it say “not found”?" });
    await expect(off.getByText("Not found", { exact: true })).toHaveCount(3);
    await expect(off.getByText("Would answer", { exact: true })).toHaveCount(2);
    await expect(off.getByText(/They overlap, so no single similarity threshold can separate them/)).toBeVisible();
    // Phones scroll the wide tables sideways inside their own box, not the page.
    const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(width).toBeLessThanOrEqual(0);
  });
});

test.describe("arriving at /dyno from the landing page", () => {
  for (const [label, link] of [
    ["the bench's Open the dashboard", (page: Page) => page.getByRole("link", { name: /Open the dashboard/ })],
    ["the footer's Dyno results", (page: Page) => page.getByRole("contentinfo").getByRole("link", { name: "Dyno results" })],
  ] as const) {
    test(`${label} opens the page at the top @mobile`, async ({ page }) => {
      await page.goto("/");
      const target = link(page);
      await target.scrollIntoViewIfNeeded(); // far down the landing page
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
      await target.click();
      await expect(page).toHaveURL(/\/dyno$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
      // Give a late layout shift (the old bug: scroll anchoring) time to happen.
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
    });
  }
});

test.describe("dyno with sample runs", () => {
  test.beforeEach(async ({ page }) => {
    await withSampleRuns(page);
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
  });

  test("a run's Details expands in place and highlights what it changed", async ({ page }) => {
    const table = runsTable(page);
    const btn = table.getByRole("button", { name: "Show details for run 11" });
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await btn.click();
    const hide = table.getByRole("button", { name: "Hide details for run 11" });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    const details = page.locator("#det-R11");
    await expect(details).toContainText("Hybrid: BM25 + vector (RRF)");
    await expect(details).toContainText("d90b3ee");
    await hide.click();
    await expect(table.getByRole("button", { name: "Show details for run 11" })).toHaveAttribute("aria-expanded", "false");
  });

  test("Run and Compare share one panel slot", async ({ page }) => {
    await page.getByRole("button", { name: /^Compare runs/ }).click();
    await expect(page.getByRole("heading", { name: "Compare runs" })).toBeVisible();
    // Starting a run takes the slot: Compare closes.
    await page.getByRole("button", { name: "Run Dyno" }).click();
    await expect(page.getByRole("heading", { name: "Compare runs" })).toBeHidden();
    // Opening Compare mid-run shrinks the run to a one-line strip.
    await page.getByRole("button", { name: /^Compare runs/ }).click();
    await expect(page.getByText(/^Run 13 running · \d+ of 80 questions$/)).toBeVisible();
    await page.getByRole("button", { name: "Show run" }).click();
    await expect(page.getByRole("heading", { name: "Compare runs" })).toBeHidden();
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
