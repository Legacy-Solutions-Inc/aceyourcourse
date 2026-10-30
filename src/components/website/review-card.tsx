import Link from "next/link";

import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { ReviewWithProduct } from "@/services/catalogue.types";

interface ReviewCardProps {
  review: ReviewWithProduct;
  /** Adds a "View product →" link, for lists that mix Products. */
  showProductLink?: boolean;
  /** A slight tilt in degrees, so a wall of cards looks pinned up by hand. */
  tilt?: number;
  className?: string;
}

/** A Marketplace buyer's Review, copied word for word, with its line breaks. */
export function ReviewCard({
  review,
  showProductLink = false,
  tilt = 0,
  className,
}: ReviewCardProps) {
  return (
    <figure
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
      className={cn(
        "relative flex min-h-55 flex-col gap-3 border border-ayc-rule bg-ayc-paper px-5 py-4.5 text-ayc-navy shadow-note motion-reduce:transform-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full border-[1.5px] border-ayc-navy bg-ayc-orange"
      />
      <div className="mb-0.5 flex items-center justify-between gap-2.5 border-b-2 border-ayc-orange pb-2.5">
        <span
          role="img"
          aria-label={`${review.stars} out of 5 stars`}
          className="text-base leading-none tracking-[2px]"
        >
          <span className="text-ayc-star">{"★".repeat(review.stars)}</span>
          <span className="text-ayc-star-off">{"★".repeat(5 - review.stars)}</span>
        </span>
        <span className="border-[1.5px] border-ayc-blue px-1.5 py-1.25 font-mono text-[10px] leading-none font-bold tracking-wider text-ayc-blue uppercase">
          {review.product.examCode}
        </span>
      </div>
      <blockquote className="bg-[repeating-linear-gradient(transparent_0_25px,var(--ayc-ruled)_25px_26px)] text-base leading-6.5 text-pretty whitespace-pre-line">
        {review.text}
      </blockquote>
      <figcaption className="mt-auto flex flex-col gap-1 pt-1.5 font-mono text-[11px] leading-[1.45] text-ayc-slate">
        <span className="font-medium text-ayc-navy">{review.product.shortName}</span>
        <span>
          {review.variation ? `Variation: ${review.variation}` : "Variation not specified"}
        </span>
        {review.helpful > 0 ? <span>{review.helpful} found this helpful</span> : null}
        {showProductLink ? (
          <Link
            href={paths.products.details(review.product.slug)}
            className="mt-1 font-bold text-ayc-blue"
          >
            View product <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}
