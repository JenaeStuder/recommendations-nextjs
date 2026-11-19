import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/contrast";
import { CLOTH, CLOTH_TEXT, clothFor } from "./cover-cloth";

describe("fallback cover colours", () => {
  it("gives the same book the same colour every time", () => {
    expect(clothFor("The Hobbit")).toBe(clothFor("The Hobbit"));
  });

  it("only ever picks from the curated bookcloth colours", () => {
    for (const title of ["", "A", "The Hobbit", "Words of Radiance", "日本語のタイトル", "x".repeat(500)]) {
      expect(CLOTH).toContain(clothFor(title));
    }
  });

  it("spreads different titles across several colours rather than one", () => {
    const titles = Array.from({ length: 60 }, (_, i) => `Book number ${i}`);
    expect(new Set(titles.map(clothFor)).size).toBeGreaterThanOrEqual(4);
  });

  it("keeps the title readable on every colour: AAA (7:1) or better", () => {
    for (const colour of CLOTH) expect(contrast(CLOTH_TEXT, colour)).toBeGreaterThanOrEqual(7);
  });

  it("keeps the author line readable too, where it is drawn at 90% opacity", () => {
    const blend = (c: string) =>
      "#" +
      [1, 3, 5]
        .map((i) => Math.round(parseInt(CLOTH_TEXT.slice(i, i + 2), 16) * 0.9 + parseInt(c.slice(i, i + 2), 16) * 0.1))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
    for (const colour of CLOTH) expect(contrast(blend(colour), colour)).toBeGreaterThanOrEqual(7);
  });
});
