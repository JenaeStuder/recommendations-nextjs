import type { Feedback } from "@/lib/scoring";

/** How far (px) or how fast (px/s) the card must be thrown to count as a decision. */
const DISTANCE = 110;
const VELOCITY = 500;

/** Which reaction a drag release means, or undefined if the card should spring back. */
export function reactionFor(offset: { x: number; y: number }, velocity: { x: number; y: number }): Feedback | undefined {
  const horizontal = Math.abs(offset.x) >= Math.abs(offset.y);
  if (horizontal) {
    if (offset.x > DISTANCE || (offset.x > 20 && velocity.x > VELOCITY)) return "like";
    if (offset.x < -DISTANCE || (offset.x < -20 && velocity.x < -VELOCITY)) return "skip";
    return undefined;
  }
  if (offset.y < -DISTANCE || (offset.y < -20 && velocity.y < -VELOCITY)) return "save";
  return undefined;
}
