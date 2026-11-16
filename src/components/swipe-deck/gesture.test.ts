import { describe, expect, it } from "vitest";
import { reactionFor } from "./gesture";

const still = { x: 0, y: 0 };

describe("reactionFor", () => {
  it("a long drag right likes, left skips, up saves", () => {
    expect(reactionFor({ x: 150, y: 10 }, still)).toBe("like");
    expect(reactionFor({ x: -150, y: -10 }, still)).toBe("skip");
    expect(reactionFor({ x: 10, y: -150 }, still)).toBe("save");
  });

  it("a short, slow drag springs back", () => {
    expect(reactionFor({ x: 60, y: 0 }, { x: 100, y: 0 })).toBeUndefined();
    expect(reactionFor({ x: 0, y: -60 }, still)).toBeUndefined();
  });

  it("a quick flick counts even over a short distance", () => {
    expect(reactionFor({ x: 40, y: 0 }, { x: 900, y: 0 })).toBe("like");
    expect(reactionFor({ x: -40, y: 0 }, { x: -900, y: 0 })).toBe("skip");
    expect(reactionFor({ x: 0, y: -40 }, { x: 0, y: -900 })).toBe("save");
  });

  it("a tiny twitch with a fast velocity is not a decision (a click, not a throw)", () => {
    expect(reactionFor({ x: 3, y: 0 }, { x: 900, y: 0 })).toBeUndefined();
  });

  it("dragging DOWN never does anything", () => {
    expect(reactionFor({ x: 0, y: 200 }, { x: 0, y: 900 })).toBeUndefined();
  });

  it("the dominant direction wins on a diagonal", () => {
    expect(reactionFor({ x: 130, y: -120 }, still)).toBe("like");
    expect(reactionFor({ x: 120, y: -130 }, still)).toBe("save");
  });
});
