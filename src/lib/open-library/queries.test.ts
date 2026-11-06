import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_ANSWERS, type Answers } from "@/lib/questions";
import { fetchCandidates } from "@/lib/recommend";
import { GC_TIME, STALE_TIME, cachedSearch } from "./queries";
import type { Book, SearchFilters, SearchResult } from "./types";

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const book = (id: string, over: Partial<Book> = {}): Book => ({
  id, title: id, authors: [], authorKeys: [], subjects: [], ...over,
});

/** A fake API whose answer depends on the request, so reusing the wrong entry would be visible. */
function fakeApi() {
  const calls: SearchFilters[] = [];
  const search = vi.fn(async (f: SearchFilters): Promise<SearchResult> => {
    calls.push(f);
    const tag = JSON.stringify(f);
    return { books: [book(`for:${tag}`)], total: 1 };
  });
  return { search, calls };
}

afterEach(() => vi.useRealTimers());

describe("cachedSearch", () => {
  it("answers an identical request from memory", async () => {
    const { search } = fakeApi();
    const get = cachedSearch(newClient(), search);
    const a = await get({ subjectGroups: [["fantasy"]], ratings: { min: 3 } });
    const b = await get({ subjectGroups: [["fantasy"]], ratings: { min: 3 } });
    expect(search).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it("treats the same request as the same however it was written", async () => {
    const { search } = fakeApi();
    const get = cachedSearch(newClient(), search);
    await get({ subjectGroups: [["fantasy"]], ratings: { min: 3 }, sort: "rating" });
    await get({ sort: "rating", ratings: { min: 3 }, subjectGroups: [["fantasy"]] }); // different key order
    await get({ subjectGroups: [["fantasy"]], ratings: { min: 3 }, sort: "rating", authorKey: undefined });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a different audience", { audiences: ["adult" as const] }],
    ["a different length", { pages: [{ max: 249 }] }],
    ["a different era", { years: [{ min: 2015 }] }],
    ["a different ratings floor", { ratings: { min: 20 } }],
    ["a loved author", { authorKey: "OL1394865A" }],
    ["a different page of results", { page: 2 }],
    ["a different sort", { sort: "new" as const }],
  ])("never reuses an answer for %s", async (_name, change) => {
    const { search } = fakeApi();
    const get = cachedSearch(newClient(), search);
    const base: SearchFilters = { subjectGroups: [["fantasy"]], ratings: { min: 3 } };
    const first = await get(base);
    const second = await get({ ...base, ...change });
    expect(search).toHaveBeenCalledTimes(2);
    expect(second.books[0].id).not.toBe(first.books[0].id); // genuinely different data came back
  });

  it("doesn't remember a failure as an answer", async () => {
    const search = vi
      .fn<(f: SearchFilters) => Promise<SearchResult>>()
      .mockRejectedValueOnce(new Error("Open Library hiccup"))
      .mockResolvedValueOnce({ books: [book("ok")], total: 1 });
    const get = cachedSearch(newClient(), search);
    await expect(get({ text: "x" })).rejects.toThrow("hiccup");
    expect((await get({ text: "x" })).books[0].id).toBe("ok");
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("refetches once an answer is older than the freshness window", async () => {
    vi.useFakeTimers();
    const { search } = fakeApi();
    const get = cachedSearch(newClient(), search);
    await get({ text: "x" });
    vi.advanceTimersByTime(STALE_TIME - 1000);
    await get({ text: "x" });
    expect(search).toHaveBeenCalledTimes(1); // still fresh
    vi.advanceTimersByTime(2000);
    await get({ text: "x" });
    expect(search).toHaveBeenCalledTimes(2); // now stale
  });

  it("keeps unused answers longer than the default 5 minutes (so a new search can reuse them)", () => {
    expect(GC_TIME).toBeGreaterThan(5 * 60 * 1000);
    expect(GC_TIME).toBeGreaterThanOrEqual(STALE_TIME);
  });

  it("is a separate cache per QueryClient, so nothing leaks between sessions", async () => {
    const { search } = fakeApi();
    await cachedSearch(newClient(), search)({ text: "x" });
    await cachedSearch(newClient(), search)({ text: "x" });
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe("two different searches sharing the cache", () => {
  const answers = (over: Partial<Answers> = {}): Answers => ({ ...EMPTY_ANSWERS, genres: ["fantasy"], ...over });
  const lovedAuthor = { id: "OL1394865A", name: "Brandon Sanderson" };

  /** An API that knows which request is the author's and which is the genre's. */
  function themedApi() {
    const calls: SearchFilters[] = [];
    const search = async (f: SearchFilters): Promise<SearchResult> => {
      calls.push(f);
      if (f.authorKey) return { books: [book("sanderson-1", { authorKeys: [f.authorKey] })], total: 1 };
      return { books: [book("generic-fantasy")], total: 1 };
    };
    return { calls, search };
  }

  it("reuses the shared genre request but fetches the loved author fresh", async () => {
    const { calls, search } = themedApi();
    const client = newClient();
    const get = cachedSearch(client, search);

    const plain = await fetchCandidates(answers(), {}, undefined, get);
    const genreRequests = calls.length;
    const withAuthor = await fetchCandidates(answers(), { author: lovedAuthor }, undefined, get);

    // The plain-fantasy request was reused; only the author's books were new.
    const newRequests = calls.slice(genreRequests);
    expect(newRequests.some((f) => f.authorKey === lovedAuthor.id)).toBe(true);
    expect(newRequests.some((f) => !f.authorKey && f.subjectGroups?.[0]?.includes("fantasy"))).toBe(false);

    // No false data: the author's book appears only when the author was asked for.
    expect(plain.map((b) => b.id)).toEqual(["generic-fantasy"]);
    expect(withAuthor.map((b) => b.id).sort()).toEqual(["generic-fantasy", "sanderson-1"]);
  });

  it("gives a plain search the same books whether or not an author search happened in between", async () => {
    const { search } = themedApi();
    const get = cachedSearch(newClient(), search);
    const before = await fetchCandidates(answers(), {}, undefined, get);
    await fetchCandidates(answers(), { author: lovedAuthor }, undefined, get);
    const after = await fetchCandidates(answers(), {}, undefined, get);
    expect(after.map((b) => b.id)).toEqual(before.map((b) => b.id)); // the author's book didn't leak in
    expect(after.map((b) => b.id)).not.toContain("sanderson-1");
  });

  it("keeps different audiences apart", async () => {
    const calls: SearchFilters[] = [];
    const search = async (f: SearchFilters): Promise<SearchResult> => {
      calls.push(f);
      return { books: [book(f.audiences?.[0] ?? "everyone")], total: 1 };
    };
    const get = cachedSearch(newClient(), search);
    const adult = await fetchCandidates(answers({ audience: ["adult"] }), {}, undefined, get);
    const kids = await fetchCandidates(answers({ audience: ["children"] }), {}, undefined, get);
    const requestsSoFar = calls.length;
    const adultAgain = await fetchCandidates(answers({ audience: ["adult"] }), {}, undefined, get);
    expect(adult.map((b) => b.id)).toEqual(["adult"]);
    expect(kids.map((b) => b.id)).toEqual(["children"]);
    expect(adultAgain.map((b) => b.id)).toEqual(["adult"]);
    expect(calls.filter((f) => f.audiences?.[0] === "adult").length).toBe(calls.length - calls.filter((f) => f.audiences?.[0] === "children").length);
    expect(calls).toHaveLength(requestsSoFar); // repeating the adult search cost nothing
  });
});
