/**
 * The "pick the book up and turn it over" animation, as plain functions so the geometry can be
 * unit tested without a browser.
 *
 * The technique is FLIP (First, Last, Invert, Play): the modal's card is laid out centred at its
 * final size; to start the animation we move and shrink it (an "inverted" transform) so it sits
 * exactly over the cover in the list, then animate the transform back to nothing.
 *
 * Smoothness: the whole trip is ONE continuous path, `poseAt`, driven by ONE ease-in-out curve,
 * and sampled into many small steps. An earlier version stitched a "lift" segment (easing out) to
 * a "flip" segment (easing in); both curves come to rest at the join, so the book stopped dead
 * for about a tenth of a second mid-air. Here the speed only drops to zero at the very start and
 * the very end.
 */

export type Box = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

export type FlipGeometry = {
  /** Horizontal distance from the stage centre to the centre of the cover, in px. */
  dx: number;
  /** Vertical distance, in px. */
  dy: number;
  /** Cover width divided by card width. Cover and card share an aspect ratio, so one number scales both axes. */
  scale: number;
};

/** A book cover is 2 units wide for every 3 tall. The list covers and the modal card share this ratio, which is what lets one scale number resize both. */
export const BOOK_ASPECT = 2 / 3;

export const OPEN_MS = 1200;
export const CLOSE_MS = 1000;

/** How many keyframes the path is sampled into. Enough that straight lines between them look curved. */
export const SAMPLES = 48;

/** How high the book rises above a straight line between shelf and hand, at the top of its arc, in px. */
const LIFT_PX = 36;
/** Extra size, as a fraction of full size, at the middle of the trip: it comes toward you. */
const SCALE_BUMP = 0.1;
/** The slight tilt of a book being carried, in degrees, at the middle of the trip. */
const TILT = -4;
/** How far along the trip (0..1) the book is before it starts turning over: lifted first, turned second. */
const FLIP_START = 0.2;

/** Where a card centred in `stage` must be moved and scaled to sit exactly over `rect`. */
export function geometryFor(rect: Box, stage: Size, card: Pick<Size, "width">): FlipGeometry {
  return {
    dx: rect.left + rect.width / 2 - stage.width / 2,
    dy: rect.top + rect.height / 2 - stage.height / 2,
    scale: rect.width / card.width,
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Starts and ends at rest, fastest in the middle, never stops in between. Symmetric: ease(1 - u) = 1 - ease(u). */
export function easeInOutCubic(u: number): number {
  const t = clamp01(u);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Zero speed AND zero acceleration at both ends, so the turn begins and ends without a jolt. */
function smootherstep(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export type Pose = {
  x: number;
  y: number;
  scale: number;
  /** Tilt around the screen's axis, degrees. */
  tilt: number;
  /** Turn around the vertical axis, degrees: 0 = cover showing, 180 = back showing. */
  flip: number;
};

/**
 * Where the book is at progress `p`: 0 = on the shelf (over its cover), 1 = in hand (centred, back showing).
 * It travels in a straight line, rising on an arc and swelling toward you on the way, and starts
 * turning over once it's off the shelf.
 */
export function poseAt(g: FlipGeometry, p: number): Pose {
  const arc = Math.sin(Math.PI * p); // 0 at both ends, 1 in the middle
  return {
    x: g.dx * (1 - p),
    y: g.dy * (1 - p) - LIFT_PX * arc,
    scale: g.scale + (1 - g.scale) * p + SCALE_BUMP * arc,
    tilt: TILT * arc,
    flip: 180 * smootherstep((p - FLIP_START) / (1 - FLIP_START)),
  };
}

// Every keyframe uses the same four transform functions in the same order. If they differed,
// browsers would interpolate matrices instead, and the path would swing wildly.
const transformOf = (s: Pose) =>
  `translate(${s.x}px, ${s.y}px) scale(${s.scale}) rotateZ(${s.tilt}deg) rotateY(${s.flip}deg)`;

/**
 * `progressAt(u)` says how far along the trip (0..1) the book is at time `u` (0..1). Keyframes sit at
 * even steps of time and are joined with linear easing: the easing lives in `progressAt`, once.
 */
function sample(g: FlipGeometry, progressAt: (u: number) => number): Keyframe[] {
  return Array.from({ length: SAMPLES }, (_, i) => {
    const u = i / (SAMPLES - 1);
    return { offset: u, transform: transformOf(poseAt(g, progressAt(u))) };
  });
}

/** Shelf to hand: lifts off the shelf, travels to the centre, and turns over to show its back. */
export function openKeyframes(g: FlipGeometry): Keyframe[] {
  return sample(g, easeInOutCubic);
}

/** Hand to shelf: the same path run backwards, so it turns face-up on the way back and then settles down into its place. */
export function closeKeyframes(g: FlipGeometry): Keyframe[] {
  return sample(g, (u) => 1 - easeInOutCubic(u));
}

/** True when the user has asked their system for less motion. The flip then becomes an instant swap. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** A DOMRect (or anything shaped like one) as a plain Box, safe to keep in React state. */
export function toBox(r: Pick<DOMRect, "left" | "top" | "width" | "height">): Box {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
