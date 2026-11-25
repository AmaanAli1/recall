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

/** A PDF just over the demo's 25 MB limit (the browser checks file.size). */
const BIG_PDF = { name: "Week6_Full_Lecture.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(25 * 1024 * 1024 + 1) };

/** Sample courses can't be changed or take uploads, so those tests use a course of your own. */
async function makeOwnCourse(page: Page, name: string) {
  await page.getByRole("button", { name: "New course" }).click();
  const dialog = page.getByRole("dialog", { name: "New course" });
  await dialog.getByRole("textbox", { name: "Course name" }).fill(name);
  await dialog.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("tab", { name: new RegExp(name) })).toHaveAttribute("aria-selected", "true");
}

test.describe("library", () => {
  test("tabs switch courses and show counts", async ({ page }) => {
    await openLibrary(page);
    const algo = page.getByRole("tab", { name: /Algorithms/ });
    await expect(algo).toHaveAttribute("aria-selected", "true");
    await expect(algo).toContainText("[4]"); // the 4 Erickson chapters, as on the real site
    // Exactly the two sample courses.
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expect(page.getByRole("tab", { name: /Everyday Math/ })).toContainText("[0]");

    // Arrow keys move between tabs.
    await algo.focus();
    await page.keyboard.press("ArrowRight");
    const math = page.getByRole("tab", { name: /Everyday Math/ });
    await expect(math).toBeFocused();
    await expect(math).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Nothing in Everyday Math yet." })).toBeVisible();
  });

  test("a .pptx shows the PDFs-only slip, and Got it dismisses it", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "My notes"); // sample courses take no uploads
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
    await makeOwnCourse(page, "My notes"); // sample courses take no uploads
    await expect(page.getByText("Drop lecture PDFs into My notes")).toBeVisible();
    await fileInput(page).setInputFiles([PDF]);
    const row = page.getByRole("row", { name: /Week7_Graphs\.pdf/ });
    await expect(row).toContainText("Embedding passages…");
    await expect(row.getByRole("progressbar", { name: "Embedding Week7_Graphs.pdf" })).toBeAttached();
    await expect(row).toContainText("Ready", { timeout: 15_000 });
    await expect(page.getByRole("tab", { name: /My notes/ })).toContainText("[1]");
  });

  test("a mixed choose adds the PDF and skips the rest", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "My notes"); // sample courses take no uploads
    await fileInput(page).setInputFiles([PDF, file("whiteboard_photo.png", "image/png")]);
    const slip = page.getByRole("alert").filter({ hasText: "Added 1 PDF. Skipped 1 file." });
    await expect(slip).toBeVisible();
    await expect(slip).toContainText("whiteboard_photo.png");
    await expect(slip).toContainText("Image");
    await expect(page.getByRole("row", { name: /Week7_Graphs\.pdf/ })).toBeVisible();
  });

  test("row menu offers only what works on a sample document, and Escape closes it", async ({ page }) => {
    await openLibrary(page);
    const more = page.getByRole("button", { name: "More actions for Erickson_Ch3_DynamicProgramming.pdf" });
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("menu", { name: "More actions for Erickson_Ch3_DynamicProgramming.pdf" });
    // Shared sample documents: ask about the course or open the author's PDF, nothing that edits them.
    await expect(menu.getByRole("menuitem")).toHaveText(["Ask about this course", "Open the original PDF"]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toHaveAttribute("aria-expanded", "false");
  });

  test("in your own course, delete asks to confirm, and Undo restores the row", async ({ page }) => {
    await openLibrary(page);
    // Only your own documents can be deleted, so make a course with one first.
    await page.getByRole("button", { name: "New course" }).click();
    const dialog = page.getByRole("dialog", { name: "New course" });
    await dialog.getByRole("textbox", { name: "Course name" }).fill("My notes");
    await dialog.getByLabel("Lecture PDFs").setInputFiles([PDF]);
    await dialog.getByRole("button", { name: "Create and add 1 PDF" }).click();
    const name = "Week7_Graphs.pdf";
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Ready", { timeout: 15_000 });

    await page.getByRole("button", { name: `More actions for ${name}` }).click();
    const menu = page.getByRole("menu", { name: `More actions for ${name}` });
    await expect(menu.getByRole("menuitem")).toHaveText(["Ask about this course", "Delete"]);
    await menu.getByRole("menuitem", { name: "Delete" }).click();
    await expect(menu).toContainText("passages too.");
    await menu.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
    await expect(page.getByText(`${name} deleted, with its passages.`)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  });

  test("leaving mid-upload asks first, and Stay keeps you on the page", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "My notes"); // sample courses take no uploads
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

  test("New course: duplicate names are caught, then the course is created and opened @mobile", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "New course" }).click();
    const dialog = page.getByRole("dialog", { name: "New course" });
    await expect(dialog).toBeVisible();
    const name = dialog.getByRole("textbox", { name: "Course name" });
    await expect(name).toBeFocused();

    await name.fill("  algorithms ");
    await expect(dialog.getByText("You already have a course called algorithms.")).toBeVisible();

    await name.fill("Data Structures");
    await dialog.getByRole("textbox", { name: /Course code/ }).fill("cp213");
    await dialog.getByRole("radio", { name: "Rust" }).click();
    await dialog.getByRole("button", { name: "Create course" }).click();

    await expect(dialog).toBeHidden();
    const tab = page.getByRole("tab", { name: /CP213 · Data Structures/ });
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Nothing in Data Structures yet." })).toBeVisible();

    // One course of your own is the demo's limit (the sample courses don't count).
    await page.getByRole("button", { name: "New course" }).click();
    const full = page.getByRole("dialog", { name: "Course limit reached" });
    await expect(full).toContainText("You already have a course of your own.");
    await full.getByRole("button", { name: "Got it" }).click();
    await expect(full).toBeHidden();
  });

  test("New course says the demo limit, counting only your own courses", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "New course" }).click();
    await expect(page.getByRole("dialog", { name: "New course" })).toContainText("Demo limit: 1 course of your own");
  });

  test("New course: Escape after typing asks before discarding", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "New course" }).click();
    const dialog = page.getByRole("dialog", { name: "New course" });
    await dialog.getByRole("textbox", { name: "Course name" }).fill("Networks");
    await page.keyboard.press("Escape");
    const ask = dialog.getByRole("group", { name: "Discard changes?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Keep editing" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("tab", { name: /Networks/ })).toHaveCount(0);
  });

  test("a new course with PDFs uploads them and offers to ask once they're ready", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "New course" }).click();
    const dialog = page.getByRole("dialog", { name: "New course" });
    await dialog.getByRole("textbox", { name: "Course name" }).fill("Networks");
    await dialog.getByLabel("Lecture PDFs").setInputFiles([PDF]);
    await expect(dialog.getByRole("list", { name: "PDFs to add" })).toContainText("Week7_Graphs.pdf");
    await dialog.getByRole("button", { name: "Create and add 1 PDF" }).click();
    await expect(page.getByRole("tab", { name: /Networks/ })).toHaveAttribute("aria-selected", "true");
    const go = page.getByRole("link", { name: "Ask about Networks →" });
    await expect(go).toBeVisible({ timeout: 15_000 });
    await expect(go).toHaveAttribute("href", /\/ask\?course=/);
  });

  test("archive hides a course behind the Archived toggle, and Unarchive brings it back", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "Networks");
    await page.getByRole("button", { name: "Options for Networks" }).click();
    await page.getByRole("menuitem", { name: /^Archive/ }).click();
    await expect(page.getByRole("tab", { name: /Networks/ })).toHaveCount(0);

    const toggle = page.getByRole("button", { name: /^Archived/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("tab", { name: /Networks/ }).click();
    await page.getByRole("button", { name: "Unarchive" }).click();
    await expect(page.getByRole("button", { name: /^Archived/ })).toHaveCount(0);
  });

  test("deleting a course asks first, and Undo restores it", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "Networks");
    await page.getByRole("button", { name: "Options for Networks" }).click();
    await page.getByRole("menuitem", { name: /^Delete course/ }).click();
    await page.getByRole("menu", { name: "Options for Networks" }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("tab", { name: /Networks/ })).toHaveCount(0);
    await expect(page.getByText("Networks deleted, with its PDFs and chats.")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("tab", { name: /Networks/ })).toHaveAttribute("aria-selected", "true");
  });

  test("a sample course's menu offers nothing to change, and says why @mobile", async ({ page }) => {
    await openLibrary(page);
    for (const name of ["Algorithms", "Everyday Math"]) {
      await page.getByRole("tab", { name: new RegExp(name) }).click();
      await page.getByRole("button", { name: `Options for ${name}` }).click();
      const menu = page.getByRole("menu", { name: `Options for ${name}` });
      const item = menu.getByRole("menuitem");
      await expect(item).toHaveCount(1);
      await expect(item).toHaveAttribute("aria-disabled", "true");
      await expect(item).toContainText("Shared by every visitor, so it can’t be edited, archived or deleted.");
      await expect(item).toBeFocused();
      // Fully on screen, also on a phone where the button wraps to the left edge.
      const box = await menu.boundingBox();
      const width = page.viewportSize()?.width ?? 0;
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    }
  });

  test("a sample course takes no PDFs: every way in shows the error, and nothing is added @mobile", async ({ page }) => {
    await openLibrary(page);
    const zone = page.getByText("Algorithms is a sample course");
    await expect(zone).toBeVisible();
    await expect(page.getByText("It’s shared by every visitor, so PDFs can’t be added here.")).toBeVisible();
    const slip = page.getByRole("alert").filter({ hasText: "Sample courses can’t be changed" });

    // 1. Files given to the input (what a drop or the picker does).
    await fileInput(page).setInputFiles([PDF]);
    await expect(slip).toBeVisible();
    await expect(slip).toContainText("Algorithms is shared by every visitor, so PDFs can’t be added to it.");
    await expect(slip.getByRole("listitem")).toHaveText("Week7_Graphs.pdfNot added");
    await expect(page.getByRole("row", { name: /Week7_Graphs\.pdf/ })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Algorithms/ })).toContainText("[4]");
    await slip.getByRole("button", { name: "Got it" }).click();
    await expect(slip).toBeHidden();

    // 2. Clicking Choose files shows the error instead of a file picker.
    const chooser = page.waitForEvent("filechooser", { timeout: 1_000 }).then(() => true, () => false);
    await page.getByText("Choose files").click();
    await expect(slip).toBeVisible();
    expect(await chooser).toBe(false);
    await slip.getByRole("button", { name: "Got it" }).click();

    // 3. The U shortcut too, on Everyday Math.
    await page.getByRole("tab", { name: /Everyday Math/ }).click();
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("u");
    await expect(page.getByRole("alert").filter({ hasText: "Everyday Math is shared by every visitor" })).toBeVisible();

    // New course is the way forward.
    await page.getByRole("alert").getByRole("button", { name: "New course" }).click();
    await expect(page.getByRole("dialog", { name: "New course" })).toBeVisible();
  });

  test("the drop zone states the 25 MB limit, and a bigger PDF is skipped with its size", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "My notes"); // sample courses take no uploads
    await expect(page.getByText("up to 25 MB each (a demo limit, for now)")).toBeVisible();
    await fileInput(page).setInputFiles([BIG_PDF, PDF]);
    const slip = page.getByRole("alert").filter({ hasText: "Added 1 PDF. Skipped 1 file." });
    await expect(slip).toBeVisible();
    await expect(slip).toContainText("up to 25 MB each in this demo, for now");
    await expect(slip.getByRole("listitem")).toHaveText("Week6_Full_Lecture.pdf25.1 MB");
    await expect(page.getByRole("row", { name: /Week7_Graphs\.pdf/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Week6_Full_Lecture\.pdf/ })).toHaveCount(0);
  });

  test("New course skips a PDF over 25 MB and names it", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "New course" }).click();
    const dialog = page.getByRole("dialog", { name: "New course" });
    await expect(dialog).toContainText("up to 25 MB each");
    await dialog.getByLabel("Lecture PDFs").setInputFiles([BIG_PDF, PDF]);
    await expect(dialog.getByText("Skipped Week6_Full_Lecture.pdf (25.1 MB): over the 25 MB limit for now.")).toBeVisible();
    await expect(dialog.getByRole("list", { name: "PDFs to add" })).toHaveText(/Week7_Graphs\.pdf/);
    await expect(dialog.getByRole("list", { name: "PDFs to add" })).not.toContainText("Week6_Full_Lecture.pdf");
  });

  test("Run OCR reads the scan, then the document becomes Ready", async ({ page }) => {
    await openLibrary(page);
    await makeOwnCourse(page, "My notes");
    // The mock treats a file named like a scan as a PDF with no text layer.
    await fileInput(page).setInputFiles([file("Midterm_Review_Scan.pdf", "application/pdf")]);
    const row = page.getByRole("row", { name: /Midterm_Review_Scan\.pdf/ });
    await row.getByRole("button", { name: "Run OCR on Midterm_Review_Scan.pdf" }).click();
    await expect(row).toContainText("Reading scanned pages (OCR)…");
    await expect(row).toContainText("Ready", { timeout: 15_000 });
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

  test("/library?course=<id> opens on that course", async ({ page }) => {
    await page.goto("/library?course=00000000-0000-0000-0000-00000000c004");
    await expect(page.getByRole("tab", { name: /Everyday Math/ })).toHaveAttribute("aria-selected", "true");
  });
});
