import { useSyncExternalStore } from "react";

// DESK must match the desk variant in index.css and PHONE the 599px queries in events.css.
export const DESK = "(min-width: 1024px) and (min-height: 560px)";
export const PHONE = "(max-width: 599px)";
export const TOUCH = "(pointer: coarse)";

export function focusWithoutKeyboard(el: HTMLElement | null | undefined, options?: FocusOptions) {
  if (!el || !matchMedia("(pointer: fine)").matches) return false;
  el.focus(options);
  return true;
}

export const useMedia = (query: string) =>
  useSyncExternalStore(
    (listener) => {
      const list = matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => matchMedia(query).matches,
    () => false,
  );
