import { useSyncExternalStore } from "react";

/**
 * Swipe is a touch interaction, so it is offered on phones and touch-first devices (tablets
 * included) and hidden for a mouse on a wide window. A narrow desktop window counts as "mobile".
 */
export const SWIPE_QUERY = "(max-width: 767px), (pointer: coarse)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(SWIPE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** False on the server and during hydration, so the first paint is the list everyone can use. */
export function useSwipeAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SWIPE_QUERY).matches,
    () => false,
  );
}
