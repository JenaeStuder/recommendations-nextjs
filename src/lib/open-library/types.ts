/** Normalized book used throughout the app (independent of API response shape). */
export type Book = {
  /** Work id without the `/works/` prefix, e.g. `OL8400950W`. Used in share URLs. */
  id: string;
  title: string;
  authors: string[];
  /** Open Library author keys (e.g. `OL26320A`), parallel to `authors`. */
  authorKeys: string[];
  firstPublishYear?: number;
  pages?: number;
  rating?: number;
  ratingsCount?: number;
  subjects: string[];
  coverId?: number;
};

import type { Audience } from "./audience";

export type Range = { min?: number; max?: number };

export type SearchSort = "rating" | "new" | "old" | "random" | "editions";

export type SearchFilters = {
  /**
   * Each group is matched as `(subject:"a" OR subject:"b")`; groups are ANDed.
   * e.g. [["fantasy"], ["cozy", "friendship"]] = fantasy AND (cozy OR friendship).
   */
  subjectGroups?: string[][];
  /** Free-text query (title, author…). Sanitised before it reaches the search engine. */
  text?: string;
  /** Books by one author, e.g. `OL26320A`. */
  authorKey?: string;
  /** Heuristic age grouping from subject tags. Empty or all three means no filter. */
  audiences?: Audience[];
  /** Any of these (a union). Empty or unbounded means no filter. */
  years?: Range[];
  pages?: Range[];
  /** Range on number of ratings. A floor avoids obscure books topping `sort=rating`. */
  ratings?: Range;
  sort?: SearchSort;
  limit?: number;
  /** 1-based page number. */
  page?: number;
};

export type SearchResult = {
  books: Book[];
  total: number;
};

/** Raw shapes from Open Library (only the fields we request/use). */
export type RawSearchDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
  subject?: string[];
  cover_i?: number;
};

export type RawSearchResponse = {
  numFound: number;
  docs: RawSearchDoc[];
};

export type RawTrendingResponse = {
  works: RawSearchDoc[];
};

export type Author = {
  /** e.g. `OL26320A` */
  id: string;
  name: string;
  topWork?: string;
  workCount?: number;
};

export type RawAuthorDoc = {
  key: string;
  name?: string;
  top_work?: string;
  work_count?: number;
};

export type RawAuthorsResponse = {
  docs: RawAuthorDoc[];
};
