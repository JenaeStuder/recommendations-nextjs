import { expect, reachResults, test } from "./fixtures";

test.describe("swipe is a mobile-only way to browse", () => {
  test("is not offered on a desktop", async ({ page, openLibrary }, info) => {
    test.skip(info.project.name !== "desktop", "desktop only");
    void openLibrary;
    await reachResults(page);
    await expect(page.getByRole("group", { name: "How to browse" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Swipe" })).toHaveCount(0);
  });

  test("is offered on a phone, and a button can decide a book as well as a drag", async ({ page, openLibrary }, info) => {
    test.skip(info.project.name !== "mobile", "mobile only");
    void openLibrary;
    await reachResults(page);
    await page.getByRole("button", { name: "Swipe" }).click();
    await expect(page.getByRole("button", { name: "Swipe" })).toHaveAttribute("aria-pressed", "true");

    const like = page.getByRole("button", { name: "Like", exact: true });
    await like.click();
    await expect(page.getByText(/^Liked .*\. \d+ left\.$/)).toBeAttached();
    await expect(page.getByRole("button", { name: /My shelves \(1\)/ })).toBeVisible();

    // Back to the list, the liked book shows as liked there too.
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.locator("[data-book-index]").first()).toBeVisible();
  });
});
