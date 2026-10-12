import { expect, test, type Page } from "@playwright/test";

/** Mark this visit as the first one after the demo boot (what /demo does before redirecting). */
async function freshArrival(page: Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("recall-demo-fresh", "1");
    } catch {
      /* ignore */
    }
  });
}

const sources = (page: Page) => page.getByRole("complementary", { name: "Sources" });

test.describe("ask", () => {
  test("fresh arrival shows starters and a starter gets a cited answer @mobile", async ({ page }) => {
    await freshArrival(page);
    await page.goto("/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask anything about Algorithms." })).toBeVisible();
    await expect(sources(page).getByText("The pages behind each answer show up here.")).toBeVisible();

    await page.getByRole("button", { name: "Why does Dijkstra fail with negative edges?" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Why does Dijkstra fail with negative edges?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Answer" }).getByRole("button", { name: /^Show source/ })).toHaveCount(3);
    await expect(sources(page).getByRole("button", { name: /^\[\d\]/ })).toHaveCount(3);
    await expect(sources(page).getByText("3 cited, 1 dropped")).toBeVisible();
  });

  test("clicking citation [2] presses it and highlights its source", async ({ page }) => {
    await page.goto("/ask");
    const chip = page.getByRole("button", { name: "Show source 2, Week6_DP.pdf page 11" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Show source 1, Week6_DP.pdf page 4" })).toHaveAttribute("aria-pressed", "false");
    const card = sources(page).getByRole("button", { name: /^\[2\] Week6_DP\.pdf/ });
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator("mark")).toHaveText("sorting by value/weight and taking items greedily fails");
  });

  test("deleting a chat asks first, and Undo restores it", async ({ page }) => {
    await page.goto("/ask");
    const chats = page.getByRole("navigation", { name: "Chats" });
    await expect(chats.getByRole("link", { name: "Master theorem cases" })).toBeVisible();

    await chats.getByRole("button", { name: "Delete chat: Master theorem cases" }).click();
    const confirm = chats.getByRole("group", { name: "Confirm deleting Master theorem cases" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();

    await expect(chats.getByRole("link", { name: "Master theorem cases" })).toHaveCount(0);
    await expect(chats.getByText("Chat deleted.")).toBeVisible();
    await chats.getByRole("button", { name: "Undo" }).click();
    await expect(chats.getByRole("link", { name: "Master theorem cases" })).toBeVisible();
    await expect(chats.getByText("Chat deleted.")).toHaveCount(0);
  });

  test("opening a delete confirm does not move the composer", async ({ page }) => {
    await page.goto("/ask");
    const composer = page.getByRole("textbox", { name: "Ask about Algorithms" });
    await expect(page.getByRole("heading", { level: 1, name: "When does dynamic programming beat a greedy approach?" })).toBeVisible();
    const before = await composer.boundingBox();

    const chats = page.getByRole("navigation", { name: "Chats" });
    await chats.getByRole("button", { name: "Delete chat: Knapsack table walkthrough" }).click();
    await expect(chats.getByRole("group", { name: "Confirm deleting Knapsack table walkthrough" })).toBeVisible();
    const after = await composer.boundingBox();

    expect(before).not.toBeNull();
    expect(after?.y).toBe(before?.y);
  });

  test("settings: hiding retrieval timing, and Escape closes the popover", async ({ page }) => {
    await page.goto("/ask");
    const timing = page.getByRole("group", { name: "Time spent per step" });
    await expect(timing).toBeVisible();

    const gear = page.getByRole("button", { name: "Settings" });
    await gear.click();
    await expect(gear).toHaveAttribute("aria-expanded", "true");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();

    const sw = dialog.getByRole("switch", { name: "Show retrieval timing" });
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await expect(timing).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(gear).toHaveAttribute("aria-expanded", "false");
    await expect(dialog).toBeHidden();
  });
});
