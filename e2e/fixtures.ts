import { test as base, expect, type Page, type Route } from "@playwright/test";

/**
 * A fake Open Library, so end-to-end tests are fast and never fail because someone else's server is
 * slow. It answers the same URLs the app calls, with the same response shapes.
 */

type Doc = {
  key: string;
  title: string;
  author_name: string[];
  author_key: string[];
  first_publish_year: number;
  number_of_pages_median: number;
  ratings_average: number;
  ratings_count: number;
  subject: string[];
  cover_i?: number;
};

/** `n` distinct fantasy books by distinct authors (the app caps how many come from one author). Every third has no cover. */
export function makeDocs(n: number): Doc[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `/works/OL${i + 1}W`,
    title: `The Lantern Road ${i + 1}`,
    author_name: [`Author Number${i + 1}`],
    author_key: [`OL${i + 1}A`],
    first_publish_year: 2005 + (i % 15),
    number_of_pages_median: 250 + i * 7,
    ratings_average: 4.6 - (i % 10) * 0.05,
    ratings_count: 400 - i * 5,
    subject: ["Fantasy", "Dragons", "Magic", "Quests"],
    cover_i: i % 3 === 2 ? undefined : 1000 + i,
  }));
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export type Fake = {
  /** How many search requests were made. */
  searches: () => number;
  /** Make every search answer like this (default: books). */
  respond: (mode: "books" | "empty" | "rate-limit") => void;
};

export async function fakeOpenLibrary(page: Page): Promise<Fake> {
  let mode: "books" | "empty" | "rate-limit" = "books";
  let searches = 0;
  const docs = makeDocs(40);

  await page.route("**/openlibrary.org/search.json**", async (route: Route) => {
    searches++;
    if (mode === "rate-limit") return route.fulfill({ status: 429, body: "slow down" });
    if (mode === "empty") return route.fulfill({ json: { numFound: 0, docs: [] } });
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    // A lookup by work id (shared links): answer with just those books.
    const wanted = [...q.matchAll(/\/works\/(OL\d+W)/g)].map((m) => m[1]);
    const found = wanted.length > 0 ? docs.filter((d) => wanted.includes(d.key.replace("/works/", ""))) : docs;
    return route.fulfill({ json: { numFound: found.length, docs: found } });
  });

  await page.route("**/openlibrary.org/search/authors.json**", (route) =>
    route.fulfill({ json: { numFound: 0, docs: [] } }),
  );

  await page.route("**/openlibrary.org/works/*.json", (route) =>
    route.fulfill({
      json: { description: "A lantern-lit road leads a young cartographer into a kingdom that is not on any map." },
    }),
  );

  await page.route("**/covers.openlibrary.org/**", (route) =>
    route.fulfill({ body: PNG_1X1, contentType: "image/png" }),
  );

  return {
    searches: () => searches,
    respond: (m) => {
      mode = m;
    },
  };
}

type Fixtures = { openLibrary: Fake };

/** `test` with Open Library already faked. Every test also gets a fresh browser, so no saved shelf or theme leaks between them. */
export const test = base.extend<Fixtures>({
  // (The callback's name is `provide`, not Playwright's usual `use`, which the React hooks lint rule mistakes for a hook.)
  openLibrary: async ({ page }, provide) => {
    await provide(await fakeOpenLibrary(page));
  },
});

export { expect };

/** Answers the first two screens: skip the book/author screen, pick Fantasy, continue to "Fine-tune". */
export async function chooseFantasy(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.locator("label", { hasText: "Fantasy" }).click();
  await page.getByRole("button", { name: "Next" }).click();
}

/** The first result's whole card (the list item), not just its heading. */
export const firstCard = (page: Page) => page.locator("li").filter({ has: page.locator("[data-book-index]") }).first();

/** The app's own alerts (Next also has an invisible one that announces page changes). */
export const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Goes all the way to the results. */
export async function reachResults(page: Page) {
  await chooseFantasy(page);
  await page.getByRole("button", { name: "Show my books" }).click();
  await expect(page.getByRole("heading", { name: "Your picks" })).toBeVisible();
  await expect(page.locator("[data-book-index]").first()).toBeVisible();
}
