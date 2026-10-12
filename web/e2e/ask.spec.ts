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

    await chats.getByRole("button", { name: "Options for Master theorem cases" }).click();
    await page.getByRole("menu", { name: "Options for Master theorem cases" }).getByRole("menuitem", { name: "Delete" }).click();
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
    // Let the page-entrance rise finish first, or "before" is measured mid-animation.
    await page.locator(".page-in").evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const before = await composer.boundingBox();

    const chats = page.getByRole("navigation", { name: "Chats" });
    await chats.getByRole("button", { name: "Options for Knapsack table walkthrough" }).click();
    await page.getByRole("menu", { name: "Options for Knapsack table walkthrough" }).getByRole("menuitem", { name: "Delete" }).click();
    await expect(chats.getByRole("group", { name: "Confirm deleting Knapsack table walkthrough" })).toBeVisible();
    const after = await composer.boundingBox();

    expect(before).not.toBeNull();
    expect(after?.y).toBe(before?.y);
  });

  test("settings: hiding retrieval timing, and Escape closes the popover", async ({ page }) => {
    await page.goto("/ask");
    const timing = page.getByRole("group", { name: "Time spent per step" });
    await expect(timing).toBeVisible();

    const gear = page.getByRole("button", { name: "Settings", exact: true });
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

  test("switching course stays on Ask and shows that course's starters and chats", async ({ page }) => {
    await page.goto("/ask");
    const courses = page.getByRole("complementary", { name: "Courses and chats" });
    await courses.getByRole("button", { name: /Operating Systems/ }).click();

    await expect(page).toHaveURL(/\/ask$/);
    await expect(courses.getByRole("button", { name: /Operating Systems/ })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Ask anything about Operating Systems." })).toBeVisible();
    await expect(courses.getByRole("link", { name: "Deadlock conditions" })).toBeVisible();
    await expect(courses.getByRole("link", { name: "DP vs greedy" })).toHaveCount(0);

    await page.getByRole("button", { name: "What are the four conditions for deadlock?" }).click();
    await expect(sources(page).getByText("Lec08_Synchronization.pdf").first()).toBeVisible();
  });

  test("a course with no documents points to Library and disables asking", async ({ page }) => {
    await page.goto("/ask");
    const courses = page.getByRole("complementary", { name: "Courses and chats" });
    await courses.getByRole("button", { name: /Linear Algebra/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Linear Algebra has no documents yet." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Ask about Linear Algebra" })).toBeDisabled();
  });

  test("a chat can be renamed inline", async ({ page }) => {
    await page.goto("/ask");
    const chats = page.getByRole("navigation", { name: "Chats" });
    await chats.getByRole("button", { name: "Options for Big-O vs Big-Theta" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const field = chats.getByRole("textbox", { name: "Rename chat" });
    await expect(field).toBeFocused();
    await field.fill("Asymptotic notation");
    await field.press("Enter");
    await expect(chats.getByRole("link", { name: "Asymptotic notation" })).toBeVisible();
    await expect(chats.getByRole("link", { name: "Big-O vs Big-Theta" })).toHaveCount(0);
  });

  test("pinning moves a chat into a Pinned group at the top, and Unpin moves it back", async ({ page }) => {
    await page.goto("/ask");
    const chats = page.getByRole("navigation", { name: "Chats" });
    await chats.getByRole("button", { name: "Options for Big-O vs Big-Theta" }).click();
    await page.getByRole("menuitem", { name: "Pin to top" }).click();
    await expect(chats.getByText("Pinned", { exact: true })).toBeVisible();
    // The pinned chat is now the first chat link in the list.
    await expect(chats.getByRole("link").first()).toContainText("Big-O vs Big-Theta");

    await chats.getByRole("button", { name: "Options for Big-O vs Big-Theta" }).click();
    await page.getByRole("menuitem", { name: "Unpin" }).click();
    await expect(chats.getByText("Pinned", { exact: true })).toHaveCount(0);
  });

  test("a chat menu near the bottom of the list stays fully on screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ask");
    const chats = page.getByRole("navigation", { name: "Chats" });
    const more = chats.getByRole("button", { name: "Options for Big-O vs Big-Theta" });
    await more.scrollIntoViewIfNeeded();
    await more.click();
    const box = await page.getByRole("menu", { name: "Options for Big-O vs Big-Theta" }).boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(720);
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  test("the glance card peeks at this course's PDFs without leaving Ask", async ({ page }) => {
    await page.goto("/ask");
    const side = page.getByRole("complementary", { name: "Courses and chats" });
    const docs = side.getByRole("button", { name: /^Documents/ });
    await expect(docs).toHaveAttribute("aria-expanded", "false");
    await docs.click();
    await expect(docs).toHaveAttribute("aria-expanded", "true");
    await expect(side.getByRole("list", { name: "Algorithms documents" }).getByRole("listitem")).toHaveCount(6);
    await expect(page).toHaveURL(/\/ask$/);
    await expect(side.getByRole("link", { name: "Manage in Library →" })).toHaveAttribute("href", "/library?course=algo");
    await expect(side.getByRole("link", { name: /Open Dyno/ })).toContainText("run 12");
  });

  test("the Settings × closes the popover", async ({ page }) => {
    await page.goto("/ask");
    const gear = page.getByRole("button", { name: "Settings", exact: true });
    await gear.click();
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect(gear).toHaveAttribute("aria-expanded", "false");
    await expect(gear).toBeFocused();
  });

  test("/ask?course=os opens on that course", async ({ page }) => {
    await page.goto("/ask?course=os");
    await expect(page.getByRole("heading", { level: 1, name: "Ask anything about Operating Systems." })).toBeVisible();
  });
});
