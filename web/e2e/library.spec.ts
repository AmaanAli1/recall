import { expect, test, type Page } from "@playwright/test";

/** An in-memory file for setInputFiles; the mock API only looks at name/type. */
const file = (name: string, mimeType: string) => ({ name, mimeType, buffer: Buffer.from("%PDF-1.4 test") });
const PDF = file("Week7_Graphs.pdf", "application/pdf");

async function openLibrary(page: Page) {
  await page.goto("/library");
  await expect(page.getByRole("tab", { name: /Algorithms/ })).toBeVisible();
}

/** The hidden file input inside the drop zone (labelled by the current course). */
const fileInput = (page: Page) => page.getByLabel(/Upload PDFs to/);

test.describe("library", () => {
  test("tabs switch courses and show counts", async ({ page }) => {
    await openLibrary(page);
    const algo = page.getByRole("tab", { name: /Algorithms/ });
    await expect(algo).toHaveAttribute("aria-selected", "true");
    await expect(algo).toContainText("[6]");
    await expect(page.getByRole("tab", { name: /Operating Systems/ })).toContainText("[4]");

    await page.getByRole("tab", { name: /Operating Systems/ }).click();
    await expect(page.getByRole("tab", { name: /Operating Systems/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("Lec08_Synchronization.pdf");

    // Arrow keys move between tabs.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Statistics/ })).toBeFocused();
    await expect(page.getByRole("tab", { name: /Statistics/ })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: /Linear Algebra/ }).click();
    await expect(page.getByRole("heading", { name: "Nothing in Linear Algebra yet." })).toBeVisible();
  });

  test("a .pptx shows the PDFs-only slip, and Got it dismisses it", async ({ page }) => {
    await openLibrary(page);
    await fileInput(page).setInputFiles([
      file("Lecture7_Slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
    ]);
    // Next's route announcer is also role="alert", so pick ours by its text.
    const slip = page.getByRole("alert").filter({ hasText: "PDFs only, for now" });
    await expect(slip).toBeVisible();
    await expect(slip).toContainText("Lecture7_Slides.pptx");
    await expect(slip).toContainText("PowerPoint");
    await slip.getByRole("button", { name: "Got it" }).click();
    await expect(slip).toBeHidden();
  });

  test("choosing a PDF adds a row that reaches Ready @mobile", async ({ page }) => {
    await openLibrary(page);
    await fileInput(page).setInputFiles([PDF]);
    const row = page.getByRole("row", { name: /Week7_Graphs\.pdf/ });
    await expect(row).toContainText("Embedding passages…");
    await expect(row.getByRole("progressbar", { name: "Embedding Week7_Graphs.pdf" })).toBeAttached();
    await expect(row).toContainText("Ready", { timeout: 15_000 });
    await expect(page.getByRole("tab", { name: /Algorithms/ })).toContainText("[7]");
  });

  test("a mixed choose adds the PDF and skips the rest", async ({ page }) => {
    await openLibrary(page);
    await fileInput(page).setInputFiles([PDF, file("whiteboard_photo.png", "image/png")]);
    const slip = page.getByRole("alert").filter({ hasText: "Added 1 PDF. Skipped 1 file." });
    await expect(slip).toBeVisible();
    await expect(slip).toContainText("whiteboard_photo.png");
    await expect(slip).toContainText("Image");
    await expect(page.getByRole("row", { name: /Week7_Graphs\.pdf/ })).toBeVisible();
  });

  test("row menu opens and Escape closes it", async ({ page }) => {
    await openLibrary(page);
    const more = page.getByRole("button", { name: "More actions for Week6_DynamicProgramming.pdf" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("menu", { name: "More actions for Week6_DynamicProgramming.pdf" });
    await expect(menu.getByRole("menuitem", { name: "Ask about this document" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toHaveAttribute("aria-expanded", "false");
  });

  test("delete asks to confirm, and Undo restores the row", async ({ page }) => {
    await openLibrary(page);
    const name = "Week5_GreedyAlgorithms.pdf";
    await page.getByRole("button", { name: `More actions for ${name}` }).click();
    const menu = page.getByRole("menu", { name: `More actions for ${name}` });
    await menu.getByRole("menuitem", { name: "Delete" }).click();
    await expect(menu).toContainText("Recall forgets its 101 passages too.");
    await menu.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
    await expect(page.getByText(`${name} deleted, with its passages.`)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  });

  test("leaving mid-upload asks first, and Stay keeps you on the page", async ({ page }) => {
    await openLibrary(page);
    await fileInput(page).setInputFiles([PDF]);
    await expect(page.getByRole("row", { name: /Week7_Graphs\.pdf/ })).toContainText("Embedding passages…");

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dyno" }).click();
    const dialog = page.getByRole("alertdialog", { name: "1 upload is still in progress" });
    await expect(dialog).toBeVisible();
    const stay = dialog.getByRole("button", { name: "Stay until it finishes" });
    await expect(stay).toBeFocused();
    await stay.click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/library$/);
  });
});
