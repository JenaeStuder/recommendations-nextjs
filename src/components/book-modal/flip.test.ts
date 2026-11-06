import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOOK_ASPECT,
  SAMPLES,
  closeKeyframes,
  easeInOutCubic,
  geometryFor,
  openKeyframes,
  poseAt,
  prefersReducedMotion,
  toBox,
  type Box,
} from "./flip";

const stage = { width: 1000, height: 800 };
const card = { width: 400 };

describe("geometryFor", () => {
  it("is the identity when the cover is exactly where the centred card is", () => {
    const rect: Box = { left: 300, top: 100, width: 400, height: 600 }; // centre = (500, 400) = stage centre
    expect(geometryFor(rect, stage, card)).toEqual({ dx: 0, dy: 0, scale: 1 });
  });

  it("measures from the centre of the cover to the centre of the stage", () => {
    const rect: Box = { left: 100, top: 50, width: 96, height: 144 }; // centre = (148, 122)
    const g = geometryFor(rect, stage, card);
    expect(g.dx).toBe(148 - 500);
    expect(g.dy).toBe(122 - 400);
  });

  it("scales by cover width over card width, so a cover a quarter of the card's width gives 0.25", () => {
    expect(geometryFor({ left: 0, top: 0, width: 100, height: 150 }, stage, card).scale).toBe(0.25);
  });

  it("puts a cover below and right of centre at positive offsets, above and left at negative", () => {
    const below = geometryFor({ left: 800, top: 700, width: 96, height: 144 }, stage, card);
    const above = geometryFor({ left: 10, top: 10, width: 96, height: 144 }, stage, card);
    expect(below.dx).toBeGreaterThan(0);
    expect(below.dy).toBeGreaterThan(0);
    expect(above.dx).toBeLessThan(0);
    expect(above.dy).toBeLessThan(0);
  });

  it("keeps cover and card in the same shape, so one scale number is enough", () => {
    expect(BOOK_ASPECT).toBeCloseTo(96 / 144); // the list cover is w-24 by aspect 2:3
    expect(BOOK_ASPECT).toBeCloseTo(420 / 630);
  });
});

describe("easeInOutCubic", () => {
  const samples = Array.from({ length: 101 }, (_, i) => i / 100);

  it("runs from 0 to 1 and is halfway at the midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it("never goes backwards", () => {
    const values = samples.map(easeInOutCubic);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it("is symmetric, which is what lets closing be exactly opening played backwards", () => {
    for (const u of samples) expect(easeInOutCubic(1 - u)).toBeCloseTo(1 - easeInOutCubic(u), 12);
  });

  it("starts and ends at rest (a soft lift-off and a soft landing)", () => {
    expect(easeInOutCubic(0.02)).toBeLessThan(0.0001);
    expect(1 - easeInOutCubic(0.98)).toBeLessThan(0.0001);
  });

  it("is moving briskly everywhere in between: the speed never drops to zero mid-trip", () => {
    const step = (u: number) => easeInOutCubic(u + 0.01) - easeInOutCubic(u);
    const peak = Math.max(...samples.slice(0, 100).map(step));
    for (const u of [0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75]) expect(step(u)).toBeGreaterThan(peak * 0.15);
  });

  it("clamps out-of-range input", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});

const g = geometryFor({ left: 100, top: 600, width: 96, height: 144 }, stage, card);

describe("poseAt", () => {
  it("is exactly over the cover, face-up, at the start", () => {
    const start = poseAt(g, 0);
    expect(start.x).toBe(g.dx);
    expect(start.y).toBe(g.dy);
    expect(start.scale).toBe(g.scale);
    expect(start.tilt).toBeCloseTo(0); // (it's -0, which prints as 0 in CSS)
    expect(start.flip).toBe(0);
  });

  it("is centred, full size and turned over at the end", () => {
    const end = poseAt(g, 1);
    expect(end.x).toBeCloseTo(0);
    expect(end.y).toBeCloseTo(0);
    expect(end.scale).toBeCloseTo(1);
    expect(end.tilt).toBeCloseTo(0);
    expect(end.flip).toBeCloseTo(180);
  });

  it("is picked UP: at every point along the way it's higher than a straight line from shelf to hand", () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) expect(poseAt(g, p).y).toBeLessThan(g.dy * (1 - p));
  });

  it("swells toward the viewer in the middle, then settles at exactly full size", () => {
    for (const p of [0.25, 0.5, 0.75]) {
      const straight = g.scale + (1 - g.scale) * p;
      expect(poseAt(g, p).scale).toBeGreaterThan(straight);
    }
    // ...but never past full size by much: it's a book, not a balloon
    for (let p = 0; p <= 1; p += 0.05) expect(poseAt(g, p).scale).toBeLessThan(1.2);
  });

  it("is lifted first and turned second: no turn until it's off the shelf", () => {
    expect(poseAt(g, 0.1).flip).toBe(0);
    expect(poseAt(g, 0.2).flip).toBe(0);
    expect(poseAt(g, 0.3).flip).toBeGreaterThan(0);
  });

  it("turns steadily from 0 to 180 without overshooting or going back", () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const { flip } = poseAt(g, Math.min(p, 1));
      expect(flip).toBeGreaterThanOrEqual(last);
      expect(flip).toBeLessThanOrEqual(180);
      last = flip;
    }
    expect(poseAt(g, 0.6).flip).toBeCloseTo(90, 5); // edge-on exactly 60% of the way along
  });

  it("tilts a little in the middle (a carried book) and not at all at either end", () => {
    expect(Math.abs(poseAt(g, 0.5).tilt)).toBeGreaterThan(1);
    for (let p = 0; p <= 1; p += 0.05) expect(Math.abs(poseAt(g, p).tilt)).toBeLessThanOrEqual(4.0001);
  });
});

/** "translate(…) scale(…) rotateZ(…) rotateY(…)" -> ["translate", "scale", "rotateZ", "rotateY"] */
const fnNames = (t: unknown) => String(t).match(/[a-zA-Z]+(?=\()/g);
const nums = (t: unknown) => (String(t).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?(?=(?:px|deg|\)|,))/g) ?? []).map(Number);

/** How far the book moves between two keyframes, in one comparable number (px, plus size and turn scaled into px). */
function steps(frames: Keyframe[]) {
  const poses = frames.map((f) => nums(f.transform)); // [x, y, scale, tilt, flip]
  return poses.slice(1).map((b, i) => {
    const a = poses[i];
    return Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.abs(b[2] - a[2]) * 400 + Math.abs(b[4] - a[4]) * 2;
  });
}

/**
 * The middle 40% of the trip. The start and end are meant to be gentle, so they're excluded. Measured
 * across six very different starting positions, the slowest step in this window is at least 19% of the
 * fastest; the old stitched-together version had steps close to 0% here. 12% leaves room without
 * letting a real stop through.
 */
const middleOf = (all: number[]) =>
  all.filter((_, i) => {
    const u = (i + 1) / (SAMPLES - 1);
    return u >= 0.3 && u <= 0.7;
  });
const MIN_MIDDLE_SPEED = 0.12;

describe("openKeyframes", () => {
  const frames = openKeyframes(g);

  it("is sampled finely enough to look like a curve", () => {
    expect(frames).toHaveLength(SAMPLES);
    expect(SAMPLES).toBeGreaterThanOrEqual(24);
  });

  it("has evenly spaced offsets from 0 to 1", () => {
    const offsets = frames.map((f) => f.offset as number);
    expect(offsets[0]).toBe(0);
    expect(offsets[offsets.length - 1]).toBe(1);
    offsets.slice(1).forEach((o, i) => expect(o - offsets[i]).toBeCloseTo(1 / (SAMPLES - 1), 10));
  });

  it("starts exactly over the cover and ends centred with the back showing", () => {
    expect(nums(frames[0].transform)).toEqual([g.dx, g.dy, g.scale, 0, 0]);
    const last = nums(frames[frames.length - 1].transform);
    expect(last[0]).toBeCloseTo(0);
    expect(last[1]).toBeCloseTo(0);
    expect(last[2]).toBeCloseTo(1);
    expect(last[4]).toBeCloseTo(180);
  });

  it("uses the same transform functions in the same order in every keyframe", () => {
    // Otherwise browsers interpolate whole matrices and the card swings along the wrong path.
    const names = frames.map((f) => fnNames(f.transform)?.join(","));
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe("translate,scale,rotateZ,rotateY");
  });

  it("puts NO easing on individual keyframes", () => {
    // This was the bug. Easing out of one keyframe and into the next brings the motion to a stop at
    // the join (about a tenth of a second of the book hanging in mid-air). Easing lives in the
    // sampled path, once, so the joins are plain straight lines at a steady speed.
    for (const f of frames) expect(f.easing).toBeUndefined();
  });

  it("never stalls mid-trip: its slowest step through the middle is a fair share of its fastest", () => {
    const all = steps(frames);
    const peak = Math.max(...all);
    expect(Math.min(...middleOf(all))).toBeGreaterThan(peak * MIN_MIDDLE_SPEED);
  });

  it("has no sudden jumps: no single step covers more than a tenth of the whole journey", () => {
    const all = steps(frames);
    const total = all.reduce((a, b) => a + b, 0);
    expect(Math.max(...all) / total).toBeLessThan(0.12); // measured: about 0.09
  });

  it("is gentle at the start and the end: the first and last steps are small", () => {
    const all = steps(frames);
    const peak = Math.max(...all);
    expect(all[0]).toBeLessThan(peak * 0.05);
    expect(all[all.length - 1]).toBeLessThan(peak * 0.05);
  });
});

describe("closeKeyframes", () => {
  const open = openKeyframes(g);
  const frames = closeKeyframes(g);

  it("is exactly the opening played backwards, so putting it down mirrors picking it up", () => {
    const backwards = [...open].reverse();
    frames.forEach((f, i) => {
      nums(f.transform).forEach((n, k) => expect(n).toBeCloseTo(nums(backwards[i].transform)[k], 8));
    });
  });

  it("starts where opening ended and ends exactly over the cover again", () => {
    const first = nums(frames[0].transform);
    expect(first[0]).toBeCloseTo(0);
    expect(first[4]).toBeCloseTo(180);
    expect(nums(frames[frames.length - 1].transform)).toEqual([g.dx, g.dy, g.scale, 0, 0]);
  });

  it("uses the same transform functions throughout, and no per-keyframe easing", () => {
    expect(new Set(frames.map((f) => fnNames(f.transform)?.join(","))).size).toBe(1);
    for (const f of frames) expect(f.easing).toBeUndefined();
  });

  it("returns to wherever the cover is NOW, not where it was when opened", () => {
    const moved = geometryFor({ left: 700, top: 20, width: 96, height: 144 }, stage, card);
    const last = closeKeyframes(moved).at(-1)!;
    expect(nums(last.transform).slice(0, 3)).toEqual([moved.dx, moved.dy, moved.scale]);
    expect(moved.dx).not.toBe(g.dx);
  });

  it("turns face-up on the way back before it's put down: face-up by the time it's 80% of the way home", () => {
    const mid = nums(frames[Math.round(SAMPLES * 0.75)].transform);
    expect(mid[4]).toBeLessThan(5); // nearly face-up while still well above the shelf
    expect(mid[1]).toBeLessThan(g.dy); // and not yet down
  });

  it("never stalls mid-trip either", () => {
    const all = steps(frames);
    const peak = Math.max(...all);
    expect(Math.min(...middleOf(all))).toBeGreaterThan(peak * MIN_MIDDLE_SPEED);
  });
});

describe("prefersReducedMotion", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubMedia = (matches: boolean) =>
    vi.stubGlobal("window", { matchMedia: vi.fn((q: string) => ({ matches: matches && q.includes("reduce") })) });

  it("is true when the system asks for reduced motion", () => {
    stubMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });
  it("is false otherwise", () => {
    stubMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
  it("is false (animate normally) where matchMedia doesn't exist", () => {
    vi.stubGlobal("window", {});
    expect(prefersReducedMotion()).toBe(false);
  });
  it("is false outside a browser", () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("toBox", () => {
  it("keeps only plain numbers, so it can live in React state", () => {
    const rect = { left: 1, top: 2, width: 3, height: 4, x: 1, y: 2, toJSON: () => ({}) } as DOMRect;
    expect(toBox(rect)).toEqual({ left: 1, top: 2, width: 3, height: 4 });
  });
});
