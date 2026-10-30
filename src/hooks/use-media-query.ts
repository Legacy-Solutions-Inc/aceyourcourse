import { useCallback, useSyncExternalStore } from "react";

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** The `wide:` breakpoint (760 px), where layouts switch from phone to desktop. */
export const WIDE_SCREEN = "(min-width: 47.5rem)";

const matches = (query: string) =>
  typeof window.matchMedia === "function" && window.matchMedia(query).matches;
// The server can't know, and hydration must match it.
const unknownOnServer = () => null;

/**
 * Whether a media query matches, kept in sync as it changes. Null on the server
 * and while hydrating, so the server HTML never depends on it.
 */
export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matches(query), unknownOnServer);
}
