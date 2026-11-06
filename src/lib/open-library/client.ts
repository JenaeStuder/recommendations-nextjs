import { audienceClause } from "./audience";
import { parseDescription, type BookDescription } from "./description";
import { OpenLibraryError } from "./errors";
import { isUnbounded, mergeRanges } from "./ranges";
import type {
  Author,
  Book,
  RawAuthorsResponse,
  RawSearchDoc,
  RawSearchResponse,
  RawTrendingResponse,
  Range,
  SearchFilters,
  SearchResult,
} from "./types";

const BASE_URL = "https://openlibrary.org";

/** Only request what we use; keeps responses small and the API happy. */
const FIELDS = [
  "key",
  "title",
  "author_name",
  "author_key",
  "first_publish_year",
  "number_of_pages_median",
  "ratings_average",
  "ratings_count",
  "subject",
  "cover_i",
].join(",");

const DEFAULT_LIMIT = 20;

function normalize(doc: RawSearchDoc): Book {
  return {
    id: doc.key.replace("/works/", ""),
    title: doc.title ?? "Untitled",
    authors: doc.author_name ?? [],
    authorKeys: doc.author_key ?? [],
    firstPublishYear: doc.first_publish_year,
    pages: doc.number_of_pages_median,
    rating: doc.ratings_average,
    ratingsCount: doc.ratings_count,
    subjects: doc.subject ?? [],
    coverId: doc.cover_i,
  };
}

function oneRange(field: string, range: Range): string {
  return `${field}:[${range.min ?? "*"} TO ${range.max ?? "*"}]`;
}

/** One clause for a union of ranges: `field:[a TO b]`, or `(field:[a TO b] OR field:[c TO d])`. */
function rangeClause(field: string, ranges?: Range[]): string | undefined {
  if (!ranges || ranges.length === 0) return undefined;
  const merged = mergeRanges(ranges);
  if (merged.some(isUnbounded)) return undefined; // everything matches
  const clauses = merged.map((r) => oneRange(field, r));
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(" OR ")})`;
}

function groupClause(group: string[]): string {
  const terms = group.map((s) => `subject:"${s.replace(/"/g, "")}"`);
  return terms.length === 1 ? terms[0] : `(${terms.join(" OR ")})`;
}

/**
 * User text goes into a Solr query, where characters like `:` `(` `"` are operators.
 * Replace them with spaces so typing "Dune: Messiah (1969)" searches instead of erroring.
 */
export function sanitizeText(text: string): string {
  return text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();
}

const AUTHOR_KEY = /^OL\d+A$/;

/** Builds the Solr `q` string from structured filters. Exported for tests. */
export function buildQuery(filters: SearchFilters): string {
  const clauses = [
    filters.text ? sanitizeText(filters.text) : undefined,
    filters.authorKey && AUTHOR_KEY.test(filters.authorKey) ? `author_key:${filters.authorKey}` : undefined,
    ...(filters.subjectGroups ?? []).filter((g) => g.length > 0).map(groupClause),
    filters.audiences ? audienceClause(filters.audiences) : undefined,
    rangeClause("first_publish_year", filters.years),
    rangeClause("number_of_pages_median", filters.pages),
    rangeClause("ratings_count", filters.ratings ? [filters.ratings] : undefined),
  ];
  return clauses.filter(Boolean).join(" ") || "*:*";
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    // Let aborts propagate untouched so TanStack Query can cancel quietly.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new OpenLibraryError("network", "Couldn't reach Open Library.");
  }
  if (res.status === 429) {
    throw new OpenLibraryError(
      "rate-limit",
      "Open Library is busy. Try again in a moment.",
      429,
    );
  }
  if (!res.ok) {
    throw new OpenLibraryError(
      "http",
      `Open Library returned ${res.status}.`,
      res.status,
    );
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new OpenLibraryError("parse", "Unexpected response from Open Library.");
  }
}

export async function searchBooks(
  filters: SearchFilters,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const page = filters.page ?? 1;
  const params = new URLSearchParams({
    q: buildQuery(filters),
    fields: FIELDS,
    limit: String(limit),
    offset: String((page - 1) * limit),
  });
  if (filters.sort) params.set("sort", filters.sort);

  const data = await getJson<RawSearchResponse>(
    `${BASE_URL}/search.json?${params}`,
    signal,
  );
  return { books: data.docs.map(normalize), total: data.numFound };
}

/** Weekly trending books. No ratings/pages here, so those fields are undefined. */
export async function getTrendingBooks(
  limit = DEFAULT_LIMIT,
  signal?: AbortSignal,
): Promise<Book[]> {
  const data = await getJson<RawTrendingResponse>(
    `${BASE_URL}/trending/weekly.json?limit=${limit}`,
    signal,
  );
  return data.works.map(normalize);
}

/** Author lookup for the "an author you love" field. */
export async function searchAuthors(
  text: string,
  limit = 6,
  signal?: AbortSignal,
): Promise<Author[]> {
  const q = sanitizeText(text);
  if (!q) return [];
  const params = new URLSearchParams({ q, limit: String(limit) });
  const data = await getJson<RawAuthorsResponse>(
    `${BASE_URL}/search/authors.json?${params}`,
    signal,
  );
  return data.docs.map((d) => ({
    id: d.key,
    name: d.name ?? "Unknown author",
    topWork: d.top_work,
    workCount: d.work_count,
  }));
}

const WORK_ID = /^OL\d+W$/;
const NO_DESCRIPTION: BookDescription = { full: "", short: "" };

/**
 * A book's description from its Open Library work record. Costs one request (about 1 to 2 s),
 * so call it on demand, not for a whole list. A missing record or description is "no
 * description" (empty strings), not an error; network and server errors still throw.
 */
export async function getWorkDescription(
  workId: string,
  signal?: AbortSignal,
): Promise<BookDescription> {
  if (!WORK_ID.test(workId)) return NO_DESCRIPTION; // never build a URL from an unexpected id
  try {
    const work = await getJson<{ description?: unknown }>(`${BASE_URL}/works/${workId}.json`, signal);
    return parseDescription(work.description);
  } catch (err) {
    if (err instanceof OpenLibraryError && err.kind === "http" && err.status === 404) {
      return NO_DESCRIPTION;
    }
    throw err;
  }
}
