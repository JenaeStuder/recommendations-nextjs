import { expect, reachResults, test } from "./fixtures";

test.describe("the book modal", () => {
  test("opens on the back cover with a description, and Escape puts the book back and returns focus", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);

    const trigger = page.locator("[data-book-index] button").first();
    const title = (await trigger.textContent())!.trim();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/lantern-lit road/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Open Library/ })).toHaveAttribute("href", /openlibrary\.org/);
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes with the Close button", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);
    await page.locator("[data-book-index] button").first().click();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("traps focus inside while open", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);
    await page.locator("[data-book-index] button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Focus may leave the page for the browser's own controls, but it never lands on the page behind.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "browser";
        return el.closest("dialog") ? "dialog" : "page";
      });
      expect(where).not.toBe("page");
    }
  });

  test("with reduced motion, appears and disappears without the flight", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await reachResults(page);
    await page.locator("[data-book-index] button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // No card/shadow animation was started.
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().duration === 1200).length)).toBe(0);
  });
});
