import type { Book } from "@/lib/open-library";

/**
 * What the user has done with a book, kept so it survives a reload. A book can be liked, saved
 * to read, or both. Pure functions only, so the rules are unit tested without React or storage.
 */
export type Flag = "liked" | "saved";
/** `liked` / `saved` hold the time (ms) the flag was switched on, or null when it is off. That time orders each shelf, so un-liking a book never bumps it up another shelf. */
export type Reaction = { book: Book; liked: number | null; saved: number | null };
export type Reactions = Record<string, Reaction>;

/** Switches one flag on or off. A book with neither flag left is forgotten entirely. */
export function setFlag(reactions: Reactions, book: Book, flag: Flag, value: boolean, now = Date.now()): Reactions {
  const current = reactions[book.id];
  if (!current && !value) return reactions;
  const next: Reaction = {
    book: current?.book ?? book,
    liked: current?.liked ?? null,
    saved: current?.saved ?? null,
  };
  // Pressing an already-on flag keeps its original time.
  next[flag] = value ? (next[flag] ?? now) : null;
  if (next.liked === null && next.saved === null) {
    const rest = { ...reactions };
    delete rest[book.id];
    return rest;
  }
  return { ...reactions, [book.id]: next };
}

/** Books with `flag` on, most recently added to that shelf first. */
export function booksOn(reactions: Reactions, flag: Flag): Book[] {
  return Object.values(reactions)
    .filter((r) => r[flag] !== null)
    .sort((a, b) => (b[flag] ?? 0) - (a[flag] ?? 0))
    .map((r) => r.book);
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function isBook(v: unknown): v is Book {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    /^OL\d+W$/.test(b.id) &&
    typeof b.title === "string" &&
    isStrings(b.authors) &&
    isStrings(b.authorKeys) &&
    isStrings(b.subjects) &&
    (b.coverId === undefined || typeof b.coverId === "number")
  );
}

/**
 * Whatever came out of localStorage, reduced to entries that are safe to use. Stored data can be
 * from an older version of the app, hand-edited or corrupt; a bad entry is dropped instead of
 * crashing the page, and anything that isn't an object gives an empty shelf.
 */
export function sanitizeReactions(raw: unknown): Reactions {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Reactions = {};
  for (const [id, value] of Object.entries(raw)) {
    const r = value as Partial<Reaction> | null;
    if (!r || typeof r !== "object" || !isBook(r.book) || r.book.id !== id) continue;
    const stamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    const liked = stamp(r.liked);
    const saved = stamp(r.saved);
    if (liked === null && saved === null) continue;
    out[id] = { book: r.book, liked, saved };
  }
  return out;
}
