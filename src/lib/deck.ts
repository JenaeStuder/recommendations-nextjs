import type { Book } from "@/lib/open-library";
import { learn, rankBooks, type Feedback, type LearnedWeights, type Preferences, type ScoredBook } from "@/lib/scoring";

/**
 * The state behind the swipe deck, as plain functions so it can be unit tested without React.
 *
 * Every decision is remembered together with the learned weights from *before* it, so undo puts
 * the ranking back exactly as it was instead of trying to "un-learn" with arithmetic.
 */
export type Entry = { book: Book; action: Feedback; before: LearnedWeights };

export type DeckState = {
  /** In the order the user decided, oldest first. */
  entries: Entry[];
  learned: LearnedWeights;
};

export const EMPTY_DECK: DeckState = { entries: [], learned: {} };

export function decide(state: DeckState, book: Book, action: Feedback): DeckState {
  if (state.entries.some((e) => e.book.id === book.id)) return state; // already decided (a double key press)
  return {
    entries: [...state.entries, { book, action, before: state.learned }],
    learned: learn(state.learned, book, action),
  };
}

/** Takes back the most recent decision. Returns the book so the caller can say which one came back. */
export function undo(state: DeckState): { state: DeckState; entry?: Entry } {
  const entry = state.entries.at(-1);
  if (!entry) return { state };
  return { state: { entries: state.entries.slice(0, -1), learned: entry.before }, entry };
}

/**
 * The cards still to come, best first. Re-ranked every time, so what the user has liked and
 * skipped so far changes what they see next.
 */
export function upcoming(
  pool: Book[],
  prefs: Preferences,
  state: DeckState,
  /** Book ids to leave out as well, e.g. ones already liked or saved from the list view. */
  exclude: ReadonlySet<string> = new Set(),
): ScoredBook[] {
  const decided = new Set(state.entries.map((e) => e.book.id));
  const left = pool.filter((b) => !decided.has(b.id) && !exclude.has(b.id));
  return rankBooks(left, prefs, state.learned, { limit: Infinity });
}

/** Books the user reacted to with `action`, most recent first. */
export function booksWith(state: DeckState, action: Feedback): Book[] {
  return state.entries.filter((e) => e.action === action).map((e) => e.book).reverse();
}
