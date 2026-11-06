# CLAUDE.md

Book recommender (music later): a portfolio project built to show front-end and UX skills. The full plan, decisions and API findings are in NOTES.md, imported below. Keep NOTES.md up to date as decisions change, and tick off its Next steps.

@NOTES.md
@AGENTS.md

## Working in this repo

- **Node:** run `nvm use` first (24.22.2 from `.nvmrc`). The Homebrew Node 22.9 on this machine breaks the Tailwind build.
- **pnpm only:** `pnpm dev`, `pnpm lint`, `pnpm build`. Don't use npm or yarn.
- **Before calling work done:** `pnpm lint` and `pnpm build` must pass.
- **No backend:** keep everything compatible with static export. No Server Actions, auth, databases, or route handlers that need a server.
- **Tailwind v4:** theme and config go in CSS (`src/app/globals.css` with `@theme`), not in `tailwind.config.js`.
- **Quality bar** (this is a portfolio piece): accessible (keyboard, focus, ARIA, `prefers-reduced-motion`), responsive, and with designed empty/loading/error states.
- **Project skills** live in `.claude/skills/`: frontend-design, next-best-practices, vercel-react-best-practices, typescript-advanced-types.

## About the developer

Jenae is a Front End developer with 7 years experience building marketing websites using modern frames works with a focus on accessibility.
