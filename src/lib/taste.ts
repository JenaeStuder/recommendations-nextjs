import type { Author, Book } from "@/lib/open-library";

/** What the user told us they already love. Either, both or neither. */
export type Taste = {
  book?: Book;
  author?: Pick<Author, "id" | "name">;
};

export const hasTaste = (t: Taste): boolean => Boolean(t.book || t.author);

/**
 * Words that appear in almost every book's subject list and say nothing about it
 * ("Fiction", "Juvenile", "Large type books", "Accessible book"…). Ignored when comparing books.
 */
const STOP = new Set([
  "fiction", "general", "juvenile", "young", "adult", "classics", "classic", "books", "book",
  "children", "childrens", "library", "accessible", "protected", "daisy", "large", "print",
  "type", "reading", "level", "grade", "media", "tie", "open", "staff", "picks", "series",
  "translations", "translation", "english", "american", "british", "literature", "stories",
  "story", "novel", "novels", "specimens", "texts", "text", "popular", "works", "fictional",
  "characters", "in", "and", "the", "for", "with", "from", "nyt", "bestseller", "bestsellers",
  "lending", "internet", "archive", "other", "people", "history", "teen", "teens",
  // Non-English catalogue boilerplate that shows up on translated editions.
  "ficcion", "novela", "literatura", "infantil", "juvenil", "roman", "romans",
]);

/** "ficción" → "ficcion", so accented and plain spellings are the same word. */
const stripAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Strips a plural so "dragons" matches "dragon". Deliberately light, because the stem is
 * shown to users ("shares dwarves and elves"): "-ves" is left alone, since "dwarve" would look wrong.
 */
export function stem(word: string): string {
  if (word.length <= 4 || word.endsWith("ves") || word.endsWith("ss") || !word.endsWith("s")) return word;
  return /(sh|ch|x|z)es$/.test(word) ? word.slice(0, -2) : word.slice(0, -1);
}

/** Lowercased word stems worth comparing: 4+ letters, not boilerplate, plurals stemmed. First-seen order is kept. */
export function subjectTokens(subjects: string[]): string[] {
  const tokens = new Set<string>();
  for (const subject of subjects) {
    // \p{L} so accented words ("ficción") stay whole instead of being cut at the accent.
    for (const word of stripAccents(subject.toLowerCase()).split(/[^\p{L}]+/u)) {
      if (word.length < 4 || STOP.has(word)) continue;
      tokens.add(stem(word));
    }
  }
  return [...tokens];
}

/**
 * Subjects of a loved book that are worth searching on: short, not boilerplate, no
 * dates or colons (which mark a single edition or a person, not a theme).
 */
export function distinctiveSubjects(book: Book, max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of book.subjects) {
    const s = raw.trim().toLowerCase();
    if (s.length === 0 || s.length > 30 || /[\d:]/.test(s) || seen.has(s)) continue;
    if (subjectTokens([s]).length === 0) continue;
    seen.add(s);
    out.push(s);
    if (out.length === max) break;
  }
  return out;
}

/** The author's best-known books (by number of ratings): the sample an author "profile" is built from. */
function topBooksBy(books: Book[], authorId: string, count = 10): Book[] {
  return books
    .filter((b) => b.authorKeys.includes(authorId))
    .sort((a, b) => (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0))
    .slice(0, count);
}

/** Items that appear in at least a third of the sample (and at least twice), most common first. */
function commonItems(lists: string[][], max: number): string[] {
  const counts = new Map<string, number>();
  for (const list of lists) for (const item of new Set(list)) counts.set(item, (counts.get(item) ?? 0) + 1);
  const minCount = Math.max(2, Math.ceil(lists.length / 3));
  return [...counts]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([item]) => item);
}

/**
 * What an author writes about, as subject words: those shared by many of their top books.
 * Ordered most common first, so earlier = more characteristic (used to weight similarity).
 */
export function authorProfileTokens(books: Book[], authorId: string, max = 12): string[] {
  return commonItems(topBooksBy(books, authorId).map((b) => subjectTokens(b.subjects)), max);
}

/** Same idea, as whole subject strings, for searching Open Library. */
export function authorProfileSubjects(books: Book[], authorId: string, max = 8): string[] {
  const lists = topBooksBy(books, authorId).map((b) => distinctiveSubjects(b, 40));
  return commonItems(lists, max);
}
