import { describe, expect, it } from "vitest";
import type { Book } from "@/lib/open-library";
import { MAX_SHARED, buildShareUrl, orderByIds, parseShelf } from "./share";

const q = (s: string) => new URLSearchParams(s);
const book = (n: number): Book => ({ id: `OL${n}W`, title: `T${n}`, authors: [], authorKeys: [], subjects: [] });

describe("parseShelf", () => {
  it("returns undefined when the link has no shelf at all", () => {
    expect(parseShelf(q(""))).toBeUndefined();
    expect(parseShelf(q("list=liked"))).toBeUndefined();
  });

  it("reads ids in order, with the list name", () => {
    expect(parseShelf(q("shelf=OL1W,OL22W,OL3W&list=to-read"))).toEqual({ ids: ["OL1W", "OL22W", "OL3W"], list: "to-read", ignored: 0 });
  });

  it("ignores malformed ids and counts them", () => {
    const r = parseShelf(q("shelf=OL1W,../evil,OL2A,<script>,OL3W,"));
    expect(r?.ids).toEqual(["OL1W", "OL3W"]);
    expect(r?.ignored).toBe(3);
  });

  it("drops duplicates", () => {
    const r = parseShelf(q("shelf=OL1W,OL1W,OL2W"));
    expect(r?.ids).toEqual(["OL1W", "OL2W"]);
    expect(r?.ignored).toBe(1);
  });

  it("caps the number of books", () => {
    const many = Array.from({ length: MAX_SHARED + 10 }, (_, i) => `OL${i + 1}W`).join(",");
    const r = parseShelf(q(`shelf=${many}`));
    expect(r?.ids).toHaveLength(MAX_SHARED);
    expect(r?.ignored).toBe(10);
  });

  it("accepts only the known list names (free text in a link must never reach the page)", () => {
    expect(parseShelf(q("shelf=OL1W&list=liked"))?.list).toBe("liked");
    expect(parseShelf(q("shelf=OL1W&list=<b>hi</b>"))?.list).toBeUndefined();
    expect(parseShelf(q("shelf=OL1W&list=TO-READ"))?.list).toBeUndefined();
  });

  it("an empty or all-invalid shelf is still a shelf link, just with no books", () => {
    expect(parseShelf(q("shelf="))).toEqual({ ids: [], list: undefined, ignored: 0 });
    expect(parseShelf(q("shelf=nope"))?.ids).toEqual([]);
  });
});

describe("buildShareUrl", () => {
  it("makes a readable link", () => {
    expect(buildShareUrl("https://x.dev/", ["OL1W", "OL2W"], "to-read")).toBe("https://x.dev/?shelf=OL1W,OL2W&list=to-read");
  });

  it("round-trips through parseShelf", () => {
    const url = new URL(buildShareUrl("https://x.dev/", ["OL5W", "OL9W"], "liked"));
    expect(parseShelf(url.searchParams)).toEqual({ ids: ["OL5W", "OL9W"], list: "liked", ignored: 0 });
  });

  it("never writes a bad id or more than the cap into a link", () => {
    const ids = ["OL1W", "bad id", ...Array.from({ length: 80 }, (_, i) => `OL${i + 10}W`)];
    const url = new URL(buildShareUrl("https://x.dev/", ids, "to-read"));
    expect(url.searchParams.get("shelf")?.split(",")).toHaveLength(MAX_SHARED);
    expect(url.searchParams.get("shelf")).not.toContain("bad");
  });
});

describe("orderByIds", () => {
  it("restores the order of the link and reports missing books", () => {
    const { ordered, missing } = orderByIds([book(3), book(1)], ["OL1W", "OL2W", "OL3W"]);
    expect(ordered.map((b) => b.id)).toEqual(["OL1W", "OL3W"]);
    expect(missing).toEqual(["OL2W"]);
  });
});
