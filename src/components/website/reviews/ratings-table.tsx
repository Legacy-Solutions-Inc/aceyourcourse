import Link from "next/link";
import { useId } from "react";

import { REVIEWS_SECTION_IDS } from "@/components/website/reviews/section-ids";
import { reviewsPageCopy } from "@/content/reviews-page";
import { figuresAsOf } from "@/lib/catalogue/best-sellers";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { reviewsHref } from "@/lib/catalogue/review-filters";
import { formatAsOf } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import type { Product } from "@/services/catalogue.types";

const copy = reviewsPageCopy.ratings;

type RatedProduct = Product & { shopee: NonNullable<Product["shopee"]> };
const isRated = (product: Product): product is RatedProduct =>
  product.state === "live" && product.shopee !== null;

interface RatingsTableProps {
  /** Live Products with Shopee figures, best selling first. */
  products: Product[];
  /** The Product the wall is filtered to, if any. */
  selectedSlug?: string;
}

/**
 * "Ratings by reviewer": a row per Live Product with Shopee figures, each
 * linking to the review wall filtered to it. Coming Soon Products have no
 * figures, so they never get a "0.0" row. Hidden when nothing is rated.
 */
export function RatingsTable({ products, selectedSlug }: RatingsTableProps) {
  const headingId = useId();
  const rated = products.filter(isRated);
  const asOf = figuresAsOf(rated);
  if (rated.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="border-b-[1.5px] border-ayc-navy">
      <div className="mx-auto flex max-w-324 flex-col gap-5 px-[clamp(20px,5vw,72px)] py-[clamp(48px,6vw,80px)]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2.5">
          <h2
            id={headingId}
            className="text-[clamp(30px,3.6vw,48px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading}
          </h2>
          <p className="font-mono text-xs font-medium text-ayc-slate uppercase">{copy.hint}</p>
        </div>
        <ul
          aria-labelledby={headingId}
          className="flex flex-col border-[1.5px] border-ayc-navy bg-ayc-paper"
        >
          {rated.map((product) => {
            const selected = product.slug === selectedSlug;
            return (
              <li key={product.id} className="border-b border-ayc-rule last:border-b-0">
                <Link
                  href={`${reviewsHref({ productSlug: product.slug })}#${REVIEWS_SECTION_IDS.wall}`}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "grid min-h-15 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-[clamp(14px,2vw,22px)] py-3 text-ayc-navy no-underline transition-colors hover:bg-ayc-sand hover:text-ayc-navy motion-reduce:transition-none wide:grid-cols-[44px_minmax(0,1.6fr)_minmax(120px,1fr)_96px]",
                    selected && "bg-ayc-sand",
                  )}
                >
                  <span className="justify-self-start border-[1.5px] border-ayc-navy bg-ayc-orange px-1.75 py-1.25 font-mono text-[10px] leading-none font-bold">
                    {product.examCode}
                  </span>
                  {/* On a phone the name gets its own line, so it isn't cut short. */}
                  <span className="col-span-2 min-w-0 text-base font-bold wide:col-span-1 wide:truncate">
                    {product.shortName}
                  </span>
                  <span className="col-start-2 flex items-center gap-2.5 wide:col-start-auto">
                    <span
                      aria-hidden="true"
                      className="relative h-2 flex-1 overflow-hidden border border-ayc-navy bg-ayc-sand"
                    >
                      <span
                        data-testid="rating-bar"
                        className="absolute inset-y-0 left-0 bg-ayc-blue"
                        style={{ width: `${(product.shopee.rating / 5) * 100}%` }}
                      />
                    </span>
                    <span className="sr-only">{copy.rated} </span>
                    <span className="min-w-7.5 font-mono text-sm font-bold">
                      {formatRating(product.shopee.rating)}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs font-medium whitespace-nowrap text-ayc-slate">
                    {copy.ratingCount(formatCount(product.shopee.ratingCount))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {asOf ? (
          <p className="font-mono text-xs text-ayc-slate">
            {copy.figuresNote} {formatAsOf(asOf)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
