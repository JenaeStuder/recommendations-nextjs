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
| Planned | TanStack Query (fetching/caching), Zustand + persist (local state), Framer Motion (motion), dnd-kit (shelves) |

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
- **Low-count ratings dominate `sort=rating`.** Obscure books with ~40 ratings rank first. Add a floor such as `ratings_count:[50 TO *]` unless the user picks "hidden gems".
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
2. [ ] Enable static export (`output: 'export'`) and set up hosting
3. [ ] Set up the theme in Tailwind v4 (colours, type, dark mode)
4. [ ] Open Library client + types + TanStack Query hooks
5. [ ] Question flow UI
6. [ ] Scoring logic (with unit tests)
7. [ ] Swipe deck + keyboard controls
8. [ ] Shelves, local saving, shareable URLs
9. [ ] Accessibility pass, Lighthouse, tests (Vitest + Playwright), CI
10. [ ] Write the portfolio case study (log decisions here as we go)
