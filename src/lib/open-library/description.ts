/**
 * Open Library descriptions are user-contributed text with leftovers from several editors:
 * Windows line breaks, markdown links, "Source:" footers, HTML, bare URLs. Measured on 147 real
 * descriptions: 68% had `\r\n`, about 10% had bold markers, links or URLs, a few had footers.
 * `cleanDescription` turns that into plain text; `shortDescription` trims it for the list.
 */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

/** The API returns either a string or `{ type: "/type/text", value: "..." }`. */
export function descriptionText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "value" in raw && typeof raw.value === "string") {
    return raw.value;
  }
  return "";
}

/** Where editors append boilerplate. Everything from the first of these lines onwards is dropped. */
const FOOTER_LINE = /^\s*(?:-{5,}|(?:source|also contained in)\s*:).*$/im;

/** Plain text, paragraphs separated by a blank line. Empty string if nothing readable is left. */
export function cleanDescription(raw: unknown): string {
  let text = descriptionText(raw).replace(/\r\n?/g, "\n");

  const footer = FOOTER_LINE.exec(text);
  if (footer) text = text.slice(0, footer.index);

  text = text
    // Reference-style link definitions: "  [2]: https://..."
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "")
    // HTML: line breaks become newlines, other tags vanish
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[a-z/][^>]*>/gi, "")
    // Markdown links: [text](url), [text][ref] and [text][] keep just the text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    // Bare URLs (stopping before trailing punctuation), and what they leave behind:
    // empty brackets and a gap before a full stop
    .replace(/https?:\/\/[^\s)]*[^\s).,;:!?'"\]]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    // Emphasis markers: **bold**, __bold__, *italic*, _italic_
    .replace(/\*\*|__/g, "")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1$2")
    .replace(/&(?:amp|quot|#39|apos|lt|gt|nbsp);/g, (e) => ENTITIES[e] ?? e);

  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]*\n[ \t]*/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * A short version for the list: the cleaned text on one line, cut at the end of the last whole
 * sentence that fits in `max` characters. If there's no sentence end late enough, cut at a word and
 * add an ellipsis. Never longer than `max` + 1 characters.
 */
export function shortDescription(text: string, max = 380): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;

  const window = flat.slice(0, max);
  // The last sentence end that leaves a reasonable amount of text (more than 60% of the budget).
  let cut = -1;
  for (const m of window.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) cut = m.index + m[0].length;
  if (cut > max * 0.6) return flat.slice(0, cut).trim();

  const space = window.lastIndexOf(" ");
  return `${(space > 0 ? window.slice(0, space) : window).replace(/[\s,;:–—-]+$/, "")}…`;
}

export type BookDescription = {
  /** Cleaned full text, paragraphs separated by a blank line. Empty when the book has none. */
  full: string;
  /** Short version for the list. Empty when the book has none. */
  short: string;
};

export function parseDescription(raw: unknown): BookDescription {
  const full = cleanDescription(raw);
  return { full, short: shortDescription(full) };
}
