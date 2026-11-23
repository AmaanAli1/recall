import { expect, test } from "@playwright/test";

test.describe("demo boot", () => {
  test("fresh visitor gets a session card and opens the notebook @mobile", async ({ page }) => {
    await page.goto("/demo");

    const steps = page.getByRole("listitem");
    for (const label of [
      "Creating your private session",
      "Opening the sample courses",
      "Warming up search and the reranker",
    ]) {
      await expect(steps.filter({ hasText: label })).toContainText("done");
    }

    await expect(page.getByRole("heading", { level: 1, name: "Your demo notebook is ready." })).toBeVisible();
    await expect(page.getByText(/demo-[A-Z0-9]{4}-[A-Z0-9]{2}/)).toBeVisible();
    await expect(page.getByText("2 sample courses · 6 lecture PDFs")).toBeVisible();

    // A full page load, not an in-app jump: with real sessions, an in-app jump would
    // re-use the session gate's cached redirect and land back on /demo (PR #45).
    await page.evaluate(() => ((window as unknown as { __sameDocument?: boolean }).__sameDocument = true));
    await page.getByRole("link", { name: /Open my notebook/ }).click();
    await expect(page).toHaveURL(/\/ask$/);
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBeUndefined();
  });

  test("Enter on the ready card also opens the notebook with a full page load", async ({ page }) => {
    await page.goto("/demo?next=%2Flibrary");
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __sameDocument?: boolean }).__sameDocument = true));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/library$/);
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBeUndefined();
  });

  test("replay re-runs the card without issuing a new session", async ({ page }) => {
    await page.goto("/demo");
    const sid = page.getByText(/demo-[A-Z0-9]{4}-[A-Z0-9]{2}/);
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible();
    const first = await sid.textContent();

    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.getByRole("heading", { name: "Preparing your demo session…" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible();
    await expect(sid).toHaveText(first ?? "");
  });

  test("?next= continues to the page the visitor wanted (sent here by the session gate)", async ({ page }) => {
    await page.goto("/demo?next=%2Flibrary%3Fcourse%3D00000000-0000-0000-0000-00000000c001");
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible();
    await page.getByRole("link", { name: /Open my notebook/ }).click();
    await expect(page).toHaveURL(/\/library\?course=00000000-0000-0000-0000-00000000c001$/);
  });

  test("?next= can't send anyone off the site or to another page", async ({ page }) => {
    // A fresh visitor: the notebook link falls back to Ask.
    await page.goto("/demo?next=https%3A%2F%2Fevil.example");
    await expect(page.getByRole("heading", { name: "Your demo notebook is ready." })).toBeVisible(); // session issued
    await expect(page.getByRole("link", { name: /Open my notebook/ })).toHaveAttribute("href", "/ask");
    // Now with a session, /demo redirects straight away: still only ever to Ask.
    for (const next of ["https%3A%2F%2Fevil.example", "%2F%2Fevil.example", "%2Fdyno"]) {
      await page.goto(`/demo?next=${next}`);
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/ask$/);
    }
  });

  test("returning visitor with a session goes straight to the page in ?next=", async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      window.localStorage.setItem("recall-demo", JSON.stringify({ id: "demo-AB12-CD", createdAt: now, lastActiveAt: now }));
    });
    await page.goto("/demo?next=%2Flibrary");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("returning visitor with a session skips straight to Ask", async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      window.localStorage.setItem("recall-demo", JSON.stringify({ id: "demo-AB12-CD", createdAt: now, lastActiveAt: now }));
    });
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/ask$/);
  });
});

  // Start fresh must really delete the session and issue a new one.
  // Once sessions are real, this same test exercises the real DELETE endpoint
  // and a brand-new anonymous sign-in. Tagged @mobile so it runs on a phone too.
  test("Start fresh deletes the session and issues a new one @mobile", async ({ page }) => {
    // 1. Get a session the way a visitor does: through the boot screen.
    await page.goto("/demo");
    const ready = page.getByRole("heading", { name: "Your demo notebook is ready." });
    await expect(ready).toBeVisible();

    // Remember the first code so we can compare later.
    // A locator is a *recipe* for finding an element, re-run every time it's used.
    const code = page.getByText(/demo-[A-Z0-9]{4}-[A-Z0-9]{2}/);
    const firstCode = (await code.textContent()) ?? "";
    expect(firstCode).toMatch(/^demo-/); // plain expect: checks once, no retrying

    // 2. Go into the app.
    await page.getByRole("link", { name: /Open my notebook/ }).click();
    await expect(page).toHaveURL(/\/ask$/);

    // 3. Open the demo chip; the popover should show the same session.
    await page.getByRole("button", { name: /Demo · kept 24/ }).click();
    const dialog = page.getByRole("dialog", { name: "Your demo session" });
    await expect(dialog).toContainText(firstCode);

    // 4. Start fresh, then confirm. (The shell test stops before this click.)
    await dialog.getByRole("button", { name: "Start fresh" }).click();
    await dialog.getByRole("button", { name: "Delete and restart" }).click();

    // 5. Back on the boot screen with a different session.
    // `code` re-finds the element on the new page; not.toHaveText retries.
    await expect(page).toHaveURL(/\/demo$/);
    await expect(ready).toBeVisible();
    await expect(code).not.toHaveText(firstCode);
  });
