# Project Notes

Working notes for this project: what we're building, the decisions made so far, and what's next. Update this file as decisions change.

## Goal

A portfolio project that shows front-end and UX skills (React, Next.js, Tailwind) for **Front End Developer, UX Developer and Front End Engineer** roles.

The app is an **interaction-rich book recommender**. Users answer a few questions and get personalized picks they can swipe through, save and share. Music recommendations may come later.

What reviewers should notice: polished interactions, accessibility, thoughtful empty/loading/error states, and clean front-end architecture.

## Constraints

- **No backend, no sign-in, no paid hosting.** Everything runs in the browser.
- Host as a static site (Next.js `output: 'export'`) on a free host: Vercel, Netlify, Cloudflare Pages or GitHub Pages.
- User data (likes, skips, shelves) lives in `localStorage`. Shelves can be shared through the URL.
- If API keys ever need hiding, Vercel's free Hobby plan allows small serverless functions. That's a later option, not the plan.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, `src/` dir), React 19, TypeScript |
| Styling | Tailwind CSS v4 (configured in CSS, no `tailwind.config.js`) |
| Package manager | pnpm 10 (`packageManager` field in `package.json`) |
| Node | 24.22.2 (`.nvmrc`; run `nvm use`). Node 22.9 breaks the Tailwind build, so 22.12+ is required. |
| Testing | Vitest (`pnpm test`, tests sit next to the code as `*.test.ts`) |
| Planned | TanStack Query (fetching/caching), Zustand + persist (local state), Framer Motion (motion), dnd-kit (shelves) |

**Static export and PPR don't mix.** `cacheComponents` / `partialPrefetching` throw "PPR cannot be enabled in export mode", so they are off. Don't re-enable them while we export statically.

**Stale build cache:** if `pnpm build` fails with a Tailwind `require() of ES Module` error after switching Node versions, run `rm -rf .next` and rebuild.

Next.js 16 has breaking changes from older versions. Check `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`).

Installed agent skills (`.agents/skills/`, symlinked into `.claude/skills/`, sources in `skills-lock.json`):
- `frontend-design` (anthropics/skills): visual design direction
- `next-best-practices` (vercel-labs/openreview): Next.js conventions. May predate v16; the docs in `node_modules/next` win.
- `vercel-react-best-practices` (vercel-labs/agent-skills): React/Next.js performance rules
- `typescript-advanced-types` (wshobson/agents): advanced TypeScript types

## Books API: Open Library

No API key, and it allows browser requests (CORS: `*`). Neither Open Library nor Google Books has a recommendations endpoint for anonymous users, so **we build the recommendation logic ourselves.**

Endpoints:
- Search with filters: `https://openlibrary.org/search.json`
- Genre browse: `https://openlibrary.org/subjects/{subject}.json?limit=20&offset=0`
- Trending: `https://openlibrary.org/trending/weekly.json` (for a "Not sure? Start here" option)
- Covers: `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` (sizes S/M/L)

Example query (tested, 538 results):
```
/search.json?q=subject:fantasy subject:dragons
  first_publish_year:[2000 TO 2025]
  number_of_pages_median:[200 TO 400]
  &sort=rating&limit=20
  &fields=key,title,author_name,first_publish_year,number_of_pages_median,ratings_average,ratings_count,subject,cover_i
```

Gotchas found:
- **Low-count ratings dominate `sort=rating`.** Obscure books with ~40 ratings rank first. Add a floor such as `ratings_count:[50 TO *]` unless the user picks "hidden gems". **But 50 is too strict for narrow filters:** fantasy + dragons + 2000-2025 + 200-400 pages gives 538 results with no floor, 24 with a floor of 10, and 0 with 50. The scoring step must start high and step the floor down (50 → 10 → 1) until it has enough candidates.
- **Subjects are messy** (`Fantasy`, `fantasy fiction`, `Fantasy, Fiction`). Keep a curated map from each UI option to the subject strings it should match.
- **Range brackets need URL-encoding** (`[` `]`). `URLSearchParams` handles this.
- Some books have no cover. Design a good fallback cover.
- Be polite: cache responses (TanStack Query), debounce search input, request only the `fields` we use.

Google Books is an optional extra for descriptions and page counts. It needs a free browser API key (it returned 429 without one). Restrict the key to our domain.

## Recommendation flow

### Questions (v1)
| Question | Maps to |
|---|---|
| Genres (pick up to 3) | `subject:` terms |
| Vibe or mood (pick up to 3): cozy, dark, epic, funny… | more `subject:` terms |
| Length: quick / medium / epic | `number_of_pages_median:[…]` |
| Era: classics / modern / new | `first_publish_year:[…]` |
| A book you loved (optional search) | its subjects become weighted signals |
| Popular or hidden gems | rating sort plus a high or low `ratings_count` floor |

### Scoring (client-side)
1. Fetch candidates from the answers.
2. Score on overlapping subjects, rating, number of ratings, and closeness to the preferred length.
3. Mix it up: limit how many come from the same author or series.
4. Learn as the user goes: likes and skips adjust subject weights (stored locally) and re-rank the rest.
5. Explain each pick, e.g. *"Because you liked dragons + cozy"*.

## Interactions to build

- Question flow with animated chip pickers, a progress indicator and back/refine
- **Swipe card deck** (like / skip / save) with drag + spring physics, **plus keyboard controls** (← skip, → like, ↑ save)
- Undo toast after a skip
- Drag-and-drop shelves ("To read", "Favourites")
- Shareable shelf URLs (`?shelf=OL123W,OL456W`)
- Theme that shifts with the chosen genre (e.g. dark for horror, soft for romance)
- Loading skeletons, a first-visit empty state, friendly error and rate-limit messages
- Respect `prefers-reduced-motion`; full keyboard and screen-reader support

## Later: music

- **Last.fm** (free key, browser-safe) for genre-based recommendations: `tag.getTopArtists`, `tag.getTopAlbums`, `artist.getSimilar`.
- **iTunes Search** (no key) for artwork and 30-second previews.
- Avoid Spotify (needs a server-side secret; its recommendations API was shut off for new apps in late 2024), Deezer (no CORS) and MusicBrainz (strict rate limits).
- Possible signature feature: **"Read this, hear this"**, mapping book subjects to music tags (gothic → darkwave, cyberpunk → synthwave).

## Name ideas (undecided)

- **Earmark** (favourite): dog-ear a page plus "ear" for music; a folded-corner logo
- Riffle, Liner Notes, Deep Cuts
- Book-only: Dog-Ear, Marginalia, Spine

Check domain and trademark availability before deciding.

## Next steps

1. [x] Scaffold Next.js + Tailwind + pnpm
2. [x] Enable static export (`output: 'export'`, `images.unoptimized`); build writes to `out/`
   - [ ] Pick a free host and deploy
3. [ ] Set up the theme in Tailwind v4 (colours, type, dark mode)
4. [x] Open Library client + types + TanStack Query hooks (`src/lib/open-library/`; `searchQueryOptions`, `trendingQueryOptions`)
5. [x] Question flow UI (`src/components/question-flow/`, data in `src/lib/questions.ts`)
   - **Three screens total** (UX call: fewer steps is better): (1) a book or author you love, (2) genres + audience, (3) "Fine-tune your picks" with mood, length, era and popularity. Only genres are required (and not even that if a book/author is named), so screen 3 can be skipped straight to results. Screens are declared in `STEPS` in `src/lib/questions.ts`; a step with a `heading` titles the whole screen, otherwise its first question does.
   - **Length and era are multi-select** (popularity stays single: its options contradict). Chosen ranges are merged (`mergeRanges`: quick + medium = under 451) and sent as a union (`(pages:[* TO 249] OR pages:[451 TO *])`); picking all three means no filter. Scoring fits a book to the *nearest* chosen range.
   - Chip labels must be unique on a screen (mood "Epic" vs length "Epic" clashed, so length is now "Long"); a test guards this.
   - Done: native radio/checkbox chips, progress bar, back/skip, focus moves to each new heading, loading/error/empty states, cover fallback.
   - Deferred: animated step transitions (CSS only for now); answers aren't persisted yet (Zustand).
   - (The v1 query that could return 0 books was replaced by the candidate plan in step 6.)
6. [x] Scoring logic (with unit tests): `src/lib/scoring/` (pure ranking, `learn()` for likes/skips) and `src/lib/recommend.ts` (candidate fetching). Run `pnpm test`.
   - Candidates: ratings floor steps down until 30+ books (popular 20→10→3, any 3→1, hidden keeps a ceiling of 19). Each step runs a genres+moods query and a genres-only query, so a narrow mood can't empty the results.
   - Score = signals 45% (genre 60 / mood 40, diminishing returns per extra match), Bayesian rating 25%, popularity fit 10%, length fit 10%, era fit 10%. Components with no answer are dropped and the rest renormalised. Learned feedback adds at most ±0.2.
   - Variety: max 2 books per author (Open Library has no series field).
   - Known limit: Open Library subject tags are noisy, so some picks are loose matches (e.g. a young-adult series under "Horror"). The explanation only names signals that actually matched, and says so when none did.
   - **"A book or author you love"** (optional first step; `taste-step.tsx`, `combobox.tsx`, `src/lib/taste.ts`):
     - Accessible combobox (ARIA 1.2: arrows, Enter, Escape, live announcements, focus returns sensibly). Suggestions are debounced 300 ms; title search is deduped by title+author and best-known edition first.
     - Naming a book or author makes genres optional.
     - Book: its subjects are filtered for boilerplate, searched in relevance order (so most shared subjects first), and compared by shared words. **Words earlier in Open Library's subject list count more**, because later ones are edition noise (graphic-novel tags etc.). The book itself, and other editions with the same title, are never recommended.
     - Author: their books are fetched by author key (no length/era/ratings filters), then a profile of what they write about (subject words shared by a third or more of their top 10 books) finds similar authors. They can fill up to 4 slots; everyone else is capped at 2.
     - User text is sanitised before reaching the search engine (`sanitizeText`), author keys are validated (`OL…A`).
     - Known limit: title search also returns books about a book (e.g. "J.R.R. Tolkien's The hobbit"), so users should pick carefully from the list.
   - **Audience filter** ("Who's it for?", under the genres on question 2; `src/lib/open-library/audience.ts`): Open Library has **no age-rating field**, so this is a heuristic over subject tags. Children, Teens & young adult, Adults (multi-select; none or all = no filter).
     - YA books usually carry the children's tags *and* a YA tag, so children = children's tags **and not** YA tags. Adult books mostly have no audience tag, so adult = has **neither**. "New adult" has too few books (23 with 10+ ratings) so it's folded into teen.
     - Children's tags are `juvenile fiction/literature/works` and `picture books`. A bare `children's fiction` tag is **not** trusted: it's often stray on adult books (The Martian, The Hero of Ages).
     - Queries: `(*:* AND NOT x)` is invalid on Open Library; use `-x`. A query of only exclusions returns 0, so audience needs another positive clause (every plan has one). Applies to the loved author's books too.
     - The three groups partition the catalogue (children + teen + adult = all). Verified live for fantasy.
     - Known limit: tags are inconsistent per edition/work, so the children list can still leak YA series books (e.g. later Throne of Glass books). The question's help text says so.
     - The old "Young adult" genre chip was removed: it overlapped with the audience question.
   - **Results paging** (`results.tsx`): the whole candidate pool is ranked once and revealed 20 at a time with "Show me more" (no extra API calls). A polite status line announces "Showing 40 of 72…", focus moves to the first newly revealed book, and the button is replaced by a closing message when the pool runs out. The pool is what the search fetched (about 30 to 120 books); going past it would need more API pages.
   - **"Start A New Search"** resets everything (answers, book, author) to a blank first screen. It used to be "Change my answers", which kept the answers; the reducer lives in `flow-state.ts` and is unit tested.
   - **Caching and "Start A New Search"**: the reset clears the form but **not** the in-memory query cache, so repeating a search is free. Beyond that, every individual API request is cached on its own (`cachedSearch` in `queries.ts`, 1 hour fresh, kept 2 hours), so two *different* searches share any request they have in common (e.g. plain "fantasy" is reused when you add a loved author).
     - **Why this can't serve false data:** the cache key is the exact request (query, ranges, audience, sort, page, author key). A loved book or author changes the request, so it is never matched against a search without it. Do **not** key on "similar criteria" or ignore the book/author: tests demonstrate the wrong results that would give.
     - Memory only: a page reload clears it. Persisting to `localStorage` is possible but risky: stored `Book` objects would break after any change to their shape (this has already happened once, when `authorKeys` was added), so it would need a build-id buster and a size cap. Not done.
   - Not wired yet: `learn()` has no UI until the swipe deck (step 7) feeds it likes, skips and saves.
7. [ ] Swipe deck + keyboard controls
8. [ ] Shelves, local saving, shareable URLs
9. [ ] Accessibility pass, Lighthouse, tests (Vitest + Playwright), CI
10. [ ] Write the portfolio case study (log decisions here as we go)
