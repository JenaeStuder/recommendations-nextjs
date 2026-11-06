import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import {
  authorProfileSubjects,
  authorProfileTokens,
  distinctiveSubjects,
  hasTaste,
  stem,
  subjectTokens,
} from "./taste";

let n = 0;
const book = (over: Partial<Book> = {}): Book => ({
  id: `OL${++n}W`, title: `Book ${n}`, authors: ["A"], authorKeys: ["OL1A"], subjects: [], ...over,
});

describe("stem", () => {
  it("strips simple plurals", () => {
    expect(stem("dragons")).toBe("dragon");
    expect(stem("wizards")).toBe("wizard");
  });
  it("leaves '-ves' words alone so explanations read naturally", () => {
    expect(stem("elves")).toBe("elves");
    expect(stem("dwarves")).toBe("dwarves");
  });
  it("handles '-shes' / '-ches' and leaves non-plurals alone", () => {
    expect(stem("thrushes")).toBe("thrush");
    expect(stem("witches")).toBe("witch");
    expect(stem("magic")).toBe("magic");
    expect(stem("glass")).toBe("glass");
  });
});

describe("subjectTokens", () => {
  it("drops boilerplate and short words, keeping the order subjects were listed in", () => {
    expect(subjectTokens(["Fiction", "Juvenile fiction", "Dragons", "Large type books", "Magic and wizards"]))
      .toEqual(["dragon", "magic", "wizard"]);
  });
  it("treats accented and plain spellings alike, so foreign boilerplate is dropped too", () => {
    expect(subjectTokens(["Ficción juvenil", "Novela"])).toEqual([]);
    expect(subjectTokens(["Écosse"])).toEqual(["ecosse"]);
  });
  it("deduplicates", () => {
    expect(subjectTokens(["Dragons", "dragon", "DRAGONS"])).toEqual(["dragon"]);
  });
});

describe("distinctiveSubjects", () => {
  it("skips boilerplate, long strings, dates and colon-qualified entries", () => {
    const b = book({
      subjects: [
        "Fantasy", "Fiction", "General", "Dragons",
        "Smaug (fictitious character)".padEnd(40, "x"),
        "Tolkien, J. R. R. (John Ronald Reuel), 1892-1973",
        "Hobbit: an adaptation", "dragons",
      ],
    });
    expect(distinctiveSubjects(b)).toEqual(["fantasy", "dragons"]);
  });
  it("respects the max", () => {
    const b = book({ subjects: ["alpha one", "bravo two", "charlie three"] });
    expect(distinctiveSubjects(b, 2)).toHaveLength(2);
  });
});

describe("author profile", () => {
  const books = [
    book({ authorKeys: ["OL9A"], ratingsCount: 100, subjects: ["Epic", "Magic", "Quests"] }),
    book({ authorKeys: ["OL9A"], ratingsCount: 90, subjects: ["Epic", "Magic", "Betrayal"] }),
    book({ authorKeys: ["OL9A"], ratingsCount: 80, subjects: ["Epic", "Cooking"] }),
    book({ authorKeys: ["OL2A"], ratingsCount: 5000, subjects: ["Spaceships", "Spaceships"] }),
  ];
  it("keeps what many of the author's books share, most common first", () => {
    expect(authorProfileTokens(books, "OL9A")).toEqual(["epic", "magic"]);
  });
  it("ignores other authors' books, however popular", () => {
    expect(authorProfileTokens(books, "OL9A")).not.toContain("spaceship");
  });
  it("gives whole subject strings for searching", () => {
    expect(authorProfileSubjects(books, "OL9A")).toEqual(["epic", "magic"]);
  });
  it("is empty when there's nothing in common (or no books)", () => {
    expect(authorProfileTokens([], "OL9A")).toEqual([]);
    expect(authorProfileTokens([book({ authorKeys: ["OL9A"], subjects: ["Solo"] })], "OL9A")).toEqual([]);
  });
});

describe("hasTaste", () => {
  it("is true for a book or an author, false for neither", () => {
    expect(hasTaste({})).toBe(false);
    expect(hasTaste({ book: book() })).toBe(true);
    expect(hasTaste({ author: { id: "OL1A", name: "A" } })).toBe(true);
  });
});
