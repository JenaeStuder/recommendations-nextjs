import type { Range } from "./types";

/**
 * Unions overlapping or adjacent integer ranges ("under 250" + "250 to 450" = "under 451"), so a
 * multi-select becomes the smallest set of clauses. Open-ended sides (undefined) are unbounded.
 */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && (last.max === undefined || (r.min ?? -Infinity) <= last.max + 1)) {
      last.max = last.max === undefined || r.max === undefined ? undefined : Math.max(last.max, r.max);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** True when a range has no bounds at all, i.e. it matches everything. */
export const isUnbounded = (r: Range): boolean => r.min === undefined && r.max === undefined;

/** True if the value is inside the range (bounds are inclusive). */
export function inRange(value: number, r: Range): boolean {
  return (r.min === undefined || value >= r.min) && (r.max === undefined || value <= r.max);
}
