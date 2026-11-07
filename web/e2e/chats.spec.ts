import { expect, test, type Page } from "@playwright/test";

/*
 * Saved chats in Ask (Chats Phases 3–4). CI runs on the mock API, so these
 * test the UI's behaviour: when a chat is created, which chat is current,
 * what opening one shows, and how delete + Undo behave. The real endpoints
 * are unit-tested (Vitest) and smoke-tested on the staging preview.
 *
 * The mock Algorithms course starts with 6 sample chats.
 */

const SAMPLE_CHATS = 6;
const DIJKSTRA = "Why does Dijkstra fail with negative edges?";
const DP = "When does dynamic programming beat a greedy approach?";

/** Mark this visit as the first one after the demo boot (opens on the starters). */
async function freshArrival(page: Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("recall-demo-fresh", "1");
    } catch {
      /* ignore */
    }
  });
}

const chats = (page: Page) => page.getByRole("navigation", { name: "Chats" });
const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test.describe("saved chats", () => {
  test("asking a question saves it as a chat at the top, marked as the open one", async ({ page }) => {
    await freshArrival(page);
    await page.goto("/ask");
    await page.getByRole("button", { name: DIJKSTRA }).click();
    await expect(heading(page)).toHaveText(DIJKSTRA);

    const first = chats(page).getByRole("link").first();
    await expect(first).toHaveText(DIJKSTRA);
    await expect(first).toHaveAttribute("aria-current", "true");
    await expect(chats(page).getByRole("link")).toHaveCount(SAMPLE_CHATS + 1);
  });

  test("the answer Ask shows on its own when you come back is not saved", async ({ page }) => {
    // Not a fresh arrival: Ask opens on the first starter's answer by itself.
    await page.goto("/ask");
    await expect(heading(page)).toHaveText(DP);
    // Ask one real question: exactly one chat is added. If the automatic
    // answer had been saved too, there would be two.
    await page.getByRole("button", { name: /^New chat/ }).click();
    await page.getByRole("button", { name: DIJKSTRA }).click();
    await expect(chats(page).getByRole("link").first()).toHaveText(DIJKSTRA);
    await expect(chats(page).getByRole("link")).toHaveCount(SAMPLE_CHATS + 1);
  });

  test("a follow-up goes into the open chat instead of starting a new one", async ({ page }) => {
    await freshArrival(page);
    await page.goto("/ask");
    await page.getByRole("button", { name: DIJKSTRA }).click();
    await expect(chats(page).getByRole("link")).toHaveCount(SAMPLE_CHATS + 1);

    const box = page.getByRole("textbox", { name: "Ask about Algorithms" });
    await box.fill("And what should I use instead?");
    await box.press("Enter");
    await expect(page.getByRole("region", { name: "Answer" })).toBeVisible();

    await expect(chats(page).getByRole("link")).toHaveCount(SAMPLE_CHATS + 1);
    await expect(chats(page).getByRole("link").first()).toHaveAttribute("aria-current", "true");
  });

  test("opening a saved chat shows its answer, and New chat starts another", async ({ page }) => {
    await freshArrival(page);
    await page.goto("/ask");
    await page.getByRole("button", { name: DIJKSTRA }).click();
    // Wait until it's saved (the heading alone also shows while loading).
    await expect(chats(page).getByRole("link")).toHaveCount(SAMPLE_CHATS + 1);

    await page.getByRole("button", { name: /^New chat/ }).click();
    await page.getByRole("button", { name: DP }).click();
    await expect(heading(page)).toHaveText(DP);
    await expect(chats(page).getByRole("link")).toHaveCount(SAMPLE_CHATS + 2);

    await chats(page).getByRole("link", { name: DIJKSTRA }).click();
    await expect(heading(page)).toHaveText(DIJKSTRA);
    await expect(chats(page).getByRole("link", { name: DIJKSTRA })).toHaveAttribute("aria-current", "true");
  });

  test("deleting the open chat returns Ask to the starters", async ({ page }) => {
    await freshArrival(page);
    await page.goto("/ask");
    await page.getByRole("button", { name: DIJKSTRA }).click();
    await expect(chats(page).getByRole("link", { name: DIJKSTRA })).toHaveAttribute("aria-current", "true");

    await chats(page).getByRole("button", { name: `Options for ${DIJKSTRA}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await chats(page).getByRole("group", { name: /^Confirm deleting/ }).getByRole("button", { name: "Delete" }).click();

    await expect(heading(page)).toHaveText("Ask anything about Algorithms.");
    await expect(chats(page).getByText("Chat deleted.")).toBeVisible();
  });

  test("a delete is final once the Undo window closes, even after leaving Ask", async ({ page }) => {
    await page.clock.install();
    await page.goto("/ask");
    await chats(page).getByRole("button", { name: "Options for Master theorem cases" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await chats(page).getByRole("group", { name: /^Confirm deleting/ }).getByRole("button", { name: "Delete" }).click();
    await expect(chats(page).getByText("Chat deleted.")).toBeVisible();

    // Let the 8-second Undo window pass without waiting 8 real seconds.
    await page.clock.fastForward(9000);
    await expect(chats(page).getByText("Chat deleted.")).toHaveCount(0);

    // Leave Ask and come back (client-side navigation keeps the mock's state).
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await nav.getByRole("link", { name: "Ask" }).click();
    await expect(chats(page).getByRole("link", { name: "DP vs greedy" })).toBeVisible();
    await expect(chats(page).getByRole("link", { name: "Master theorem cases" })).toHaveCount(0);
  });
});
