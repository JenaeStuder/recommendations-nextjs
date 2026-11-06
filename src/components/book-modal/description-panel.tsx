"use client";

import { useQuery } from "@tanstack/react-query";
import { OpenLibraryError, descriptionQueryOptions, type Book } from "@/lib/open-library";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function errorMessage(error: unknown): string {
  if (error instanceof OpenLibraryError) {
    if (error.kind === "rate-limit") return "Open Library is busy right now. Try again in a moment.";
    if (error.kind === "network") return "We couldn't reach Open Library. Check your connection and try again.";
  }
  return "We couldn't load this description.";
}

/**
 * A book's description with its loading, error and "none" states. Mounting it starts the
 * request (or reads the cache), so render it only when the description is actually wanted.
 */
export function DescriptionPanel({ book }: { book: Book }) {
  const { data, error, isPending, isError, refetch, isFetching } = useQuery(
    descriptionQueryOptions(book.id),
  );

  return (
    <div>
      {isPending && (
        <div>
          <p role="status" className="sr-only">Loading description</p>
          <div aria-hidden="true" className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-line" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-line" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
          </div>
        </div>
      )}

      {isError && (
        <div role="alert">
          <p>{errorMessage(error)}</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`mt-3 rounded-full border border-ink px-4 py-1.5 text-sm disabled:opacity-60 ${FOCUS}`}
          >
            {isFetching ? "Trying…" : "Try again"}
          </button>
        </div>
      )}

      {data && (
        <p className="leading-relaxed">
          {data.short || "No description is available for this book yet."}
        </p>
      )}

      {(data || isError) && (
        <p className="mt-3 text-sm">
          <a
            href={`https://openlibrary.org/works/${book.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 hover:text-accent ${FOCUS}`}
          >
            {data?.short ? "More on Open Library" : "View on Open Library"}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
    </div>
  );
}
