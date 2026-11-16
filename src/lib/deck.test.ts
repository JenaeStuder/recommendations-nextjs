import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import type { Preferences } from "@/lib/scoring";
import { EMPTY_DECK, booksWith, decide, undo, upcoming } from "./deck";

const book = (id: string, subjects: string[], author = id): Book => ({
  id,
  title: `Title ${id}`,
  authors: [author],
  authorKeys: [`OL${id.length}A`],
  subjects,
  rating: 4,
  ratingsCount: 100,
});

const prefs: Preferences = { signals: [], popularity: "any" };

describe("decide / undo", () => {
  const a = book("a", ["dragons", "magic"]);
  const b = book("b", ["space"]);

  it("records the decision and learns from it", () => {
    const s = decide(EMPTY_DECK, a, "like");
    expect(s.entries).toHaveLength(1);
    expect(s.learned.dragons).toBeGreaterThan(0);
  });

  it("ignores a second decision on the same book (a double key press)", () => {
    const once = decide(EMPTY_DECK, a, "skip");
    expect(decide(once, a, "like")).toBe(once);
  });

  it("undo restores the exact previous weights, not an approximation", () => {
    const s1 = decide(EMPTY_DECK, a, "like");
    const s2 = decide(s1, b, "skip");
    const { state, entry } = undo(s2);
    expect(entry?.book.id).toBe("b");
    expect(state.learned).toEqual(s1.learned);
    expect(state.learned.space).toBeUndefined();
    expect(state.entries).toHaveLength(1);
  });

  it("undo with nothing to undo changes nothing", () => {
    const { state, entry } = undo(EMPTY_DECK);
    expect(state).toBe(EMPTY_DECK);
    expect(entry).toBeUndefined();
  });

  it("undo makes the book a candidate again", () => {
    const s = decide(EMPTY_DECK, a, "skip");
    expect(upcoming([a, b], prefs, s).map((p) => p.book.id)).toEqual(["b"]);
    expect(upcoming([a, b], prefs, undo(s).state).map((p) => p.book.id).sort()).toEqual(["a", "b"]);
  });
});

describe("upcoming", () => {
  it("never shows a decided book again", () => {
    const pool = [book("a", ["x"]), book("b", ["x"]), book("c", ["x"])];
    const s = decide(decide(EMPTY_DECK, pool[0], "like"), pool[1], "save");
    expect(upcoming(pool, prefs, s).map((p) => p.book.id)).toEqual(["c"]);
  });

  it("moves books like the liked one up, and books like the skipped one down", () => {
    const liked = book("liked", ["dragons", "castles"], "Ann");
    const dragons = book("dragons2", ["dragons", "castles"], "Bob");
    const space = book("space1", ["space", "robots"], "Cy");
    const pool = [liked, space, dragons];
    const afterLike = upcoming(pool, prefs, decide(EMPTY_DECK, liked, "like"));
    expect(afterLike[0].book.id).toBe("dragons2");
    const afterSkip = upcoming(pool, prefs, decide(EMPTY_DECK, liked, "skip"));
    expect(afterSkip.at(-1)?.book.id).toBe("dragons2");
  });
});

describe("upcoming with exclusions", () => {
  it("leaves out books reacted to elsewhere (the list view)", () => {
    const pool = [book("a", ["x"]), book("b", ["x"]), book("c", ["x"])];
    expect(upcoming(pool, prefs, EMPTY_DECK, new Set(["b"])).map((p) => p.book.id).sort()).toEqual(["a", "c"]);
  });
});

describe("booksWith", () => {
  it("lists books by reaction, most recent first", () => {
    const [a, b, c] = [book("a", ["x"]), book("b", ["x"]), book("c", ["x"])];
    const s = decide(decide(decide(EMPTY_DECK, a, "like"), b, "skip"), c, "like");
    expect(booksWith(s, "like").map((x) => x.id)).toEqual(["c", "a"]);
    expect(booksWith(s, "save")).toEqual([]);
  });
});
