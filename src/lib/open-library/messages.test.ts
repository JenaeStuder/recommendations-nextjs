import { describe, expect, it } from "vitest";
import { coverUrl } from "./cover";
import { OpenLibraryError } from "./errors";
import { errorMessage } from "./messages";

describe("errorMessage", () => {
  it("tells people to wait when Open Library is rate limiting", () => {
    expect(errorMessage(new OpenLibraryError("rate-limit", "429", 429))).toMatch(/give it a minute/i);
  });

  it("points at the connection when the request never arrived", () => {
    expect(errorMessage(new OpenLibraryError("network", "offline"))).toMatch(/check your connection/i);
  });

  it("falls back to a plain message for other API failures and unknown errors", () => {
    const generic = "Something went wrong while fetching books.";
    expect(errorMessage(new OpenLibraryError("http", "500", 500))).toBe(generic);
    expect(errorMessage(new OpenLibraryError("parse", "bad json"))).toBe(generic);
    expect(errorMessage(new Error("boom"))).toBe(generic);
    expect(errorMessage("a string")).toBe(generic);
    expect(errorMessage(undefined)).toBe(generic);
  });

  it("never leaks the raw error text to the page", () => {
    expect(errorMessage(new OpenLibraryError("http", "secret internal detail", 500))).not.toMatch(/secret/);
  });
});

describe("OpenLibraryError", () => {
  it("carries its kind and status, and is a real Error", () => {
    const e = new OpenLibraryError("rate-limit", "slow down", 429);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("OpenLibraryError");
    expect(e.kind).toBe("rate-limit");
    expect(e.status).toBe(429);
    expect(e.message).toBe("slow down");
  });
});

describe("coverUrl", () => {
  it("builds the Open Library cover address for each size, medium by default", () => {
    expect(coverUrl(12345)).toBe("https://covers.openlibrary.org/b/id/12345-M.jpg");
    expect(coverUrl(12345, "S")).toBe("https://covers.openlibrary.org/b/id/12345-S.jpg");
    expect(coverUrl(12345, "L")).toBe("https://covers.openlibrary.org/b/id/12345-L.jpg");
  });

  it("returns nothing when there is no cover, so the designed fallback is shown", () => {
    expect(coverUrl(undefined)).toBeUndefined();
    expect(coverUrl(0)).toBeUndefined();
  });
});
