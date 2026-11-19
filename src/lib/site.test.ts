import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "./site";

describe("siteUrl", () => {
  it("depends only on its argument, never on the environment it runs in", () => {
    // CI sets GITHUB_REPOSITORY; your machine doesn't. Neither may change the answer for a given argument.
    const before = process.env.GITHUB_REPOSITORY;
    try {
      process.env.GITHUB_REPOSITORY = "someone/else";
      expect(siteUrl(undefined)).toBe("http://localhost:3000");
      delete process.env.GITHUB_REPOSITORY;
      expect(siteUrl(undefined)).toBe("http://localhost:3000");
    } finally {
      if (before === undefined) delete process.env.GITHUB_REPOSITORY;
      else process.env.GITHUB_REPOSITORY = before;
    }
  });

  it("is the GitHub Pages origin when run by GitHub Actions", () => {
    expect(siteUrl("JenaeStuder/recommendations-nextjs")).toBe("https://jenaestuder.github.io");
  });

  it("never includes the repo path: Next adds the base path itself, and including it here doubles it", () => {
    expect(new URL(siteUrl("JenaeStuder/recommendations-nextjs")).pathname).toBe("/");
  });

  it("falls back to localhost when there is no repository (your own machine)", () => {
    expect(siteUrl(undefined)).toBe("http://localhost:3000");
    expect(siteUrl("")).toBe("http://localhost:3000");
    expect(siteUrl("no-slash")).toBe("http://localhost:3000");
  });

  it("has no trailing slash, so paths can be appended safely", () => {
    expect(siteUrl("a/b").endsWith("/")).toBe(false);
  });
});

describe("site copy", () => {
  it("has a name and a description short enough for search and share previews", () => {
    expect(SITE_NAME.length).toBeGreaterThan(0);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("does not promise swipe, which is mobile-only", () => {
    expect(SITE_DESCRIPTION.toLowerCase()).not.toContain("swipe");
  });
});
