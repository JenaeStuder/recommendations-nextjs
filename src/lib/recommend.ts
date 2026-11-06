import { queryOptions } from "@tanstack/react-query";
import {
  GC_TIME,
  STALE_TIME,
  cachedSearch,
  searchBooks,
  type Book,
  type Range,
  type SearchFilters,
  type SearchResult,
} from "@/lib/open-library";
import { authorProfileSubjects, distinctiveSubjects, type Taste } from "@/lib/taste";
import {
  audiencesOf,
  erasOf,
  pagesOf,
  popularityOf,
  subjectsFor,
  type Answers,
  type Popularity,
} from "@/lib/questions";

/** Stop widening the search once we have this many candidates to rank. */
export const MIN_CANDIDATES = 30;
const CANDIDATES_PER_QUERY = 50;

/**
 * Ratings ranges to try in order, strictest first. Strict floors keep obscure
 * books from topping a sort by rating, but narrow answers can match nothing
 * (e.g. fantasy + dragons + 200-400 pages is 538 books with no floor, 0 with a floor of 50),
 * so we loosen step by step until there are enough candidates.
 */
export const RATINGS_LADDER: Record<Popularity, Range[]> = {
  popular: [{ min: 20 }, { min: 10 }, { min: 3 }],
  hidden: [{ min: 3, max: 19 }, { min: 1, max: 19 }],
  any: [{ min: 3 }, { min: 1 }],
};

/**
 * One list of filters per ladder step. Each step can have:
 * - genres + moods, then genres alone (so a narrow mood can't empty the results);
 * - "books like" the loved book: its distinctive subjects ORed together and left in
 *   relevance order, so books sharing the most subjects come first;
 * - (first step only) the loved author's own books, with no length/era/ratings limits,
 *   because "more by them" shouldn't be filtered out by other answers. The audience filter
 *   still applies, so an author who writes for children and adults doesn't mix them up.
 * Moods and similarity then re-rank in scoring.
 */
export function candidatePlan(
  a: Answers,
  taste: Taste = {},
  /** Subjects characterising a loved author, when there's no loved book to take them from. */
  profileSubjects: string[] = [],
): SearchFilters[][] {
  const genres = subjectsFor("genres", a.genres);
  const moods = subjectsFor("moods", a.moods);
  const similar = taste.book ? distinctiveSubjects(taste.book) : profileSubjects;
  const audiences = audiencesOf(a);
  const base: SearchFilters = {
    pages: pagesOf(a),
    years: erasOf(a),
    audiences,
    sort: "rating",
    limit: CANDIDATES_PER_QUERY,
  };

  const steps = RATINGS_LADDER[popularityOf(a)].map((ratings, i) => {
    const queries: SearchFilters[] = [];
    if (genres.length > 0) {
      const withGenres: SearchFilters = { ...base, ratings, subjectGroups: [genres] };
      if (moods.length > 0) queries.push({ ...withGenres, subjectGroups: [genres, moods] });
      queries.push(withGenres);
    }
    if (similar.length > 0) {
      queries.push({ ...base, ratings, sort: undefined, subjectGroups: [similar] });
    }
    if (i === 0 && taste.author) {
      queries.push({ authorKey: taste.author.id, audiences, sort: "rating", limit: 30 });
    }
    return queries;
  });
  return steps.filter((queries) => queries.length > 0);
}

type Search = (filters: SearchFilters, signal?: AbortSignal) => Promise<SearchResult>;

/** Fetches candidates, widening the ratings floor until there are enough. Deduplicates across queries. */
export async function fetchCandidates(
  a: Answers,
  taste: Taste = {},
  signal?: AbortSignal,
  search: Search = searchBooks,
): Promise<Book[]> {
  const found = new Map<string, Book>();
  let planTaste = taste;
  let profile: string[] = [];

  // Author but no book: first get their books, then use what they write about to find similar ones.
  if (taste.author && !taste.book) {
    const { books } = await search(
      { authorKey: taste.author.id, audiences: audiencesOf(a), sort: "rating", limit: 30 },
      signal,
    );
    for (const b of books) found.set(b.id, b);
    profile = authorProfileSubjects(books, taste.author.id);
    planTaste = {}; // their books are already in hand
  }

  for (const step of candidatePlan(a, planTaste, profile)) {
    const results = await Promise.all(step.map((f) => search(f, signal)));
    // Narrowest query first, so its books keep their place when deduplicating.
    for (const { books } of results) for (const b of books) if (!found.has(b.id)) found.set(b.id, b);
    if (found.size >= MIN_CANDIDATES) break;
  }
  return [...found.values()];
}

export const recommendationQueryOptions = (a: Answers, taste: Taste = {}) =>
  queryOptions({
    // Taste is keyed by id: the book's subjects are derived from it, so the id fully identifies the query.
    queryKey: ["books", "recommendations", a, taste.book?.id ?? null, taste.author?.id ?? null] as const,
    // Each underlying request is cached on its own too, so a different search that needs the same
    // request (e.g. the same genres plus a loved author) reuses it instead of fetching again.
    queryFn: ({ signal, client }) => fetchCandidates(a, taste, signal, cachedSearch(client)),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
