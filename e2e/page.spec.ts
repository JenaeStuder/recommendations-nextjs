import { expect, test } from "./fixtures";

test.describe("the page itself", () => {
  test("has a title, a description and share-preview tags", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await expect(page).toHaveTitle("Your Next TBR");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /personalised book picks/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Your Next TBR");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image\.png/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  });

  test("has banner, main and footer landmarks, and credits Open Library", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Open Library" })).toHaveAttribute("href", "https://openlibrary.org");
    await expect(footer).toContainText("stay in this browser");
  });

  test("has exactly one h1", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("lets a keyboard user skip straight to the main content", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
  });

  test("shows a helpful page for an address that doesn't exist", async ({ page, openLibrary }) => {
    void openLibrary;
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "That page isn't on the shelf" })).toBeVisible();
    await page.getByRole("link", { name: "Find a book" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("the theme", () => {
  test("follows the system until a choice is made, then keeps the choice across reloads", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe("rgb(28, 20, 22)"); // dark paper

    const toggle = page.getByRole("button", { name: /^Theme:/ });
    await expect(toggle).toHaveText("Theme: Auto");

    await toggle.click(); // Light, even though the system is dark
    await expect(toggle).toHaveText("Theme: Light");
    expect(await bg()).toBe("rgb(245, 238, 227)");
    await expect(page.getByRole("status").filter({ hasText: "Theme set to light." })).toBeAttached();

    await page.reload();
    await expect(page.getByRole("button", { name: /^Theme:/ })).toHaveText("Theme: Light");
    expect(await bg()).toBe("rgb(245, 238, 227)");

    await page.getByRole("button", { name: /^Theme:/ }).click(); // Dark
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: /^Theme:/ }).click(); // back to Auto
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });

  test("is applied before the page paints, so a saved dark choice never flashes light", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.emulateMedia({ colorScheme: "light" });
    // Reads the theme the instant the document exists, before the app's JavaScript has run.
    await page.goto("/", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("dark");
  });

  test("ignores a tampered saved value", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.addInitScript(() => localStorage.setItem("theme", "<script>alert(1)</script>"));
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Theme:/ })).toHaveText("Theme: Auto");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });
});
