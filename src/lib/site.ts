/** One place for the app's name and description, used by the page title, share previews and the header. */
export const SITE_NAME = "Your Next TBR";

export const SITE_DESCRIPTION =
  "Answer a few questions and get personalised book picks you can browse, save and share. Free, with no sign-in.";

/**
 * The site's ORIGIN (no path), so share previews get absolute URLs. On GitHub Pages that is
 * https://<user>.github.io; GITHUB_REPOSITORY ("user/repo") is set by Actions, and unset locally.
 * Deliberately without the "/<repo>" part: Next adds the base path itself (next.config.ts), so
 * including it here doubles it. A custom domain would replace this.
 */
export function siteUrl(repository = process.env.GITHUB_REPOSITORY): string {
  const [owner, repo] = repository?.split("/") ?? [];
  if (!owner || !repo) return "http://localhost:3000";
  return `https://${owner.toLowerCase()}.github.io`;
}
