import { expect, firstCard, reachResults, test } from "./fixtures";

test.describe("liking and saving", () => {
  test("Like and Save keep their place in My shelves, and survive a reload", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);

    const first = firstCard(page);
    const title = (await first.locator("[data-book-index] button").textContent())!.trim();
    await first.getByRole("button", { name: "Like" }).click();
    await expect(first.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "My shelves (1)" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "My shelves (1)" })).toBeVisible();
    await page.getByRole("button", { name: "My shelves (1)" }).click();
    await expect(page.getByRole("heading", { name: "My shelves" })).toBeFocused();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("a book can be removed from a shelf, and the empty shelf explains itself", async ({ page, openLibrary }) => {
    void openLibrary;
    await reachResults(page);
    await firstCard(page).getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "My shelves (1)" }).click();
    await page.getByRole("button", { name: /remove/i }).first().click();
    await expect(page.getByRole("button", { name: "My shelves" })).toBeVisible();
    await expect(page.getByText(/nothing|empty|no books/i).first()).toBeVisible();
  });
});

test.describe("shared shelves", () => {
  test("a shared link shows those books, in the link's order, and can be saved to your own shelf", async ({ page, openLibrary }) => {
    void openLibrary;
    await page.goto("/?shelf=OL3W,OL1W&list=to-read");
    await expect(page.getByRole("heading", { name: /shared shelf/i })).toBeVisible();
    // Order comes from the link: 3 before 1.
    const titles = page.getByRole("heading", { level: 3 });
    await expect(titles).toHaveText(["The Lantern Road 3", "The Lantern Road 1"]);
    await page.getByRole("button", { name: /save all 2/i }).click();
    await expect(page.getByRole("button", { name: /My shelves \(2\)/ })).toBeVisible();
  });

  test("ignores a malformed link instead of passing it to the search", async ({ page, openLibrary }) => {
    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      void d.dismiss();
    });
    await page.goto("/?shelf=not-an-id,<script>alert(1)</script>");
    await expect(page.getByRole("heading", { name: "A shared shelf" })).toBeVisible();
    await expect(page.getByText(/doesn.t have any books in it/)).toBeVisible();
    expect(openLibrary.searches()).toBe(0); // nothing malformed reached the search
    expect(dialogs).toBe(0); // and nothing was run as a script
  });
});
