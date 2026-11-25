import { expect, test, type Page } from "@playwright/test";

// The Library is read-only since 2026-11-25 (Algorithms-only demo): one shared course,
// its four Erickson chapters, no uploads and no courses of your own.

async function openLibrary(page: Page) {
  await page.goto("/library");
  await expect(page.getByRole("heading", { level: 2, name: "Algorithms" })).toBeVisible();
}

test.describe("library", () => {
  test("shows the demo's one course and its 4 chapters, read-only @mobile", async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByText("The demo’s one course, shared by every visitor and read-only.")).toBeVisible();
    for (const name of [
      "Erickson_Ch1_Recursion.pdf",
      "Erickson_Ch3_DynamicProgramming.pdf",
      "Erickson_Ch4_GreedyAlgorithms.pdf",
      "Erickson_Ch8_ShortestPaths.pdf",
    ]) {
      await expect(page.getByText(name)).toBeVisible();
    }
    // Nothing that adds or changes anything is left on the page.
    await expect(page.getByRole("button", { name: /New course|Choose files|Upload|Delete|Run OCR/ })).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("says uploads aren't part of the demo, and links to why", async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByText("Uploading your own PDFs isn’t part of this demo.")).toBeVisible();
    await page.getByRole("link", { name: /Why, and what this demo covers/ }).click();
    await expect(page).toHaveURL(/\/#about-this-demo$/);
    await expect(page.getByRole("heading", { level: 2, name: "About this demo." })).toBeInViewport();
  });

  test("row menu offers only Ask and Open the original, and Escape closes it", async ({ page }) => {
    await openLibrary(page);
    const more = page.getByRole("button", { name: "More actions for Erickson_Ch3_DynamicProgramming.pdf" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("menu", { name: "More actions for Erickson_Ch3_DynamicProgramming.pdf" });
    await expect(menu.getByRole("menuitem")).toHaveText(["Ask about this course", "Open the original PDF"]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toHaveAttribute("aria-expanded", "false");
  });

  test("Ask about this course goes to Ask on Algorithms", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "More actions for Erickson_Ch1_Recursion.pdf" }).click();
    await page.getByRole("menuitem", { name: "Ask about this course" }).click();
    await expect(page).toHaveURL(/\/ask/);
    const courses = page.getByRole("complementary", { name: "Courses and chats" });
    await expect(courses.getByRole("button", { name: /Algorithms/ })).toHaveAttribute("aria-current", "true");
  });

  test("the last row's menu opens fully on screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openLibrary(page);
    const more = page.getByRole("button", { name: "More actions for Erickson_Ch8_ShortestPaths.pdf" });
    await more.scrollIntoViewIfNeeded();
    await more.click();
    const box = await page.getByRole("menu", { name: "More actions for Erickson_Ch8_ShortestPaths.pdf" }).boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(720);
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  test("old /library?course=<id> links still open the Library", async ({ page }) => {
    // c001 is Algorithms; c004 was Everyday Math (removed 2026-11-24).
    for (const id of ["00000000-0000-0000-0000-00000000c001", "00000000-0000-0000-0000-00000000c004"]) {
      await page.goto(`/library?course=${id}`);
      await expect(page.getByRole("heading", { level: 2, name: "Algorithms" })).toBeVisible();
    }
  });
});

test.describe("about this demo", () => {
  test("the footer and the demo chip both link to the landing section", async ({ page }) => {
    // The chip only shows for a visitor with a session (mock mode keeps it in localStorage).
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      window.localStorage.setItem("recall-demo", JSON.stringify({ id: "demo-AB12-CD", createdAt: now, lastActiveAt: now }));
    });
    await page.goto("/library");
    await page.getByRole("contentinfo").getByRole("link", { name: "About this demo" }).click();
    await expect(page).toHaveURL(/\/#about-this-demo$/);
    const about = page.locator("#about-this-demo");
    await expect(about).toContainText("Jeff Erickson’s Algorithms");
    await expect(about).toContainText("Uploading your own PDFs isn’t part of this demo.");
    await expect(about.getByRole("link", { name: "the Dyno page" })).toHaveAttribute("href", "/dyno");

    await page.goto("/library");
    await page.getByRole("button", { name: /Demo · kept 24/ }).click();
    await page.getByRole("dialog", { name: "Your demo session" }).getByRole("link", { name: "About this demo →" }).click();
    await expect(page).toHaveURL(/\/#about-this-demo$/);
  });
});
