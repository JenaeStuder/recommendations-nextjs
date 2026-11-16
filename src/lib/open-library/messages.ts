import { OpenLibraryError } from "./errors";

/** A friendly sentence for a failed Open Library request. */
export function errorMessage(error: unknown): string {
  if (error instanceof OpenLibraryError) {
    if (error.kind === "rate-limit") return "Open Library is getting a lot of requests. Give it a minute, then try again.";
    if (error.kind === "network") return "We couldn't reach Open Library. Check your connection and try again.";
  }
  return "Something went wrong while fetching books.";
}
