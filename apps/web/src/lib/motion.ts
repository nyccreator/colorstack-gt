import { useCallback, useEffect, useRef, useState } from "react";

// ENTER and MOVE are repeated as --ease-out-quint and --ease-move in index.css, so change both together.
export const ENTER = "cubic-bezier(0.22, 1, 0.36, 1)";
export const MOVE = "cubic-bezier(0.32, 0.72, 0, 1)";
export const APPEAR = "cubic-bezier(0.23, 1, 0.32, 1)";

export const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export const BUSY_AFTER = 400;
export const LABEL_HOLD = 400;
export const FADE = "cubic-bezier(0.5, 1, 0.89, 1)";

export function useSlowHold(busy: boolean) {
  const [slow, setSlow] = useState(false);
  const shownAt = useRef(0);
  if (!busy && slow) setSlow(false);
  useEffect(() => {
    if (!busy) return;
    shownAt.current = 0;
    const timer = setTimeout(() => {
      shownAt.current = performance.now();
      setSlow(true);
    }, BUSY_AFTER);
    return () => clearTimeout(timer);
  }, [busy]);
  const hold = useCallback(
    () =>
      new Promise<void>((resolve) =>
        setTimeout(resolve, shownAt.current ? shownAt.current + LABEL_HOLD - performance.now() : 0),
      ),
    [],
  );
  return [busy && slow, hold] as const;
}

export const useSlow = (busy: boolean) => useSlowHold(busy)[0];

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
          easing: FADE,
          fill: "forwards",
        })
        .finished.then(onGone, () => {}),
    2800,
  );
  return () => clearTimeout(timer);
}

export function slide(el: Element, enter: boolean, dir = 1) {
  const calm = still();
  const away =
    calm || getComputedStyle(el).position === "fixed"
      ? "none"
      : `translateY(${(enter ? 16 : -12) * dir}px)`;
  const frames = [
    { opacity: 0, transform: away },
    { opacity: 1, transform: "none" },
  ];
  return enter
    ? el.animate(frames, { duration: calm ? 120 : 300, easing: ENTER })
    : el.animate(frames.reverse(), { duration: 120, easing: APPEAR, fill: "forwards" });
}
