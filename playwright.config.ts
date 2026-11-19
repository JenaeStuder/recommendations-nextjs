import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real static build (`out/`), the same files that get deployed,
 * in desktop and phone-sized Chrome. Open Library is faked (see e2e/fixtures.ts), so they are fast,
 * work offline and never flake because of someone else's server.
 *
 * `pnpm test:e2e` builds first. It uses the Chrome already installed on the machine (GitHub's
 * runners have it too) rather than downloading a browser.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "on-first-retry",
    // Tests must not depend on a saved theme or shelf from an earlier test: every test gets a fresh browser context.
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 720 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `pnpm exec serve out -l ${PORT} --no-request-logging`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
