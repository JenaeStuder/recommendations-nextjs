import { appAlert, chooseFantasy, expect, reachResults, test } from "./fixtures";

test.describe("the question flow", () => {
  test("won't continue from genres until one is chosen, then reaches mood, audience and fine-tuning", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(page.getByRole("heading", { name: "What do you feel like reading?" })).toBeFocused();
    const next = page.getByRole("button", { name: "Next" });
    await expect(next).toBeDisabled();
    await expect(page.getByText("Choose at least one to continue.", { exact: true })).toBeVisible();

    // Mood and audience share this screen.
    await expect(page.getByRole("heading", { name: "What's the mood?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who's it for?" })).toBeVisible();

    await page.locator("label", { hasText: "Fantasy" }).click();
    await expect(next).toBeEnabled();
    await next.click();

    await expect(page.getByRole("heading", { name: "Fine-tune your picks" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Show my books" })).toBeVisible();
  });

  test("limits genres to three", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await page.getByRole("button", { name: "Skip" }).click();
    for (const g of ["Fantasy", "Mystery", "Thriller"]) await page.locator("label", { hasText: g }).click();
    await expect(page.getByRole("checkbox", { name: "Romance" })).toBeDisabled();
    await expect(page.getByText("(3 of 3 chosen)").first()).toBeVisible();
  });

  test("Back returns to the previous screen with the answers kept", async ({ page, openLibrary }) => {
    void openLibrary;
    await chooseFantasy(page);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("checkbox", { name: "Fantasy" })).toBeChecked();
  });

  test("fits each question screen on a laptop without scrolling", async ({ page, openLibrary }, info) => {
    test.skip(info.project.name !== "desktop", "a phone scrolls, as it must");
    void openLibrary;
    const fits = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Is there a book or author you love?" })).toBeVisible();
    expect(await fits(), "first screen").toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Skip" }).click();
    await page.locator("label", { hasText: "Fantasy" }).click();
    expect(await fits(), "genres, mood and audience").toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Fine-tune your picks" })).toBeVisible();
    expect(await fits(), "fine-tune").toBeLessThanOrEqual(0);
  });

  test("makes every chip in a question the same width", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await page.getByRole("button", { name: "Skip" }).click();
    // The ten genre chips come first.
    const widths = await page
      .locator("label[data-chip]")
      .evaluateAll((els) => els.slice(0, 10).map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(new Set(widths).size).toBe(1);
  });
});

test.describe("the results", () => {
  test("shows ranked books, 20 at a time, with a way to see more", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);
    await expect(page.locator("[data-book-index]")).toHaveCount(20);
    await expect(page.getByRole("status").filter({ hasText: "Showing 20 of" })).toBeVisible();
    await page.getByRole("button", { name: /show me more/i }).click();
    await expect(page.locator("[data-book-index]")).toHaveCount(40);
  });

  test("draws a designed cover for a book with no cover image", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);
    await expect(page.getByRole("img", { name: /No cover available for/ }).first()).toBeVisible();
  });

  test("explains what went wrong when Open Library is rate limiting, and recovers on Try again", async ({ page, openLibrary }) => {
    openLibrary.respond("rate-limit");
    await chooseFantasy(page);
    await page.getByRole("button", { name: "Show my books" }).click();

    const alert = appAlert(page);
    await expect(alert).toContainText("Give it a minute");

    openLibrary.respond("books");
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("[data-book-index]").first()).toBeVisible();
  });

  test("says so, and what to try, when nothing matches", async ({ page, openLibrary }) => {
    openLibrary.respond("empty");
    await chooseFantasy(page);
    await page.getByRole("button", { name: "Show my books" }).click();
    await expect(page.getByRole("status").filter({ hasText: /couldn.t find books/i })).toBeVisible();
  });

  test("'Start A New Search' goes back to a blank first screen", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);
    await page.getByRole("button", { name: /start a new search/i }).click();
    await expect(page.getByRole("heading", { name: "Is there a book or author you love?" })).toBeVisible();
  });
});
