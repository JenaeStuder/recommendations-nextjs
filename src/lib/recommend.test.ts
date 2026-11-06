import { describe, expect, it, vi } from "vitest";
import type { Book, SearchFilters } from "@/lib/open-library";
import { EMPTY_ANSWERS, QUESTIONS, STEPS, audiencesOf, erasOf, getQuestion, pagesOf, type Answers } from "@/lib/questions";
import { MIN_CANDIDATES, candidatePlan, fetchCandidates } from "./recommend";

const answers = (over: Partial<Answers> = {}): Answers => ({ ...EMPTY_ANSWERS, genres: ["fantasy"], ...over });

const makeBooks = (count: number, prefix = "A"): Book[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`, title: `T${i}`, authors: [], authorKeys: [], subjects: [],
  }));

describe("candidatePlan", () => {
  it("steps the ratings floor down for crowd favourites", () => {
    const floors = candidatePlan(answers({ popularity: ["popular"] })).map((s) => s[0].ratings?.min);
    expect(floors).toEqual([20, 10, 3]);
  });

  it("keeps a ceiling for hidden gems at every step", () => {
    const plan = candidatePlan(answers({ popularity: ["hidden"] }));
    expect(plan.every((step) => step.every((f) => f.ratings?.max === 19))).toBe(true);
  });

  it("runs one query without moods, and two (narrow + genres-only) with them", () => {
    expect(candidatePlan(answers())[0]).toHaveLength(1);
    const withMoods = candidatePlan(answers({ moods: ["cozy"] }))[0];
    expect(withMoods).toHaveLength(2);
    expect(withMoods[0].subjectGroups).toHaveLength(2); // genres AND moods
    expect(withMoods[1].subjectGroups).toHaveLength(1); // genres only
  });

  it("applies length and era ranges to every query", () => {
    const plan = candidatePlan(answers({ length: ["medium"], era: ["new"], moods: ["cozy"] }));
    for (const f of plan.flat()) {
      expect(f.pages).toEqual([{ min: 250, max: 450 }]);
      expect(f.years).toEqual([{ min: 2015 }]);
    }
  });
});

describe("fetchCandidates", () => {
  it("loosens the ratings floor until it has enough candidates", async () => {
    const search = vi.fn(async (f: SearchFilters) => {
      const min = f.ratings?.min;
      const books = min === 3 ? makeBooks(40) : [];
      return { books, total: books.length };
    });
    const result = await fetchCandidates(answers({ popularity: ["popular"] }), {}, undefined, search);
    expect(result).toHaveLength(40);
    expect(search.mock.calls.map(([f]) => f.ratings?.min)).toEqual([20, 10, 3]);
  });

  it("stops as soon as the first step is enough", async () => {
    const search = vi.fn(async () => ({ books: makeBooks(MIN_CANDIDATES), total: 999 }));
    await fetchCandidates(answers({ popularity: ["popular"] }), {}, undefined, search);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("deduplicates books returned by both the narrow and genres-only queries", async () => {
    const search = async () => ({ books: makeBooks(5), total: 5 });
    const result = await fetchCandidates(answers({ moods: ["cozy"] }), {}, undefined, search);
    expect(new Set(result.map((b) => b.id)).size).toBe(result.length);
    expect(result).toHaveLength(5);
  });

  it("returns an empty list (not an error) when nothing matches anywhere", async () => {
    const search = async () => ({ books: [], total: 0 });
    expect(await fetchCandidates(answers(), {}, undefined, search)).toEqual([]);
  });

  it("passes the abort signal through", async () => {
    const search = vi.fn(async (...args: [SearchFilters, AbortSignal?]) => {
      void args;
      return { books: [], total: 0 };
    });
    const ctrl = new AbortController();
    await fetchCandidates(answers(), {}, ctrl.signal, search);
    expect(search.mock.calls[0][1]).toBe(ctrl.signal);
  });
});

describe("candidatePlan with a loved book or author", () => {
  const lovedBook: Book = {
    id: "OL1W", title: "The Hobbit", authors: ["T"], authorKeys: ["OL26320A"],
    subjects: ["Fantasy", "Fiction", "Dragons", "Dwarves"],
  };
  const noGenres = answers({ genres: [] });

  it("adds a relevance-ordered 'books like' query from the loved book's distinctive subjects", () => {
    const [step] = candidatePlan(noGenres, { book: lovedBook });
    expect(step).toHaveLength(1);
    expect(step[0].sort).toBeUndefined(); // relevance, so more shared subjects rank first
    expect(step[0].subjectGroups).toEqual([["fantasy", "dragons", "dwarves"]]); // boilerplate dropped
  });

  it("runs the similar query at every ratings step, but the author query only once", () => {
    const plan = candidatePlan(noGenres, { book: lovedBook, author: { id: "OL1A", name: "X" } });
    expect(plan.length).toBeGreaterThan(1);
    expect(plan.every((step) => step.some((f) => f.subjectGroups))).toBe(true);
    expect(plan.flat().filter((f) => f.authorKey === "OL1A")).toHaveLength(1);
    expect(plan[0].some((f) => f.authorKey === "OL1A")).toBe(true);
  });

  it("doesn't filter the loved author's books by length, era or ratings", () => {
    const plan = candidatePlan(answers({ length: ["quick"], era: ["classic"] }), { author: { id: "OL1A", name: "X" } });
    const authorQuery = plan.flat().find((f) => f.authorKey)!;
    expect(authorQuery.pages).toBeUndefined();
    expect(authorQuery.years).toBeUndefined();
    expect(authorQuery.ratings).toBeUndefined();
  });

  it("is empty when there are no genres and no taste", () => {
    expect(candidatePlan(noGenres)).toEqual([]);
  });
});

describe("fetchCandidates with a loved author only", () => {
  const authorBooks: Book[] = [1, 2, 3].map((i) => ({
    id: `OLA${i}W`, title: `Hers ${i}`, authors: ["Le Guin"], authorKeys: ["OL7A"],
    ratingsCount: 100 - i, subjects: ["Epic", "Magic", `Unique ${i}`],
  }));

  it("fetches their books first, then searches for books like them", async () => {
    const calls: SearchFilters[] = [];
    const search = async (f: SearchFilters) => {
      calls.push(f);
      if (f.authorKey) return { books: authorBooks, total: 3 };
      return { books: makeBooks(40, "P"), total: 40 };
    };
    const result = await fetchCandidates(answers({ genres: [] }), { author: { id: "OL7A", name: "Le Guin" } }, undefined, search);
    expect(calls[0].authorKey).toBe("OL7A");
    expect(calls.filter((f) => f.authorKey)).toHaveLength(1); // not fetched twice
    expect(calls[1].subjectGroups).toEqual([["epic", "magic"]]); // profile of their books
    expect(result.some((b) => b.id === "OLA1W")).toBe(true);
    expect(result).toHaveLength(43);
  });

  it("still returns their books when no profile can be found", async () => {
    const loners: Book[] = [{ ...authorBooks[0], subjects: ["Solo"] }];
    const search = async (f: SearchFilters) => ({ books: f.authorKey ? loners : [], total: 0 });
    const result = await fetchCandidates(answers({ genres: [] }), { author: { id: "OL7A", name: "X" } }, undefined, search);
    expect(result).toHaveLength(1);
  });
});

describe("audience in the candidate plan", () => {
  const lovedBook: Book = {
    id: "OL1W", title: "T", authors: ["T"], authorKeys: ["OL1A"], subjects: ["Fantasy", "Dragons"],
  };

  it("applies the audience filter to every query, including the loved author's", () => {
    const plan = candidatePlan(
      answers({ moods: ["cozy"], audience: ["adult"] }),
      { book: lovedBook, author: { id: "OL1A", name: "X" } },
    );
    const all = plan.flat();
    expect(all.length).toBeGreaterThan(3);
    for (const f of all) expect(f.audiences).toEqual(["adult"]);
    expect(all.some((f) => f.authorKey)).toBe(true);
  });

  it("applies it to the author's first fetch when there's no loved book", async () => {
    const seen: SearchFilters[] = [];
    const search = async (f: SearchFilters) => { seen.push(f); return { books: [], total: 0 }; };
    await fetchCandidates(answers({ genres: [], audience: ["children"] }), { author: { id: "OL1A", name: "X" } }, undefined, search);
    expect(seen[0].authorKey).toBe("OL1A");
    expect(seen[0].audiences).toEqual(["children"]);
  });

  it("leaves audiences empty when the question was skipped", () => {
    for (const f of candidatePlan(answers()).flat()) expect(f.audiences).toEqual([]);
  });
});

describe("questions and steps", () => {
  it("never shows two chips with the same label on one screen (e.g. mood 'Epic' vs length 'Epic')", () => {
    for (const step of STEPS) {
      const labels = step.questions.flatMap((id) => getQuestion(id).options.map((o) => o.label.toLowerCase()));
      expect(labels.filter((l, i) => labels.indexOf(l) !== i)).toEqual([]);
    }
  });

  it("puts every question in exactly one step, so none can silently vanish from the flow", () => {
    const placed = STEPS.flatMap((s) => s.questions);
    expect([...placed].sort()).toEqual(QUESTIONS.map((q) => q.id).sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("shows audience on the same screen as genres, below them", () => {
    expect(STEPS[0].questions).toEqual(["genres", "audience"]);
  });

  it("keeps the whole flow to three screens, counting the book-or-author screen", () => {
    expect(STEPS.length + 1).toBeLessThanOrEqual(3);
  });

  it("only requires genres, so the last screen can be skipped straight to results", () => {
    const required = QUESTIONS.filter((q) => q.required).map((q) => q.id);
    expect(required).toEqual(["genres"]);
    expect(STEPS[STEPS.length - 1].questions).not.toContain("genres");
  });

  it("gives a screen with several unrelated questions its own heading", () => {
    for (const step of STEPS) {
      if (step.questions.length > 2) expect(step.heading).toBeDefined();
    }
  });

  it("only accepts known audience ids", () => {
    expect(audiencesOf({ ...EMPTY_ANSWERS, audience: ["teen", "bogus", "adult"] })).toEqual(["teen", "adult"]);
  });
});

describe("choosing more than one length or era", () => {
  it("lets length and era take several answers, but popularity only one", () => {
    expect(getQuestion("length").kind).toBe("multi");
    expect(getQuestion("era").kind).toBe("multi");
    expect(getQuestion("popularity").kind).toBe("single");
    expect(getQuestion("length").max).toBeUndefined(); // no cap: all three is allowed
  });

  it("merges neighbouring choices into one range", () => {
    expect(pagesOf(answers({ length: ["quick", "medium"] }))).toEqual([{ max: 450 }]);
    expect(erasOf(answers({ era: ["modern", "new"] }))).toEqual([{ min: 1970 }]);
  });

  it("keeps choices that don't touch as separate ranges", () => {
    expect(pagesOf(answers({ length: ["epic", "quick"] }))).toEqual([{ max: 249 }, { min: 451 }]);
    expect(erasOf(answers({ era: ["classic", "new"] }))).toEqual([{ max: 1969 }, { min: 2015 }]);
  });

  it("treats all three as 'no preference'", () => {
    const all = pagesOf(answers({ length: ["quick", "medium", "epic"] }));
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({}); // unbounded
    expect(pagesOf(answers())).toEqual([]);
  });

  it("ignores unknown ids", () => {
    expect(pagesOf(answers({ length: ["bogus"] }))).toEqual([]);
  });

  it("sends the union to every search", () => {
    const plan = candidatePlan(answers({ length: ["quick", "epic"], moods: ["cozy"] }));
    for (const f of plan.flat()) expect(f.pages).toEqual([{ max: 249 }, { min: 451 }]);
  });
});
