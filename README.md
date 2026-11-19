# Your Next TBR

**Live site: [jenaestuder.github.io/recommendations-nextjs](https://jenaestuder.github.io/recommendations-nextjs/)**

Answer a few questions and get personalised book picks you can browse, like, save and share. It is a front-end portfolio project: no backend, no sign-in, no paid hosting. Everything runs in the browser and is deployed as a static site.

Recommendations are built in the browser from [Open Library](https://openlibrary.org) data, because neither Open Library nor Google Books offers a recommendations endpoint for anonymous users.

## Technologies and what they are for

| Technology | Purpose |
|---|---|
| [Next.js](https://nextjs.org) 16 (App Router) | The app framework. Configured with `output: 'export'` so it builds to plain static files in `out/`. |
| [React](https://react.dev) 19 | UI components and state. |
| [TypeScript](https://www.typescriptlang.org) 5 | Static typing across the app, including the Open Library response types. |
| [Tailwind CSS](https://tailwindcss.com) v4 | Styling. The theme (colours, fonts) lives in CSS tokens in `src/app/globals.css`, not in a config file. |
| [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Figtree](https://fonts.google.com/specimen/Figtree) via `next/font` | Headings (a soft serif) and interface text (a friendly sans). Self-hosted at build time, so there are no runtime font requests. |
| [TanStack Query](https://tanstack.com/query) 5 | Fetching and caching Open Library requests, with loading and error states. Every request is cached individually, so repeated searches are free. |
| [Zustand](https://zustand.docs.pmnd.rs) 5 (with `persist`) | The Like and Save shelves, kept in `localStorage`. Stored data is re-validated on load. |
| [Motion](https://motion.dev) 14 (`motion/react`, formerly Framer Motion) | Drag and spring physics for the swipe deck. Loaded only when a phone opens the deck. |
| Web Animations API | The "pick the book up and turn it over" modal, with a shadow and light that follow it. Hand-written so only `transform` and `opacity` are animated (no repaints). |
| [Open Library API](https://openlibrary.org/developers/api) | The data source: search, work records (descriptions) and covers. No key needed. |
| [Vitest](https://vitest.dev) 5 | Unit tests, which sit next to the code as `*.test.ts`. |
| [Playwright](https://playwright.dev) | End-to-end tests in real Chrome, against the production build, desktop and phone sized. |
| [axe-core](https://github.com/dequelabs/axe-core) (`@axe-core/playwright`) | An automated accessibility audit of every screen and state, in both themes, against WCAG A, AA and AAA. |
| [serve](https://github.com/vercel/serve) | A tiny static file server, so the browser tests run against the real `out/` folder. |
| [Lighthouse](https://developer.chrome.com/docs/lighthouse) | Performance, accessibility, best-practices and SEO audits (run by hand, see below). |
| [ESLint](https://eslint.org) 9 with `eslint-config-next` | Linting. |
| [pnpm](https://pnpm.io) 10 | Package manager (the version is pinned in `package.json`). |
| GitHub Actions and GitHub Pages | CI (lint, unit tests, browser tests, build on every PR and push) and free static hosting. |

Planned but not added yet: dnd-kit (drag-and-drop shelves).

## What it does

- A three-screen question flow: a book or author you love, genres, mood and audience, then optional fine-tuning (length, era, popularity).
- Client-side scoring and ranking, with a plain-language reason for each pick ("Because you picked Fantasy").
- Click a book to see its description on the back cover, with an animated flip.
- Like and Save, stored on your device. Shelves can be shared with a link.
- Swipe through picks one at a time (mobile and touch devices only), learning from your likes and skips.
- Light and dark themes: follows your system, or choose one with the Theme button.
- Friendly error, empty and 404 pages, and a skip link for keyboard users.

## Accessibility

The colour palette is held to **WCAG AAA** (7:1 for text, 3:1 for the edges of controls), in both light and dark themes. Two automated guards back this up:

- A unit test reads the real colours from `globals.css`, so a change that breaks contrast fails the build.
- A browser test runs axe over every screen and state (first screen, genres, fine-tune, results, the book modal, shelves, shared shelves, error and empty states, the swipe deck and the 404 page) in light and dark, against all of WCAG A, AA and AAA, including the enhanced 7:1 contrast rule. It currently reports no violations.

The app also supports full keyboard use, a skip link, visible focus, `aria-*` for state, landmarks, and `prefers-reduced-motion`. Automated checks find only part of what a person would, so this complements keyboard and screen-reader testing rather than replacing it.

## Getting started

You need Node 22.12 or newer. The repo pins 24.22.2 in `.nvmrc` (Node 22.9 breaks the Tailwind build). The browser tests use the Google Chrome installed on your machine.

```bash
nvm use          # picks up .nvmrc
pnpm install
pnpm dev         # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server. |
| `pnpm lint` | Run ESLint. |
| `pnpm test` | Run the unit tests once (`pnpm test:watch` to re-run on change). |
| `pnpm test:e2e` | Build, then run the browser tests (end to end and accessibility). `pnpm test:e2e:only` skips the build. |
| `pnpm build` | Build the static site into `out/`. |

`pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` must all pass before a change is done. Use pnpm only, not npm or yarn.

## Tests

- **Unit tests (Vitest, 330+):** the logic that decides what users see: scoring and ranking, candidate search, question and answer rules, shelf storage and share links, the swipe deck's state and gestures, the flip animation's geometry (including its shadow and shading), Open Library parsing and error messages, theme handling, and the theme's colour contrast.
- **Browser tests (Playwright, about 95 runs):** the question flow, results, the book modal (focus, Escape, reduced motion), likes and saves surviving a reload, shared links (including a malformed one), the mobile-only swipe deck, the theme toggle, the skip link, landmarks, share-preview tags, the 404 page, and the accessibility audit. Open Library is faked (`e2e/fixtures.ts`), so they are fast and never fail because someone else's server is slow. They run in desktop and phone sized Chrome.

Lighthouse (run by hand against the production build, November 2026): desktop **100 / 100 / 100 / 100**, mobile **99 / 100 / 100 / 100** for performance, accessibility, best practices and SEO. The remaining suggestions are about cache headers, which GitHub Pages controls.

## Deployment

The site is static, and `.github/workflows/deploy.yml` lints, runs the unit and browser tests, and builds on every pull request and push to `main`. Only a push to `main` publishes to GitHub Pages. One-time setup: in the repo's Settings, Pages, set Source to "GitHub Actions".

A project site lives at `https://<user>.github.io/<repo>/`, so `next.config.ts` sets `basePath` from `GITHUB_REPOSITORY` when it runs in Actions. Locally it is unset, so the app serves from `/`. The browser tests run against a build without that prefix, and the workflow builds twice for that reason.

## Project layout

```
src/app/                 Page, layout, theme tokens (globals.css), error and 404 pages, icons
src/components/          UI: question flow, results, book modal, swipe deck, shelves, theme toggle
src/lib/open-library/    API client, types, query options, description cleaning
src/lib/scoring/         Ranking and learning from likes and skips
src/lib/                 Questions, recommendation search, deck, shelf, share and theme logic
e2e/                     Playwright browser tests and the fake Open Library
NOTES.md                 Decisions, API findings and the build plan
```

## Data and attribution

Book data and covers come from [Open Library](https://openlibrary.org), and descriptions are contributed by its users. The site credits Open Library in its footer, and every book links back to its Open Library page. Open Library's tags are messy and it has no age-rating field, so audience and subject matching are best-effort.

The app stores only your likes, saves and theme choice, in your browser. Nothing is sent to a server of ours, and there is no analytics.

## License

[MIT](LICENSE)
