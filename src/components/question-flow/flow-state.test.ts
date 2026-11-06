import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import { INITIAL_STATE, reducer, type State } from "./flow-state";

const book: Book = { id: "OL1W", title: "The Hobbit", authors: ["T"], authorKeys: ["OL1A"], subjects: [] };
const run = (state: State, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, state);
const toggle = (question: "genres" | "audience" | "moods" | "length" | "era" | "popularity", option: string) =>
  ({ type: "toggle", question, option }) as const;

describe("toggle", () => {
  it("adds and removes options on multi-choice questions", () => {
    const s = run(INITIAL_STATE, toggle("genres", "fantasy"), toggle("genres", "mystery"));
    expect(s.answers.genres).toEqual(["fantasy", "mystery"]);
    expect(run(s, toggle("genres", "fantasy")).answers.genres).toEqual(["mystery"]);
  });

  it("ignores a pick past the cap (genres allow 3)", () => {
    const s = run(INITIAL_STATE, ...["fantasy", "scifi", "mystery", "romance"].map((o) => toggle("genres", o)));
    expect(s.answers.genres).toEqual(["fantasy", "scifi", "mystery"]);
  });

  it("lets uncapped multi-choice questions take everything (length)", () => {
    const s = run(INITIAL_STATE, toggle("length", "quick"), toggle("length", "medium"), toggle("length", "epic"));
    expect(s.answers.length).toEqual(["quick", "medium", "epic"]);
  });

  it("keeps one answer on single-choice questions, replacing it, and clears on a second click", () => {
    const s = run(INITIAL_STATE, toggle("popularity", "popular"), toggle("popularity", "hidden"));
    expect(s.answers.popularity).toEqual(["hidden"]);
    expect(run(s, toggle("popularity", "hidden")).answers.popularity).toEqual([]);
  });

  it("doesn't mutate earlier state", () => {
    const before = INITIAL_STATE.answers.genres;
    run(INITIAL_STATE, toggle("genres", "fantasy"));
    expect(INITIAL_STATE.answers.genres).toBe(before);
    expect(before).toEqual([]);
  });
});

describe("taste", () => {
  it("sets and clears a book and an author independently", () => {
    let s = run(INITIAL_STATE, { type: "book", book }, { type: "author", author: { id: "OL1A", name: "T" } });
    expect(s.taste.book?.id).toBe("OL1W");
    s = run(s, { type: "book", book: undefined });
    expect(s.taste.book).toBeUndefined();
    expect(s.taste.author?.id).toBe("OL1A");
  });
});

describe("reset (Start A New Search)", () => {
  const dirty = run(
    INITIAL_STATE,
    toggle("genres", "fantasy"),
    toggle("audience", "adult"),
    toggle("length", "quick"),
    { type: "book", book },
    { type: "author", author: { id: "OL1A", name: "T" } },
    { type: "go", step: 3 },
  );

  it("clears every answer, the book and the author, and returns to the first screen", () => {
    const s = run(dirty, { type: "reset" });
    expect(s).toEqual(INITIAL_STATE);
    expect(s.step).toBe(0);
    expect(s.taste).toEqual({});
    expect(Object.values(s.answers).every((a) => a.length === 0)).toBe(true);
  });

  it("the starting point really was dirty (so the test above proves something)", () => {
    expect(dirty.step).toBe(3);
    expect(dirty.answers.genres).toEqual(["fantasy"]);
    expect(dirty.taste.book).toBeDefined();
  });
});
