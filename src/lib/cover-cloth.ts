/** Text colour on a fallback cover. */
export const CLOTH_TEXT = "#f8f1e7";

/** Bookcloth colours for covers with no image: deep and muted, each 10:1+ against `CLOTH_TEXT`. */
export const CLOTH = ["#5c2433", "#3f3a5c", "#2f4a3f", "#5a3d28", "#27414f", "#4d2f4a"];

/** Deterministic pick from the title, so the same book always gets the same fallback cover. */
export function clothFor(title: string): string {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return CLOTH[h % CLOTH.length];
}
