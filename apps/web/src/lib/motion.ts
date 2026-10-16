import { useEffect, useState } from "react";

// Arrivals ease out, departures ease in and go quickly, what travels with the hand or across the screen moves, and brief
// cues such as Saved and Added appear. The same curves are tokens in index.css.
export const ENTER = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EXIT = "cubic-bezier(0.4, 0, 1, 1)";
export const MOVE = "cubic-bezier(0.32, 0.72, 0, 1)";
export const APPEAR = "cubic-bezier(0.23, 1, 0.32, 1)";

export const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const BUSY_AFTER = 400;

// A busy label shows only once an action has run long enough to need one, so a quick action never flashes it.
export function useSlow(busy: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), BUSY_AFTER);
    return () => clearTimeout(timer);
  }, [busy]);
  return busy && slow;
}
