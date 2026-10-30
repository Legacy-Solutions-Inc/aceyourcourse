"use client";

import { useRef, useState } from "react";

import { ProductImage } from "@/components/website/product-image";
import { cn } from "@/lib/utils";
import type { ProductPhoto } from "@/services/catalogue.types";

const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index) => index + 1,
  ArrowDown: (index) => index + 1,
  ArrowLeft: (index) => index - 1,
  ArrowUp: (index) => index - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The Product's photos: the main image with an "i / N" counter, and a
 * thumbnail per photo. The thumbnails are one tab stop; the arrow keys (and
 * Home and End) move between them, wrapping round. With no photos it shows the
 * placeholder.
 */
export function ProductGallery({ photos }: { photos: ProductPhoto[] }) {
  const [index, setIndex] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = photos.length;
  const current = photos[index] ?? null;

  function onThumbKeyDown(event: React.KeyboardEvent) {
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const next = (move(index, count) + count) % count;
    setIndex(next);
    thumbs.current[next]?.focus();
  }

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div
        data-testid="gallery-main"
        className="relative aspect-square overflow-hidden border-[1.5px] border-ayc-navy bg-ayc-sand shadow-[8px_8px_0_-1.5px_var(--ayc-cream),8px_8px_0_0_var(--ayc-navy)]"
      >
        <ProductImage
          photo={current}
          sizes="(min-width: 47.5rem) 55vw, 100vw"
          priority={index === 0}
        />
        {count > 0 ? (
          <p className="absolute bottom-3 left-3 bg-ayc-navy px-2.25 py-1.75 font-mono text-[11px] leading-none text-ayc-cream">
            {index + 1} / {count}
          </p>
        ) : null}
      </div>
      {count > 1 ? (
        <div
          role="group"
          aria-label="Photos"
          onKeyDown={onThumbKeyDown}
          className="mt-1.5 grid grid-cols-8 gap-2"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.src}
              ref={(element) => {
                thumbs.current[i] = element;
              }}
              type="button"
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-pressed={i === index}
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-square min-w-0 cursor-pointer overflow-hidden bg-ayc-sand",
                i === index ? "border-2 border-ayc-blue" : "border-[1.5px] border-ayc-rule",
              )}
            >
              <ProductImage
                photo={photo}
                alt=""
                sizes="96px"
                className={i === index ? undefined : "opacity-75"}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
