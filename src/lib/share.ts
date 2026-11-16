import type { Book } from "@/lib/open-library";

/**
 * Shareable shelves: `?shelf=OL123W,OL456W&list=to-read`. Only work ids travel in the link; the
 * page looks the books up when it opens, so a link stays small and never carries stale data.
 *
 * A link is untrusted input (anyone can edit it), so everything read from one is validated and
 * capped, and the `list` name comes from a fixed set rather than free text.
 */
export const SHELF_PARAM = "shelf";
export const LIST_PARAM = "list";
/** Most books one link can carry. Keeps the URL short and the lookup a single request. */
export const MAX_SHARED = 50;

export type ListName = "to-read" | "liked";
export const LIST_TITLES: Record<ListName, string> = { "to-read": "To read", liked: "Liked" };

const WORK_ID = /^OL\d+W$/;

export type SharedShelf = {
  ids: string[];
  list?: ListName;
  /** How many entries in the link were ignored (malformed, duplicated or over the cap). */
  ignored: number;
};

/** Reads the shelf out of a link's query string. Returns undefined if there is no `shelf` parameter at all. */
export function parseShelf(params: Pick<URLSearchParams, "get">): SharedShelf | undefined {
  const raw = params.get(SHELF_PARAM);
  if (raw === null) return undefined;
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = entries.filter((id) => WORK_ID.test(id));
  const unique = [...new Set(valid)];
  const ids = unique.slice(0, MAX_SHARED);
  const list = params.get(LIST_PARAM);
  return {
    ids,
    list: list === "to-read" || list === "liked" ? list : undefined,
    ignored: entries.length - ids.length,
  };
}

/** The link to share for these books. `base` is the page address without any query string. */
export function buildShareUrl(base: string, ids: string[], list: ListName): string {
  const params = new URLSearchParams();
  // Joined by hand: URLSearchParams would encode the commas as %2C, which works but reads badly.
  const shelf = ids.filter((id) => WORK_ID.test(id)).slice(0, MAX_SHARED).join(",");
  params.set(LIST_PARAM, list);
  return `${base}?${SHELF_PARAM}=${shelf}&${params}`;
}

/** Puts looked-up books back in the order the link listed them, and reports which ids weren't found. */
export function orderByIds(books: Book[], ids: string[]): { ordered: Book[]; missing: string[] } {
  const byId = new Map(books.map((b) => [b.id, b]));
  const ordered = ids.flatMap((id) => byId.get(id) ?? []);
  return { ordered, missing: ids.filter((id) => !byId.has(id)) };
}
