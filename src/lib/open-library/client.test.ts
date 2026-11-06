import { describe, expect, it } from "vitest";
import { buildQuery, sanitizeText } from "./client";
import { suggestBooks } from "./queries";
import type { Book } from "./types";

describe("sanitizeText", () => {
  it("turns search-engine operators into spaces", () => {
    expect(sanitizeText('Dune: Messiah (1969)')).toBe("Dune Messiah 1969");
    expect(sanitizeText('title:"x" OR author:y')).toBe("title x OR author y");
    expect(sanitizeText("a*b?c~d")).toBe("a b c d");
  });
  it("collapses whitespace and trims", () => {
    expect(sanitizeText("  the   hobbit ")).toBe("the hobbit");
  });
  it("can reduce input to nothing", () => {
    expect(sanitizeText(' :() "" ')).toBe("");
  });
});

describe("buildQuery", () => {
  it("sanitises free text", () => {
    expect(buildQuery({ text: "Dune: Messiah" })).toBe("Dune Messiah");
  });
  it("adds an author clause for valid keys only", () => {
    expect(buildQuery({ authorKey: "OL26320A" })).toBe("author_key:OL26320A");
    // An attacker-style or malformed key must not reach the query.
    expect(buildQuery({ authorKey: "OL1A OR subject:x" })).toBe("*:*");
  });
  it("ORs subjects within a group and ANDs groups", () => {
    expect(buildQuery({ subjectGroups: [["a", "b"], ["c"]] })).toBe(
      '(subject:"a" OR subject:"b") subject:"c"',
    );
  });
  it("skips empty groups and falls back to match-all", () => {
    expect(buildQuery({ subjectGroups: [[]] })).toBe("*:*");
  });
});

let n = 0;
const b = (title: string, author: string, ratingsCount?: number): Book => ({
  id: `OL${++n}W`, title, authors: [author], authorKeys: [], subjects: [], ratingsCount,
});

describe("suggestBooks", () => {
  it("collapses editions of the same book, keeping the best-known", () => {
    const out = suggestBooks([b("The Hobbit", "Tolkien", 37), b("The Hobbit", "Tolkien", 507), b("the hobbit ", "tolkien", 5)]);
    expect(out).toHaveLength(1);
    expect(out[0].ratingsCount).toBe(507);
  });
  it("keeps same-titled books by different authors", () => {
    expect(suggestBooks([b("The Hobbit", "Tolkien", 5), b("The Hobbit", "Someone Else", 4)])).toHaveLength(2);
  });
  it("orders by how well-known they are and respects the limit", () => {
    const out = suggestBooks([b("A", "x", 1), b("B", "y", 50), b("C", "z", 10)], 2);
    expect(out.map((x) => x.title)).toEqual(["B", "C"]);
  });
});
