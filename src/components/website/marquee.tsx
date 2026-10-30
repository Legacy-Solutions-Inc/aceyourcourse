"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
// The server can't know, so it renders the moving row; CSS still stops the
// animation (motion-reduce) until the client swaps in the static row.
const prefersReducedMotionOnServer = () => false;

interface MarqueeProps {
  children: React.ReactNode;
  /** Names the region for screen readers, e.g. "Buyer reviews". */
  label: string;
  /** Pixels per second. */
  speed?: number;
  /** Scrolls right instead of left. */
  reverse?: boolean;
  className?: string;
  /** Classes for each row of items, e.g. the gap between them. */
  rowClassName?: string;
}

/**
 * A row of items that scrolls sideways forever. A second copy of the items
 * makes the loop seamless; it is hidden from screen readers and can't be
 * focused. Hovering or focusing inside pauses it. With reduced motion it is a
 * single static row that scrolls by hand.
 */
export function Marquee({
  children,
  label,
  speed = 40,
  reverse = false,
  className,
  rowClassName,
}: MarqueeProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    prefersReducedMotion,
    prefersReducedMotionOnServer,
  );
  const track = useRef<HTMLDivElement>(null);

  // One loop moves the track by one copy's width, so the duration is that
  // width over the speed. Re-measure when the items change size.
  useEffect(() => {
    const element = track.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const seconds = element.scrollWidth / 2 / Math.max(speed, 1);
      element.style.setProperty("--marquee-duration", `${seconds}s`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [speed, reducedMotion]);

  const row = cn("flex shrink-0 items-stretch gap-6 pr-6", rowClassName);

  return (
    <section aria-label={label} className={cn("overflow-hidden", className)}>
      {reducedMotion ? (
        <div data-marquee-copy className={cn(row, "overflow-x-auto")}>
          {children}
        </div>
      ) : (
        <div
          ref={track}
          data-speed={speed}
          className={cn(
            "flex w-max animate-marquee focus-within:paused hover:paused motion-reduce:animate-none",
            reverse && "direction-[reverse]",
          )}
        >
          <div data-marquee-copy className={row}>
            {children}
          </div>
          <div data-marquee-copy aria-hidden="true" inert className={row}>
            {children}
          </div>
        </div>
      )}
    </section>
  );
}
