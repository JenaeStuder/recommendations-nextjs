import { keepPreviousData, queryOptions, type QueryClient } from "@tanstack/react-query";
import { getTrendingBooks, searchAuthors, searchBooks } from "./client";
import { OpenLibraryError } from "./errors";
import type { Book, SearchFilters, SearchResult } from "./types";

const HOUR = 60 * 60 * 1000;

/** How long a response counts as fresh (no refetch). Open Library data changes slowly. */
export const STALE_TIME = HOUR;
/**
 * How long an unused response stays in memory. Longer than the default 5 minutes so that
 * "Start A New Search" can reuse earlier results; it's in memory only, so a page reload clears it.
 */
export const GC_TIME = 2 * HOUR;

export const bookKeys = {
  all: ["books"] as const,
  search: (filters: SearchFilters) => ["books", "search", filters] as const,
  trending: (limit: number) => ["books", "trending", limit] as const,
};

export const searchQueryOptions = (filters: SearchFilters) =>
  queryOptions({
    queryKey: bookKeys.search(filters),
    queryFn: ({ signal }) => searchBooks(filters, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
  });

/**
 * A `searchBooks` that goes through the query cache, one entry per distinct request.
 *
 * Why this can't serve false data: the cache key IS the request (query text, ranges, sort, page),
 * so a hit means the exact same question was already answered. Two different searches share an
 * entry only if they genuinely ask the same thing (e.g. plain "fantasy"); anything that differs,
 * like a loved book or author, is a different request and fetches fresh.
 *
 * The abort signal is deliberately not forwarded: if the page that asked goes away (or React
 * remounts in development), the request still finishes and is kept for the next search.
 */
export function cachedSearch(
  client: QueryClient,
  search: (filters: SearchFilters) => Promise<SearchResult> = searchBooks,
) {
  return (filters: SearchFilters): Promise<SearchResult> =>
    client.fetchQuery({
      queryKey: bookKeys.search(filters),
      queryFn: () => search(filters),
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    });
}

export const trendingQueryOptions = (limit = 20) =>
  queryOptions({
    queryKey: bookKeys.trending(limit),
    queryFn: ({ signal }) => getTrendingBooks(limit, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

/** Don't hammer the API: retry network/5xx twice, never retry 4xx or rate limits. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof OpenLibraryError) {
    if (error.kind === "rate-limit" || error.kind === "parse") return false;
    if (error.kind === "http" && error.status && error.status < 500) return false;
  }
  return true;
}

const MIN_SUGGEST_CHARS = 3;

/**
 * Title search returns many editions and box sets of the same book. Collapse
 * duplicates (same title and first author) and put the best-known edition first.
 */
export function suggestBooks(books: Book[], limit = 6): Book[] {
  const best = new Map<string, Book>();
  for (const b of books) {
    const key = `${b.title.trim().toLowerCase()}|${(b.authors[0] ?? "").toLowerCase()}`;
    const current = best.get(key);
    if (!current || (b.ratingsCount ?? 0) > (current.ratingsCount ?? 0)) best.set(key, b);
  }
  return [...best.values()]
    .sort((a, b) => (b.ratingsCount ?? 0) - (a.ratingsCount ?? 0))
    .slice(0, limit);
}

export const bookSuggestionsQueryOptions = (text: string) =>
  queryOptions({
    queryKey: ["books", "suggestions", text] as const,
    queryFn: async ({ signal }) =>
      suggestBooks((await searchBooks({ text, limit: 12 }, signal)).books),
    enabled: text.trim().length >= MIN_SUGGEST_CHARS,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

export const authorSuggestionsQueryOptions = (text: string) =>
  queryOptions({
    queryKey: ["authors", "suggestions", text] as const,
    queryFn: ({ signal }) => searchAuthors(text, 6, signal),
    enabled: text.trim().length >= MIN_SUGGEST_CHARS,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
