import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { chooseFantasy, expect, firstCard, reachResults, test } from "./fixtures";

/**
 * An automated accessibility audit of every screen and state, in both colour themes, against all of
 * WCAG A, AA and AAA (that includes the enhanced 7:1 contrast rule) plus axe's best practices.
 * Automated checks find roughly a third of real problems, so this complements, and doesn't replace,
 * keyboard and screen-reader testing. It does stop regressions.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function audit(page: Page) {
  // Let any animation finish first: mid-fade colours would give false contrast results.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // A readable failure: which rule, how bad, and which elements.
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `    ${n.target.join(" ")}  ${n.failureSummary?.split("\n")[1] ?? ""}`).join("\n")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${scheme} theme`, () => {
    test.beforeEach(async ({ page, openLibrary }) => {
      void openLibrary;
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    });

    test("first screen: a book or author you love", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Is there a book or author you love?" })).toBeVisible();
      await audit(page);
    });

    test("genres, mood and audience", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Skip" }).click();
      await audit(page);
      await page.locator("label", { hasText: "Fantasy" }).click(); // with a chip selected
      await audit(page);
    });

    test("fine-tune your picks", async ({ page }) => {
      await chooseFantasy(page);
      await audit(page);
    });

    test("results", async ({ page }) => {
      await reachResults(page);
      await audit(page);
    });

    test("results with a book liked and another saved", async ({ page }) => {
      await reachResults(page);
      await firstCard(page).getByRole("button", { name: "Like" }).click();
      await page.locator("li").filter({ has: page.locator("[data-book-index]") }).nth(1).getByRole("button", { name: "Save" }).click();
      await audit(page);
    });

    test("a book's back cover (the modal)", async ({ page }) => {
      await reachResults(page);
      await page.locator("[data-book-index] button").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page);
    });

    test("my shelves, empty and with books", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "My shelves" }).click();
      await audit(page);
      await page.getByRole("button", { name: "My shelves" }).click();
      await page.getByRole("button", { name: "Skip" }).click();
      await page.locator("label", { hasText: "Fantasy" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Show my books" }).click();
      await firstCard(page).getByRole("button", { name: "Like" }).click();
      await firstCard(page).getByRole("button", { name: "Save" }).click();
      await page.getByRole("button", { name: /My shelves/ }).click();
      await audit(page);
    });

    test("a shared shelf", async ({ page }) => {
      await page.goto("/?shelf=OL1W,OL2W&list=liked");
      await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
      await audit(page);
    });

    test("the rate-limit error and the empty result", async ({ page, openLibrary }) => {
      openLibrary.respond("rate-limit");
      await chooseFantasy(page);
      await page.getByRole("button", { name: "Show my books" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible();
      await audit(page);

      openLibrary.respond("empty");
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByRole("status").filter({ hasText: /couldn.t find books/i })).toBeVisible();
      await audit(page);
    });

    test("the 404 page", async ({ page }) => {
      await page.goto("/no-such-page");
      await expect(page.getByRole("heading", { name: "That page isn't on the shelf" })).toBeVisible();
      await audit(page);
    });
  });
}

test.describe("accessibility, swipe deck (phone)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`the deck, ${scheme} theme`, async ({ page, openLibrary }, info) => {
      test.skip(info.project.name !== "mobile", "the deck is mobile-only");
      void openLibrary;
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await reachResults(page);
      await page.getByRole("button", { name: "Swipe" }).click();
      await expect(page.getByRole("button", { name: "Like", exact: true })).toBeVisible();
      await audit(page);
    });
  }
});
