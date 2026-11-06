export type CoverSize = "S" | "M" | "L";

/** Returns undefined when the book has no cover so callers render a fallback. */
export function coverUrl(
  coverId: number | undefined,
  size: CoverSize = "M",
): string | undefined {
  if (!coverId) return undefined;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}
