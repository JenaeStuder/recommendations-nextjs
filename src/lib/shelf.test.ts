import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import { booksOn, isBook, sanitizeReactions, setFlag, type Reactions } from "./shelf";

const book = (n: number, extra: Partial<Book> = {}): Book => ({
  id: `OL${n}W`,
  title: `Book ${n}`,
  authors: ["A"],
  authorKeys: ["OL1A"],
  subjects: ["x"],
  ...extra,
});

describe("setFlag", () => {
  it("adds a book on its first flag", () => {
    const r = setFlag({}, book(1), "saved", true, 10);
    expect(r.OL1W).toMatchObject({ saved: 10, liked: null });
  });

  it("keeps the other flag when one is set or cleared", () => {
    let r = setFlag({}, book(1), "liked", true, 1);
    r = setFlag(r, book(1), "saved", true, 2);
    expect(r.OL1W).toMatchObject({ liked: 1, saved: 2 });
    r = setFlag(r, book(1), "liked", false, 3);
    expect(r.OL1W).toMatchObject({ liked: null, saved: 2 });
  });

  it("forgets a book once neither flag is left", () => {
    let r = setFlag({}, book(1), "liked", true);
    r = setFlag(r, book(1), "liked", false);
    expect(r).toEqual({});
  });

  it("pressing an already-on flag keeps its original time", () => {
    const r = setFlag(setFlag({}, book(1), "saved", true, 1), book(1), "saved", true, 99);
    expect(r.OL1W.saved).toBe(1);
  });

  it("un-liking does not move the book on another shelf", () => {
    let r = setFlag({}, book(1), "saved", true, 1);
    r = setFlag(r, book(2), "saved", true, 2);
    r = setFlag(r, book(1), "liked", true, 3);
    r = setFlag(r, book(1), "liked", false, 4);
    expect(booksOn(r, "saved").map((b) => b.id)).toEqual(["OL2W", "OL1W"]);
  });

  it("clearing a flag on an unknown book returns the same object", () => {
    const r: Reactions = {};
    expect(setFlag(r, book(1), "saved", false)).toBe(r);
  });

  it("does not mutate the previous state", () => {
    const before = setFlag({}, book(1), "liked", true, 1);
    const snapshot = JSON.stringify(before);
    setFlag(before, book(1), "saved", true, 2);
    setFlag(before, book(1), "liked", false, 3);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("booksOn", () => {
  it("lists one shelf, most recently changed first", () => {
    let r = setFlag({}, book(1), "saved", true, 1);
    r = setFlag(r, book(2), "saved", true, 3);
    r = setFlag(r, book(3), "liked", true, 2);
    expect(booksOn(r, "saved").map((b) => b.id)).toEqual(["OL2W", "OL1W"]);
    expect(booksOn(r, "liked").map((b) => b.id)).toEqual(["OL3W"]);
  });
});

describe("sanitizeReactions", () => {
  const good = setFlag({}, book(1), "saved", true, 5);

  it("keeps valid data as it is", () => {
    expect(sanitizeReactions(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it.each([null, undefined, "x", 5, [], true])("gives an empty shelf for %j", (raw) => {
    expect(sanitizeReactions(raw)).toEqual({});
  });

  it("drops entries that are malformed and keeps the good ones", () => {
    const raw = {
      ...good,
      OL2W: { book: { id: "OL2W", title: 5 }, liked: 1, saved: null }, // wrong shape
      OL3W: { book: book(3), liked: null, saved: null }, // no flag set
      OL4W: { book: book(5), liked: 1, saved: null }, // id doesn't match its key
      OL5W: null,
      OL6W: "nope",
    };
    expect(Object.keys(sanitizeReactions(raw))).toEqual(["OL1W"]);
  });

  it("treats anything that isn't a positive time as off", () => {
    const r = sanitizeReactions({ OL1W: { book: book(1), liked: "yes", saved: 7 }, OL2W: { book: book(2), liked: true, saved: -1 }, OL3W: { book: book(3), liked: NaN, saved: 0 } });
    expect(r.OL1W).toMatchObject({ liked: null, saved: 7 });
    expect(Object.keys(r)).toEqual(["OL1W"]);
  });
});

describe("isBook", () => {
  it("rejects ids that are not work ids (they end up in URLs)", () => {
    expect(isBook(book(1))).toBe(true);
    expect(isBook({ ...book(1), id: "../evil" })).toBe(false);
    expect(isBook({ ...book(1), authors: "A" })).toBe(false);
    expect(isBook({ ...book(1), coverId: "7" })).toBe(false);
  });
});
