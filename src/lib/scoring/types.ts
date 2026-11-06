import type { Book, Range } from "@/lib/open-library";
import type { Popularity } from "@/lib/questions";

/** One thing the user asked for (a genre or mood) and the subject strings that count as a match. */
export type Signal = {
  id: string;
  label: string;
  kind: "genre" | "mood";
  subjects: string[];
};

export type Preferences = {
  signals: Signal[];
  /** A book the user loved: similar books score higher and the book itself is never recommended. */
  similarTo?: { id: string; title: string; tokens: string[] };
  /** An author the user loved: their books score higher. */
  favouriteAuthor?: { id: string; name: string };
  /** Any of these (a union). Empty or absent = no preference. */
  pages?: Range[];
  years?: Range[];
  popularity: Popularity;
};

/** Learned affinity per normalized subject. Positive = liked, negative = skipped. */
export type LearnedWeights = Record<string, number>;

export type ScoredBook = {
  book: Book;
  /** Roughly 0 to 1, plus a small learned adjustment. Only meaningful relative to other books. */
  score: number;
  matched: Signal[];
  /** Plain-language reason, e.g. "Because you picked Fantasy and Cozy". */
  explanation: string;
};

export type Feedback = "like" | "skip" | "save";
