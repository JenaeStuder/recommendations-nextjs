import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import { EMPTY_ANSWERS, type Answers } from "@/lib/questions";
import { toPreferences } from "./preferences";

const answers = (patch: Partial<Answers>): Answers => ({ ...EMPTY_ANSWERS, ...patch });

const book = (id: string, authorKey: string, subjects: string[]): Book => ({
  id,
  title: `Book ${id}`,
  authors: ["An Author"],
  authorKeys: [authorKey],
  subjects,
});

describe("toPreferences", () => {
  it("is empty and neutral when nothing was answered", () => {
    const p = toPreferences(EMPTY_ANSWERS);
    expect(p.signals).toEqual([]);
    expect(p.pages).toEqual([]);
    expect(p.years).toEqual([]);
    expect(p.popularity).toBe("any");
    expect(p.similarTo).toBeUndefined();
    expect(p.favouriteAuthor).toBeUndefined();
  });

  it("turns chosen genres and moods into signals that carry the subjects to match", () => {
    const p = toPreferences(answers({ genres: ["fantasy"], moods: ["cozy"] }));
    expect(p.signals.map((s) => [s.id, s.kind])).toEqual([
      ["fantasy", "genre"],
      ["cozy", "mood"],
    ]);
    expect(p.signals[0].subjects).toContain("fantasy");
    expect(p.signals[1].subjects).toContain("cozy");
  });

  it("ignores answers that are not real options", () => {
    expect(toPreferences(answers({ genres: ["not-a-genre"] })).signals).toEqual([]);
  });

  it("merges chosen lengths and eras into ranges, and reads the single popularity choice", () => {
    const p = toPreferences(answers({ length: ["quick", "medium"], era: ["new"], popularity: ["hidden"] }));
    expect(p.pages).toEqual([{ max: 450 }]);
    expect(p.years).toEqual([{ min: 2015 }]);
    expect(p.popularity).toBe("hidden");
  });

  it("uses a loved book's subjects as the similarity target", () => {
    const loved = book("OL1W", "OL1A", ["Dragons", "Magic"]);
    const p = toPreferences(EMPTY_ANSWERS, { book: loved });
    expect(p.similarTo?.id).toBe("OL1W");
    expect(p.similarTo?.title).toBe("Book OL1W");
    expect(p.similarTo?.tokens.length).toBeGreaterThan(0);
  });

  it("remembers a loved author, and profiles what they write about from the candidates", () => {
    const author = { id: "OL9A", name: "Ada Writer" };
    const candidates = [
      book("OL2W", "OL9A", ["space opera", "aliens"]),
      book("OL3W", "OL9A", ["space opera", "aliens"]),
      book("OL4W", "OL5A", ["gardening"]),
    ];
    const p = toPreferences(EMPTY_ANSWERS, { author }, candidates);
    expect(p.favouriteAuthor).toEqual(author);
    expect(p.similarTo?.title).toBe("Ada Writer's books");
    expect(p.similarTo?.tokens).toContain("space");
    expect(p.similarTo?.tokens).not.toContain("gardening");
  });

  it("has no similarity target for an author with no books among the candidates", () => {
    const p = toPreferences(EMPTY_ANSWERS, { author: { id: "OL9A", name: "Ada Writer" } }, []);
    expect(p.favouriteAuthor?.name).toBe("Ada Writer");
    expect(p.similarTo).toBeUndefined();
  });

  it("prefers a loved book over a loved author as the similarity target", () => {
    const loved = book("OL1W", "OL1A", ["Dragons"]);
    const p = toPreferences(EMPTY_ANSWERS, { book: loved, author: { id: "OL9A", name: "Ada Writer" } });
    expect(p.similarTo?.id).toBe("OL1W");
    expect(p.favouriteAuthor?.id).toBe("OL9A");
  });
});
