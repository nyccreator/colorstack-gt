export const EXIT = "cubic-bezier(0.4, 0, 1, 1)";
import { useEffect, useState } from "react";

// ENTER and MOVE are repeated as --ease-out-quint and --ease-move in index.css, so change both together.
export const ENTER = "cubic-bezier(0.22, 1, 0.36, 1)";
export const MOVE = "cubic-bezier(0.32, 0.72, 0, 1)";
export const APPEAR = "cubic-bezier(0.23, 1, 0.32, 1)";

export const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const BUSY_AFTER = 400;

export function useSlow(busy: boolean) {
  const [slow, setSlow] = useState(false);
  if (!busy && slow) setSlow(false);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), BUSY_AFTER);
    return () => clearTimeout(timer);
  }, [busy]);
  return busy && slow;
}

export function appear(el: Element, { delay = 0, slide = true } = {}) {
  return el.animate(
    [
      { opacity: 0, transform: slide && !still() ? "translateX(-6px)" : "none" },
      { opacity: 1, transform: "none" },
    ],
    { duration: still() ? 120 : 200, delay, easing: APPEAR, fill: "backwards" },
  );
}

export function cue(el: Element, onGone: () => void, delay = 0) {
  appear(el, { delay });
  const timer = setTimeout(
    () =>
      void el
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 400,
          easing: "ease-in",
          fill: "forwards",
        })
        .finished.then(onGone, () => {}),
    2800,
  );
  return () => clearTimeout(timer);
}

export function slide(el: Element, enter: boolean, dir = 1) {
  const away =
    getComputedStyle(el).position === "fixed"
      ? "none"
      : `translateY(${(enter ? 16 : -12) * dir}px)`;
  const frames = [
    { opacity: 0, transform: away },
    { opacity: 1, transform: "none" },
  ];
  return enter
    ? el.animate(frames, { duration: 300, easing: ENTER })
    : el.animate(frames.reverse(), { duration: 140, easing: EXIT, fill: "forwards" });
}
