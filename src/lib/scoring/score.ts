import { isUnbounded, type Book, type Range } from "@/lib/open-library";
import { subjectTokens } from "@/lib/taste";
import type {
  Feedback,
  LearnedWeights,
  Preferences,
  ScoredBook,
  Signal,
} from "./types";

/* ---------- tunables ---------- */

/** Relative importance of each component. Components that don't apply are dropped and the rest renormalised. */
const WEIGHTS = {
  signals: 0.45,
  quality: 0.25,
  popularity: 0.1,
  length: 0.1,
  era: 0.1,
  // Only present when the user named a book or author they love. Deliberately heavy:
  // "books like X" should feel like it.
  similarity: 0.35,
  author: 0.25,
};
/**
 * Weighted shared subject words at which a book counts as fully "like" the loved one.
 * Open Library lists a book's core subjects first and appends edition noise later
 * (graphic-novel adaptations, reading levels), so earlier words count for more.
 */
const SIMILARITY_SATURATION = 3.5;
/** Below this, a book isn't similar enough to say so in its explanation. */
const SIMILARITY_EXPLAIN_MIN = 0.3;
/** Books by the loved author may fill this many slots (others are capped lower). */
const FAVOURITE_AUTHOR_LIMIT = 4;
const FAVOURITE_KEY = "__favourite_author__";
/** Genres matter more than moods when both are present. */
const KIND_WEIGHT = { genre: 0.6, mood: 0.4 };
/** Prior for the Bayesian average: pull books with few ratings toward the mean. */
const PRIOR_MEAN = 3.8;
const PRIOR_STRENGTH = 25;
/** How far outside a range (in pages / years) before a book stops fitting at all. */
const PAGE_SCALE = 200;
const YEAR_SCALE = 25;
/** Cap on how much learned feedback can move a score. */
const LEARNED_CAP = 0.2;
const LEARNED_GAIN = 0.1;
const FEEDBACK_DELTA: Record<Feedback, number> = { like: 1, save: 1.5, skip: -0.5 };

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/* ---------- subject matching ---------- */

export const normalize = (s: string) => s.trim().toLowerCase();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * True if any of the book's subjects contains `target` as a whole word (plural allowed).
 * Subjects are messy ("Fiction, fantasy, general"), so we match inside them, but
 * on word boundaries so "war" doesn't match "warrior".
 */
export function matchesSubject(subjects: string[], target: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(normalize(target))}s?\\b`);
  return subjects.some((s) => re.test(normalize(s)));
}

export function matchSignals(book: Book, signals: Signal[]): Signal[] {
  return signals.filter((sig) => sig.subjects.some((t) => matchesSubject(book.subjects, t)));
}

/* ---------- components (each returns 0..1, or undefined if it doesn't apply) ---------- */

/** Diminishing returns: 0 matches = 0, 1 = 0.5, 2 = 0.75, 3 = 0.875. */
const diminishing = (matches: number) => 1 - 0.5 ** matches;

function signalScore(signals: Signal[], matched: Signal[]): number | undefined {
  const parts = (["genre", "mood"] as const).flatMap((kind) => {
    if (!signals.some((s) => s.kind === kind)) return [];
    const hits = matched.filter((m) => m.kind === kind).length;
    return [{ w: KIND_WEIGHT[kind], v: diminishing(hits) }];
  });
  if (parts.length === 0) return undefined;
  const total = parts.reduce((sum, p) => sum + p.w, 0);
  return parts.reduce((sum, p) => sum + p.w * p.v, 0) / total;
}

/** Bayesian average rating scaled so 3 stars = 0 and 5 stars = 1. */
export function qualityScore(book: Book): number {
  const n = book.ratingsCount ?? 0;
  const r = book.rating ?? PRIOR_MEAN;
  const adjusted = (n * r + PRIOR_STRENGTH * PRIOR_MEAN) / (n + PRIOR_STRENGTH);
  return clamp((adjusted - 3) / 2);
}

/** How well-known a book is: 0 at no ratings, 1 at 1000+. */
export function awareness(book: Book): number {
  return clamp(Math.log10((book.ratingsCount ?? 0) + 1) / 3);
}

function popularityScore(book: Book, mode: Preferences["popularity"]): number | undefined {
  if (mode === "popular") return awareness(book);
  if (mode === "hidden") return 1 - awareness(book);
  return undefined;
}

function distanceOutside(value: number, range: Range): number {
  if (range.min !== undefined && value < range.min) return range.min - value;
  if (range.max !== undefined && value > range.max) return value - range.max;
  return 0;
}

/**
 * 1 inside any of the ranges, decaying linearly to 0 at `scale` outside the nearest one.
 * Unknown value = neutral 0.5. No ranges (or one that allows everything) = no preference.
 */
export function rangeFit(value: number | undefined, ranges: Range[] | undefined, scale: number): number | undefined {
  if (!ranges || ranges.length === 0 || ranges.some(isUnbounded)) return undefined;
  if (value === undefined) return 0.5;
  const nearest = Math.min(...ranges.map((r) => distanceOutside(value, r)));
  return clamp(1 - nearest / scale);
}

/**
 * How like the loved book this one is. `lovedTokens` must be ordered most characteristic first;
 * the word at position i counts 1 / (1 + i/15).
 */
export function similarity(book: Book, lovedTokens: string[]): { value: number; shared: string[] } {
  const mine = new Set(subjectTokens(book.subjects));
  const shared: string[] = [];
  let sum = 0;
  lovedTokens.forEach((token, i) => {
    if (!mine.has(token)) return;
    shared.push(token);
    sum += 1 / (1 + i / 15);
  });
  return { value: clamp(sum / SIMILARITY_SATURATION), shared };
}

/* ---------- learning ---------- */

/** Returns new weights after the user reacts to a book. Spread across subjects so long tag lists don't dominate. */
export function learn(weights: LearnedWeights, book: Book, action: Feedback): LearnedWeights {
  const subjects = [...new Set(book.subjects.map(normalize))];
  if (subjects.length === 0) return weights;
  const delta = FEEDBACK_DELTA[action] / Math.sqrt(subjects.length);
  const next = { ...weights };
  for (const s of subjects) next[s] = (next[s] ?? 0) + delta;
  return next;
}

function learnedAdjustment(book: Book, weights: LearnedWeights): number {
  const subjects = new Set(book.subjects.map(normalize));
  let sum = 0;
  for (const s of subjects) sum += weights[s] ?? 0;
  return clamp(sum * LEARNED_GAIN, -LEARNED_CAP, LEARNED_CAP);
}

/* ---------- scoring ---------- */

function listLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function explain(
  book: Book,
  matched: Signal[],
  like: { value: number; shared: string[] },
  prefs: Preferences,
): string {
  const { favouriteAuthor, similarTo } = prefs;
  if (favouriteAuthor && book.authorKeys.includes(favouriteAuthor.id)) {
    return `More by ${favouriteAuthor.name}, an author you love`;
  }
  if (similarTo && like.value >= SIMILARITY_EXPLAIN_MIN && like.shared.length >= 2) {
    return `Like ${similarTo.title}: shares ${listLabels(like.shared.slice(0, 3))}`;
  }
  if (matched.length > 0) {
    return `Because you picked ${listLabels(matched.map((m) => m.label))}`;
  }
  if (prefs.popularity === "hidden") return "A lesser-known pick in your genre";
  if ((book.rating ?? 0) >= 4.2 && (book.ratingsCount ?? 0) >= 50) return "Highly rated in your genre";
  return "A close match for your answers";
}

export function scoreBook(book: Book, prefs: Preferences, learned: LearnedWeights = {}): ScoredBook {
  const matched = matchSignals(book, prefs.signals);
  const like = prefs.similarTo ? similarity(book, prefs.similarTo.tokens) : { value: 0, shared: [] };
  const byFavourite = prefs.favouriteAuthor
    ? book.authorKeys.includes(prefs.favouriteAuthor.id)
    : undefined;

  const components = [
    { w: WEIGHTS.signals, v: signalScore(prefs.signals, matched) },
    { w: WEIGHTS.quality, v: qualityScore(book) },
    { w: WEIGHTS.popularity, v: popularityScore(book, prefs.popularity) },
    { w: WEIGHTS.length, v: rangeFit(book.pages, prefs.pages, PAGE_SCALE) },
    { w: WEIGHTS.era, v: rangeFit(book.firstPublishYear, prefs.years, YEAR_SCALE) },
    {
      w: WEIGHTS.similarity,
      v: prefs.similarTo ? like.value : undefined,
    },
    { w: WEIGHTS.author, v: byFavourite === undefined ? undefined : Number(byFavourite) },
  ].filter((c): c is { w: number; v: number } => c.v !== undefined);

  const total = components.reduce((sum, c) => sum + c.w, 0);
  const base = components.reduce((sum, c) => sum + c.w * c.v, 0) / total;

  return {
    book,
    score: base + learnedAdjustment(book, learned),
    matched,
    explanation: explain(book, matched, like, prefs),
  };
}

/* ---------- ranking with variety ---------- */

/**
 * Keeps at most `perAuthor` books per author in the list, in score order. Books
 * over the limit go to the end, so a thin result set still fills up.
 * (Open Library has no series field, so author is our only variety signal.)
 */
export function diversify(
  ranked: ScoredBook[],
  perAuthor: number,
  favouriteAuthorId?: string,
): ScoredBook[] {
  const counts = new Map<string, number>();
  const kept: ScoredBook[] = [];
  const overflow: ScoredBook[] = [];
  for (const item of ranked) {
    const isFavourite = favouriteAuthorId !== undefined && item.book.authorKeys.includes(favouriteAuthorId);
    const author = isFavourite ? FAVOURITE_KEY : (item.book.authors[0] ?? item.book.id); // unknown authors never group together
    const cap = isFavourite ? Math.max(perAuthor, FAVOURITE_AUTHOR_LIMIT) : perAuthor;
    const n = counts.get(author) ?? 0;
    if (n < cap) {
      counts.set(author, n + 1);
      kept.push(item);
    } else {
      overflow.push(item);
    }
  }
  return [...kept, ...overflow];
}

export type RankOptions = { limit?: number; perAuthor?: number };

export function rankBooks(
  books: Book[],
  prefs: Preferences,
  learned: LearnedWeights = {},
  { limit = 20, perAuthor = 2 }: RankOptions = {},
): ScoredBook[] {
  const loved = prefs.similarTo;
  const lovedTitle = loved?.title.trim().toLowerCase();
  const scored = books
    // Never recommend the book they said they already love (or another edition of it).
    .filter((b) => !loved || (b.id !== loved.id && b.title.trim().toLowerCase() !== lovedTitle))
    .map((b) => scoreBook(b, prefs, learned))
    .sort((a, b) => b.score - a.score);
  return diversify(scored, perAuthor, prefs.favouriteAuthor?.id).slice(0, limit);
}
