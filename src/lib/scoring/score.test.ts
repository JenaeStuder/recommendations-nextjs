import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import { EMPTY_ANSWERS } from "@/lib/questions";
import { toPreferences } from "./preferences";
import {
  awareness,
  similarity,
  diversify,
  learn,
  matchesSubject,
  qualityScore,
  rangeFit,
  rankBooks,
  scoreBook,
} from "./score";
import type { Preferences } from "./types";

let n = 0;
const book = (over: Partial<Book> = {}): Book => ({
  id: `OL${++n}W`,
  title: `Book ${n}`,
  authors: [`Author ${n}`],
  authorKeys: [`OL${n}A`],
  subjects: [],
  ...over,
});

const prefs = (over: Partial<Preferences> = {}): Preferences => ({
  signals: [],
  popularity: "any",
  ...over,
});

const fantasy = { id: "fantasy", label: "Fantasy", kind: "genre" as const, subjects: ["fantasy"] };
const cozy = { id: "cozy", label: "Cozy", kind: "mood" as const, subjects: ["cozy", "friendship"] };

describe("matchesSubject", () => {
  it("finds a term inside messy subject strings", () => {
    expect(matchesSubject(["Fiction, fantasy, general"], "fantasy")).toBe(true);
    expect(matchesSubject(["Epic Fantasy"], "fantasy")).toBe(true);
  });
  it("is case-insensitive and allows plurals", () => {
    expect(matchesSubject(["Thrillers"], "thriller")).toBe(true);
    expect(matchesSubject(["FANTASY"], "Fantasy")).toBe(true);
  });
  it("respects word boundaries", () => {
    expect(matchesSubject(["warrior"], "war")).toBe(false);
    expect(matchesSubject(["Wars of the Roses"], "war")).toBe(true);
  });
  it("doesn't treat regex characters as syntax", () => {
    expect(matchesSubject(["c++ programming"], "c++")).toBe(false);
    expect(() => matchesSubject(["x"], "(unclosed")).not.toThrow();
  });
});

describe("qualityScore", () => {
  it("trusts many ratings over a perfect score from a few", () => {
    const few = qualityScore(book({ rating: 5, ratingsCount: 3 }));
    const many = qualityScore(book({ rating: 4.5, ratingsCount: 500 }));
    expect(many).toBeGreaterThan(few);
  });
  it("treats unrated books as average, not as zero", () => {
    expect(qualityScore(book())).toBeCloseTo(0.4);
  });
});

describe("awareness", () => {
  it("rises with ratings count and caps at 1", () => {
    expect(awareness(book({ ratingsCount: 0 }))).toBe(0);
    expect(awareness(book({ ratingsCount: 10 }))).toBeLessThan(awareness(book({ ratingsCount: 100 })));
    expect(awareness(book({ ratingsCount: 100000 }))).toBe(1);
  });
});

describe("rangeFit", () => {
  const medium = [{ min: 250, max: 450 }];
  it("is 1 inside the range, including the edges", () => {
    expect(rangeFit(250, medium, 200)).toBe(1);
    expect(rangeFit(450, medium, 200)).toBe(1);
  });
  it("decays with distance and bottoms out at 0", () => {
    expect(rangeFit(350 + 200, medium, 200)).toBeCloseTo(0.5);
    expect(rangeFit(2000, medium, 200)).toBe(0);
  });
  it("handles open-ended ranges", () => {
    expect(rangeFit(900, [{ min: 451 }], 200)).toBe(1);
    expect(rangeFit(100, [{ max: 249 }], 200)).toBe(1);
  });
  it("fits a book to the nearest of several ranges", () => {
    const quickOrEpic = [{ max: 249 }, { min: 451 }];
    expect(rangeFit(100, quickOrEpic, 200)).toBe(1); // in "quick"
    expect(rangeFit(900, quickOrEpic, 200)).toBe(1); // in "epic"
    // 350 pages is 101 from quick and 101 from epic: equally far from both
    expect(rangeFit(350, quickOrEpic, 200)).toBeCloseTo(1 - 101 / 200);
    // 260 pages is much nearer "quick" than "epic", and is scored by the nearer one
    expect(rangeFit(260, quickOrEpic, 200)).toBeCloseTo(1 - 11 / 200);
  });
  it("treats a range that allows everything as no preference", () => {
    expect(rangeFit(300, [{}], 200)).toBeUndefined();
    expect(rangeFit(300, [{ max: 249 }, {}], 200)).toBeUndefined();
    expect(rangeFit(300, [], 200)).toBeUndefined();
  });
  it("is neutral for unknown values and skipped without a range", () => {
    expect(rangeFit(undefined, medium, 200)).toBe(0.5);
    expect(rangeFit(300, undefined, 200)).toBeUndefined();
  });
});

describe("scoreBook", () => {
  it("ranks a genre and mood match above a genre-only match above neither", () => {
    const p = prefs({ signals: [fantasy, cozy] });
    const both = scoreBook(book({ subjects: ["Fantasy", "Friendship"] }), p);
    const genre = scoreBook(book({ subjects: ["Fantasy"] }), p);
    const none = scoreBook(book({ subjects: ["Cooking"] }), p);
    expect(both.score).toBeGreaterThan(genre.score);
    expect(genre.score).toBeGreaterThan(none.score);
  });

  it("rewards matching more of the picked genres, with diminishing returns", () => {
    const mystery = { id: "mystery", label: "Mystery", kind: "genre" as const, subjects: ["mystery"] };
    const thriller = { id: "thriller", label: "Thriller", kind: "genre" as const, subjects: ["thriller"] };
    const p = prefs({ signals: [fantasy, mystery, thriller] });
    const score = (subjects: string[]) => scoreBook(book({ subjects }), p).score;
    const one = score(["Fantasy"]);
    const two = score(["Fantasy", "Mystery"]);
    const three = score(["Fantasy", "Mystery", "Thriller"]);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    expect(two - one).toBeGreaterThan(three - two); // each extra match is worth less
  });

  it("explains itself using the user's own labels", () => {
    const s = scoreBook(book({ subjects: ["Fantasy", "Friendship"] }), prefs({ signals: [fantasy, cozy] }));
    expect(s.explanation).toBe("Because you picked Fantasy and Cozy");
    expect(s.matched.map((m) => m.id)).toEqual(["fantasy", "cozy"]);
  });

  it("falls back to an honest explanation when no signal matched", () => {
    const s = scoreBook(book({ subjects: ["Cooking"], rating: 4.6, ratingsCount: 200 }), prefs({ signals: [fantasy] }));
    expect(s.explanation).toBe("Highly rated in your genre");
  });

  it("prefers well-known books for 'popular' and obscure ones for 'hidden'", () => {
    const famous = book({ subjects: ["Fantasy"], rating: 4.2, ratingsCount: 900 });
    const obscure = book({ subjects: ["Fantasy"], rating: 4.2, ratingsCount: 8 });
    const popular = prefs({ signals: [fantasy], popularity: "popular" });
    const hidden = prefs({ signals: [fantasy], popularity: "hidden" });
    expect(scoreBook(famous, popular).score).toBeGreaterThan(scoreBook(obscure, popular).score);
    expect(scoreBook(obscure, hidden).score).toBeGreaterThan(scoreBook(famous, hidden).score);
  });

  it("scores a short and a long book equally well when both lengths were chosen", () => {
    const p = prefs({ pages: [{ max: 249 }, { min: 451 }] });
    const short = scoreBook(book({ pages: 150 }), p).score;
    const long = scoreBook(book({ pages: 800 }), p).score;
    const middle = scoreBook(book({ pages: 350 }), p).score;
    expect(short).toBeCloseTo(long);
    expect(short).toBeGreaterThan(middle);
  });

  it("prefers books near the chosen length and era", () => {
    const p = prefs({ pages: [{ min: 250, max: 450 }], years: [{ min: 2015 }] });
    const fit = scoreBook(book({ pages: 300, firstPublishYear: 2020 }), p);
    const miss = scoreBook(book({ pages: 900, firstPublishYear: 1950 }), p);
    expect(fit.score).toBeGreaterThan(miss.score);
  });

  it("still returns a finite score when the user answered nothing", () => {
    const s = scoreBook(book(), prefs());
    expect(Number.isFinite(s.score)).toBe(true);
  });
});

describe("learning from feedback", () => {
  const dragons = book({ subjects: ["Dragons", "Magic"] });
  const heist = book({ subjects: ["Heists", "Crime"] });

  it("a like raises books that share subjects, and leaves others alone", () => {
    const w = learn({}, dragons, "like");
    const p = prefs();
    expect(scoreBook(book({ subjects: ["Dragons"] }), p, w).score).toBeGreaterThan(
      scoreBook(book({ subjects: ["Dragons"] }), p).score,
    );
    expect(scoreBook(heist, p, w).score).toBeCloseTo(scoreBook(heist, p).score);
  });

  it("a skip lowers similar books, and a save counts more than a like", () => {
    const p = prefs();
    const target = book({ subjects: ["Dragons"] });
    expect(scoreBook(target, p, learn({}, dragons, "skip")).score).toBeLessThan(scoreBook(target, p).score);
    expect(scoreBook(target, p, learn({}, dragons, "save")).score).toBeGreaterThan(
      scoreBook(target, p, learn({}, dragons, "like")).score,
    );
  });

  it("doesn't mutate the previous weights", () => {
    const before = {};
    learn(before, dragons, "like");
    expect(before).toEqual({});
  });

  it("caps how far feedback can move a score", () => {
    let w = {};
    for (let i = 0; i < 100; i++) w = learn(w, dragons, "like");
    const p = prefs();
    const lift = scoreBook(dragons, p, w).score - scoreBook(dragons, p).score;
    expect(lift).toBeCloseTo(0.2);
  });
});

describe("diversify and rankBooks", () => {
  const byAuthor = (author: string, rating: number) => book({ authors: [author], rating, ratingsCount: 100 });

  it("limits books per author but keeps the rest at the end", () => {
    const books = [
      byAuthor("Rowling", 4.9), byAuthor("Rowling", 4.8), byAuthor("Rowling", 4.7),
      byAuthor("Pratchett", 4.0),
    ];
    const ranked = rankBooks(books, prefs(), {}, { perAuthor: 2 });
    expect(ranked.map((r) => r.book.authors[0])).toEqual(["Rowling", "Rowling", "Pratchett", "Rowling"]);
  });

  it("never groups books with no author", () => {
    const anon = [book({ authors: [] }), book({ authors: [] }), book({ authors: [] })];
    const out = diversify(anon.map((b) => scoreBook(b, prefs())), 1);
    expect(out).toHaveLength(3);
  });

  it("respects the limit and returns best first", () => {
    const books = [byAuthor("A", 3.2), byAuthor("B", 4.8), byAuthor("C", 4.0)];
    const ranked = rankBooks(books, prefs(), {}, { limit: 2 });
    expect(ranked.map((r) => r.book.authors[0])).toEqual(["B", "C"]);
  });
});

describe("toPreferences", () => {
  it("turns answers into signals, ranges and popularity", () => {
    const p = toPreferences({
      ...EMPTY_ANSWERS,
      genres: ["fantasy", "mystery"],
      moods: ["cozy"],
      length: ["medium"],
      era: ["new"],
      popularity: ["hidden"],
    });
    expect(p.signals.map((s) => `${s.kind}:${s.id}`)).toEqual(["genre:fantasy", "genre:mystery", "mood:cozy"]);
    expect(p.pages).toEqual([{ min: 250, max: 450 }]);
    expect(p.years).toEqual([{ min: 2015 }]);
    expect(p.popularity).toBe("hidden");
  });

  it("carries several chosen lengths and eras through", () => {
    const p = toPreferences({ ...EMPTY_ANSWERS, genres: ["fantasy"], length: ["quick", "epic"], era: ["classic", "new"] });
    expect(p.pages).toEqual([{ max: 249 }, { min: 451 }]);
    expect(p.years).toEqual([{ max: 1969 }, { min: 2015 }]);
  });

  it("leaves unanswered optional questions open", () => {
    const p = toPreferences({ ...EMPTY_ANSWERS, genres: ["fantasy"] });
    expect(p.pages).toEqual([]);
    expect(p.years).toEqual([]);
    expect(p.popularity).toBe("any");
  });
});

describe("similarity to a loved book", () => {
  const loved = ["fantasy", "dragon", "wizard", "magic"]; // most characteristic first

  it("counts shared words and reports which", () => {
    const { value, shared } = similarity(book({ subjects: ["Dragons", "Magic", "Cooking"] }), loved);
    expect(shared).toEqual(["dragon", "magic"]);
    expect(value).toBeGreaterThan(0);
  });
  it("is 0 for unrelated books and capped at 1", () => {
    expect(similarity(book({ subjects: ["Cooking"] }), loved).value).toBe(0);
    expect(similarity(book({ subjects: ["Fantasy", "Dragons", "Wizards", "Magic"] }), ["fantasy", "dragon", "wizard", "magic", "x"]).value).toBeLessThanOrEqual(1);
  });
  it("counts early (characteristic) words more than late (edition noise) ones", () => {
    const tokens = [...Array.from({ length: 40 }, (_, i) => `filler${i}`), "dragon"];
    const late = similarity(book({ subjects: ["Dragons"] }), tokens).value;
    const early = similarity(book({ subjects: ["Dragons"] }), ["dragon"]).value;
    expect(early).toBeGreaterThan(late);
  });
});

describe("loved book and author in scoring", () => {
  const lovedBook = book({ id: "OL_LOVED", title: "The Hobbit", subjects: ["Fantasy", "Dragons", "Wizards"] });
  const taste = { book: lovedBook };
  const answers = { ...EMPTY_ANSWERS };

  it("never recommends the loved book or another edition of it", () => {
    const edition = book({ id: "OL_OTHER", title: " the hobbit ", subjects: ["Fantasy", "Dragons", "Wizards"] });
    const different = book({ subjects: ["Fantasy", "Dragons", "Wizards"] });
    const ranked = rankBooks([lovedBook, edition, different], toPreferences(answers, taste));
    expect(ranked.map((r) => r.book.id)).toEqual([different.id]);
  });

  it("ranks books sharing more subjects with the loved book higher", () => {
    const close = book({ subjects: ["Fantasy", "Dragons", "Wizards"] });
    const far = book({ subjects: ["Fantasy", "Cooking"] });
    const ranked = rankBooks([far, close], toPreferences(answers, taste));
    expect(ranked[0].book.id).toBe(close.id);
    expect(ranked[0].explanation).toBe("Like The Hobbit: shares fantasy, dragon and wizard");
  });

  it("doesn't claim similarity it can't back up", () => {
    const weak = book({ subjects: ["Fantasy"] });
    expect(scoreBook(weak, toPreferences(answers, taste)).explanation).not.toMatch(/^Like The Hobbit/);
  });

  it("boosts the loved author's books and says so", () => {
    const prefs = toPreferences(answers, { author: { id: "OL7A", name: "Ursula Le Guin" } });
    const hers = book({ authorKeys: ["OL7A"] });
    const other = book({ authorKeys: ["OL8A"] });
    expect(scoreBook(hers, prefs).score).toBeGreaterThan(scoreBook(other, prefs).score);
    expect(scoreBook(hers, prefs).explanation).toBe("More by Ursula Le Guin, an author you love");
  });

  it("lets the loved author fill more slots than other authors", () => {
    const prefs = toPreferences(answers, { author: { id: "OL7A", name: "Le Guin" } });
    const hers = Array.from({ length: 6 }, () => book({ authors: ["Le Guin"], authorKeys: ["OL7A"], ratingsCount: 100, rating: 4.5 }));
    const others = Array.from({ length: 6 }, () => book({ authors: ["Same"], authorKeys: ["OL8A"], ratingsCount: 100, rating: 4.4 }));
    const top = rankBooks([...hers, ...others], prefs, {}, { limit: 8 });
    const first8 = top.map((t) => t.book.authorKeys[0]);
    // 4 by the loved author and 2 by anyone else's capped author come first; the rest is overflow.
    expect(first8.slice(0, 6).filter((k) => k === "OL7A")).toHaveLength(4);
    expect(first8.slice(0, 6).filter((k) => k === "OL8A")).toHaveLength(2);
  });

  it("builds an author profile from the candidates when there's no loved book", () => {
    const hers = [
      book({ authorKeys: ["OL7A"], ratingsCount: 90, subjects: ["Epic", "Magic"] }),
      book({ authorKeys: ["OL7A"], ratingsCount: 80, subjects: ["Epic", "Magic"] }),
    ];
    const prefs = toPreferences(answers, { author: { id: "OL7A", name: "Le Guin" } }, hers);
    expect(prefs.similarTo?.title).toBe("Le Guin's books");
    expect(prefs.similarTo?.tokens).toEqual(["epic", "magic"]);
    const peer = book({ authorKeys: ["OL9A"], subjects: ["Epic", "Magic"] });
    expect(scoreBook(peer, prefs).explanation).toBe("Like Le Guin's books: shares epic and magic");
  });

  it("has no similarity target when there's no loved book and no usable author profile", () => {
    expect(toPreferences(answers, { author: { id: "OL7A", name: "X" } }, []).similarTo).toBeUndefined();
  });
});
