import { describe, expect, it } from "vitest";
import { buildQuery } from "./client";
import { inRange, isUnbounded, mergeRanges } from "./ranges";

describe("mergeRanges", () => {
  it("merges adjacent integer ranges", () => {
    expect(mergeRanges([{ max: 249 }, { min: 250, max: 450 }])).toEqual([{ max: 450 }]);
  });
  it("merges overlapping ranges regardless of input order", () => {
    expect(mergeRanges([{ min: 300, max: 500 }, { min: 100, max: 350 }])).toEqual([{ min: 100, max: 500 }]);
  });
  it("keeps separated ranges apart, sorted", () => {
    expect(mergeRanges([{ min: 451 }, { max: 249 }])).toEqual([{ max: 249 }, { min: 451 }]);
  });
  it("lets an open-ended range absorb everything after it", () => {
    expect(mergeRanges([{ min: 451 }, { min: 600, max: 700 }])).toEqual([{ min: 451 }]);
  });
  it("becomes unbounded when the ranges cover everything", () => {
    const all = mergeRanges([{ max: 249 }, { min: 250, max: 450 }, { min: 451 }]);
    expect(all).toHaveLength(1);
    expect(isUnbounded(all[0])).toBe(true);
  });
  it("doesn't mutate its input", () => {
    const input = [{ max: 249 }, { min: 250, max: 450 }];
    mergeRanges(input);
    expect(input).toEqual([{ max: 249 }, { min: 250, max: 450 }]);
  });
  it("handles empty input", () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

describe("inRange", () => {
  it("is inclusive and respects open ends", () => {
    expect(inRange(250, { min: 250, max: 450 })).toBe(true);
    expect(inRange(451, { min: 250, max: 450 })).toBe(false);
    expect(inRange(10_000, { min: 451 })).toBe(true);
  });
});

describe("buildQuery with range unions", () => {
  it("emits one clause for a single (or merged) range", () => {
    expect(buildQuery({ pages: [{ min: 250, max: 450 }] })).toBe("number_of_pages_median:[250 TO 450]");
    expect(buildQuery({ pages: [{ max: 249 }, { min: 250, max: 450 }] })).toBe("number_of_pages_median:[* TO 450]");
  });
  it("ORs ranges that don't touch", () => {
    expect(buildQuery({ pages: [{ max: 249 }, { min: 451 }] })).toBe(
      "(number_of_pages_median:[* TO 249] OR number_of_pages_median:[451 TO *])",
    );
  });
  it("adds no clause when empty or when everything is selected", () => {
    expect(buildQuery({ pages: [] })).toBe("*:*");
    expect(buildQuery({ years: [{ max: 1969 }, { min: 1970, max: 2014 }, { min: 2015 }] })).toBe("*:*");
  });
});
