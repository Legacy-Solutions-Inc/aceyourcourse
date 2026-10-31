"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { homeCopy } from "@/content/home";
import { REDUCED_MOTION, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const copy = homeCopy.bestSellers;
/** The mockup's step (L327): 80% of the track, at most 680 px. */
const MAX_STEP_PX = 680;

const arrow =
  "flex size-13 cursor-pointer items-center justify-center border-[1.5px] border-ayc-cream text-lg font-bold transition-colors focus-visible:outline-ayc-cream disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

interface BestSellersCarouselProps {
  /** The heading's id, which names the list. */
  headingId: string;
  /** The heading block, shown beside the ← and → buttons. */
  intro: React.ReactNode;
  /** The cards, each a list item. */
  children: React.ReactNode;
}

/**
 * The Best sellers track and its ← and → buttons, which scroll it by most of
 * its width and are disabled at the start and end. The track snaps to each
 * card and also scrolls by hand.
 */
export function BestSellersCarousel({ headingId, intro, children }: BestSellersCarouselProps) {
  const [ends, setEnds] = useState({ atStart: true, atEnd: true });
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const track = useRef<HTMLOListElement>(null);

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const { scrollLeft, scrollWidth, clientWidth } = element;
    setEnds({ atStart: scrollLeft <= 1, atEnd: scrollLeft + clientWidth >= scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  const scroll = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.min(MAX_STEP_PX, element.clientWidth * 0.8),
      behavior: reducedMotion === false ? "smooth" : "auto",
    });
  };

  return (
    <div className="flex flex-col gap-[clamp(28px,3.5vw,44px)]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        {intro}
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={copy.previous}
            disabled={ends.atStart}
            onClick={() => scroll(-1)}
            className={cn(arrow, "text-ayc-cream enabled:hover:bg-ayc-cream/15")}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            aria-label={copy.next}
            disabled={ends.atEnd}
            onClick={() => scroll(1)}
            className={cn(arrow, "bg-ayc-orange text-ayc-navy")}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <ol
        ref={track}
        aria-labelledby={headingId}
        onScroll={measure}
        className="-mr-3 -ml-1 flex snap-x snap-mandatory scroll-pl-1 scrollbar-none gap-5 overflow-x-auto pt-1 pr-3 pb-4 pl-1"
      >
        {children}
      </ol>
    </div>
  );
}
