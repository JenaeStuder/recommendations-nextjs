import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkDescription } from "./client";
import { cleanDescription, descriptionText, parseDescription, shortDescription } from "./description";
import { OpenLibraryError } from "./errors";

describe("descriptionText", () => {
  it("accepts a plain string or the { type, value } object Open Library also returns", () => {
    expect(descriptionText("Plain")).toBe("Plain");
    expect(descriptionText({ type: "/type/text", value: "Wrapped" })).toBe("Wrapped");
  });
  it("treats anything else as no description", () => {
    for (const v of [undefined, null, 42, {}, { value: 7 }, []]) expect(descriptionText(v)).toBe("");
  });
});

describe("cleanDescription", () => {
  it("turns Windows line breaks into paragraphs", () => {
    expect(cleanDescription("First.\r\n\r\nSecond.")).toBe("First.\n\nSecond.");
  });

  it("joins single line breaks inside a paragraph", () => {
    expect(cleanDescription("one\ntwo\r\nthree")).toBe("one two three");
  });

  it("keeps only the text of markdown links, inline and reference-style", () => {
    expect(cleanDescription("See [Crooked Kingdom](https://openlibrary.org/works/OL1W) next.")).toBe(
      "See Crooked Kingdom next.",
    );
    expect(cleanDescription("Followed by [Crooked Kingdom][2] and [more][].")).toBe(
      "Followed by Crooked Kingdom and more.",
    );
  });

  it("drops reference link definitions", () => {
    expect(cleanDescription("Text.\n\n  [2]: https://openlibrary.org/works/OL1W/Foo")).toBe("Text.");
  });

  it("cuts everything from a separator line or a Source / Also contained in footer", () => {
    expect(cleanDescription("Story.\n\n----------\nSource: publisher")).toBe("Story.");
    expect(cleanDescription("Story.\nSource: Wikipedia\nmore junk")).toBe("Story.");
    expect(cleanDescription("Story.\n\nAlso contained in: Omnibus (1999)")).toBe("Story.");
  });

  it("doesn't cut at the word 'source' in ordinary prose", () => {
    expect(cleanDescription("The source of the river is a mystery.")).toBe("The source of the river is a mystery.");
  });

  it("strips HTML but keeps the line structure", () => {
    expect(cleanDescription("One<br>two<br/>three")).toBe("one two three".replace("one", "One"));
    expect(cleanDescription("<p>Alpha</p><p>Beta</p>")).toBe("Alpha\n\nBeta");
    expect(cleanDescription("A <b>bold</b> <i>move</i>")).toBe("A bold move");
  });

  it("decodes the common HTML entities", () => {
    expect(cleanDescription("Tom &amp; Jerry said &quot;hi&quot; &#39;twice&#39;")).toBe(
      `Tom & Jerry said "hi" 'twice'`,
    );
  });

  it("removes emphasis markers but keeps the words", () => {
    expect(cleanDescription("**Bold**, __also bold__, *italic* and _this too_.")).toBe(
      "Bold, also bold, italic and this too.",
    );
  });

  it("leaves snake_case and multiplication alone", () => {
    expect(cleanDescription("Uses snake_case_names and 3 * 4 = 12.")).toBe("Uses snake_case_names and 3 * 4 = 12.");
  });

  it("removes bare URLs and the empty brackets they leave", () => {
    expect(cleanDescription("Visit https://example.com/x for more (https://example.com/y).")).toBe(
      "Visit for more.",
    );
  });

  it("keeps the full stop that ended a sentence with a URL in it", () => {
    expect(cleanDescription("Read it at https://example.com/a. Then relax.")).toBe("Read it at. Then relax.");
  });

  it("returns an empty string when there's nothing readable", () => {
    expect(cleanDescription(undefined)).toBe("");
    expect(cleanDescription("   \r\n  ")).toBe("");
    expect(cleanDescription("----------\nSource: x")).toBe("");
    expect(cleanDescription("[2]: https://x.test")).toBe("");
  });

  it("cleans a real description (Six of Crows) that had links and a link-definition footer", () => {
    const raw =
      "Criminal prodigy Kaz Brekker is offered a chance at a deadly heist.\r\n\r\n" +
      "The novel is followed by [Crooked Kingdom](https://openlibrary.org/works/OL17597665W) (2016) and is part of the Grishaverse. \r\n\r\n" +
      "Followed by: [Crooked Kingdom][2]\r\n\r\n\r\n  [2]: https://openlibrary.org/works/OL17597665W/Crooked_Kingdom";
    expect(cleanDescription(raw)).toBe(
      "Criminal prodigy Kaz Brekker is offered a chance at a deadly heist.\n\n" +
        "The novel is followed by Crooked Kingdom (2016) and is part of the Grishaverse.\n\n" +
        "Followed by: Crooked Kingdom",
    );
  });
});

describe("shortDescription", () => {
  const sentence = (n: number) => `Sentence number ${n} is here.`;
  const long = Array.from({ length: 30 }, (_, i) => sentence(i)).join(" ");

  it("returns short text unchanged (on one line)", () => {
    expect(shortDescription("A short one.\n\nTwo paragraphs.")).toBe("A short one. Two paragraphs.");
  });

  it("cuts at the end of the last whole sentence that fits", () => {
    const out = shortDescription(long, 200);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith("is here.")).toBe(true);
    expect(long.startsWith(out)).toBe(true);
  });

  it("falls back to a word boundary with an ellipsis when no sentence ends late enough", () => {
    const noStops = "word ".repeat(200).trim();
    const out = shortDescription(noStops, 50);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.slice(0, -1).endsWith("word")).toBe(true); // not cut mid-word
  });

  it("ignores a sentence end that would leave almost nothing", () => {
    const text = "Hi. " + "and so on without stopping ".repeat(30);
    const out = shortDescription(text, 100);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeGreaterThan(60);
  });

  it("handles one very long word", () => {
    const out = shortDescription("x".repeat(500), 40);
    expect(out.length).toBeLessThanOrEqual(41);
  });

  it("keeps closing quotes with the sentence", () => {
    const text = `He said "go." ` + "Then they all went on and on for a good while. ".repeat(10);
    expect(shortDescription(text, 14 + 46).endsWith("while.")).toBe(true);
  });
});

describe("parseDescription", () => {
  it("gives empty strings, not undefined, when a book has no description", () => {
    expect(parseDescription(undefined)).toEqual({ full: "", short: "" });
  });
  it("gives the full cleaned text and a shorter version", () => {
    const raw = Array.from({ length: 40 }, (_, i) => `Sentence ${i} is here.`).join(" ");
    const { full, short } = parseDescription(raw);
    expect(full.length).toBeGreaterThan(short.length);
    expect(short.length).toBeLessThanOrEqual(380);
  });
});

describe("getWorkDescription", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("reads a string description", async () => {
    vi.stubGlobal("fetch", respond(200, { description: "A tale." }));
    expect((await getWorkDescription("OL1W")).short).toBe("A tale.");
  });

  it("reads the { type, value } shape", async () => {
    vi.stubGlobal("fetch", respond(200, { description: { type: "/type/text", value: "Wrapped.\r\n\r\nMore." } }));
    expect((await getWorkDescription("OL1W")).full).toBe("Wrapped.\n\nMore.");
  });

  it("returns empty strings when the work has no description", async () => {
    vi.stubGlobal("fetch", respond(200, { title: "No blurb" }));
    expect(await getWorkDescription("OL1W")).toEqual({ full: "", short: "" });
  });

  it("treats a missing work (404) as no description, not an error", async () => {
    vi.stubGlobal("fetch", respond(404, {}));
    expect(await getWorkDescription("OL1W")).toEqual({ full: "", short: "" });
  });

  it("still throws for server errors and rate limits so the UI can offer a retry", async () => {
    vi.stubGlobal("fetch", respond(500, {}));
    await expect(getWorkDescription("OL1W")).rejects.toBeInstanceOf(OpenLibraryError);
    vi.stubGlobal("fetch", respond(429, {}));
    await expect(getWorkDescription("OL1W")).rejects.toMatchObject({ kind: "rate-limit" });
  });

  it("throws on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(getWorkDescription("OL1W")).rejects.toMatchObject({ kind: "network" });
  });

  it("never builds a URL from an unexpected id", async () => {
    const fetchSpy = respond(200, { description: "x" });
    vi.stubGlobal("fetch", fetchSpy);
    for (const bad of ["", "../../etc", "OL1W/../x", "OL1A", "ol1w", "OL1W?x=1"]) {
      expect(await getWorkDescription(bad)).toEqual({ full: "", short: "" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks for the right URL", async () => {
    const fetchSpy = respond(200, {});
    vi.stubGlobal("fetch", fetchSpy);
    await getWorkDescription("OL27482W");
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe("https://openlibrary.org/works/OL27482W.json");
  });
});
