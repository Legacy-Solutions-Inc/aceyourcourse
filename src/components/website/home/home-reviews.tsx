import { useId } from "react";

import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { MarketplaceLink } from "@/components/website/marketplace-link";
import { Marquee } from "@/components/website/marquee";
import { ReviewCard } from "@/components/website/review-card";
import { homeCopy } from "@/content/home";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { formatAsOf } from "@/lib/manila-time";
import type { ReviewWithProduct, ShopStats } from "@/services/catalogue.types";

const copy = homeCopy.reviews;
/**
 * Each marquee row: its cards' tilts, so the wall looks pinned up by hand
 * (L349–351), and its speed in pixels per second. The second row is a little
 * slower and runs the other way (L223, L226).
 */
const ROWS = [
  { tilts: [-1.2, 1, -0.5, 0.8, -1], speed: 30, reverse: false },
  { tilts: [1.2, -0.8, 0.6, -1.1, 0.9], speed: 26, reverse: true },
];

interface HomeReviewsProps {
  /** The Home selection: the pinned Reviews in pin order, from listHomeReviews. */
  reviews: ReviewWithProduct[];
  shopStats: ShopStats;
  /** The Shopee shop page. Null hides "Read every review on Shopee". */
  shopeeShopLink: string | null;
}

/**
 * "Pinned by reviewees" `#reviews`: the pinned Reviews across two marquee rows
 * running opposite ways (the first takes the extra one), each pausing on hover
 * or focus and standing still with reduced motion. The shop's Shopee rating
 * shows with its date. Renders nothing with no pinned Reviews.
 */
export function HomeReviews({ reviews, shopStats, shopeeShopLink }: HomeReviewsProps) {
  const headingId = useId();
  if (reviews.length === 0) return null;
  const half = Math.ceil(reviews.length / 2);
  const rows = [reviews.slice(0, half), reviews.slice(half)].flatMap((items, index) => {
    const row = ROWS[index];
    return row && items.length > 0 ? [{ ...row, items }] : [];
  });

  return (
    <section
      id={HOME_SECTION_IDS.reviews}
      aria-labelledby={headingId}
      className="flex scroll-mt-24 flex-col gap-[clamp(32px,4vw,52px)] py-[clamp(64px,8vw,120px)]"
    >
      <div className="mx-auto flex w-full max-w-324 flex-wrap items-end justify-between gap-x-12 gap-y-5 px-[clamp(20px,5vw,72px)]">
        <div className="flex max-w-140 flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading}
          </h2>
          <p className="text-[17px] leading-normal text-ayc-slate">{copy.intro}</p>
        </div>
        <p className="flex items-center gap-4 border-[1.5px] border-ayc-navy bg-ayc-paper px-5 py-3.5 shadow-hard">
          <span className="text-[52px] leading-none font-black tracking-[-0.03em]">
            {formatRating(shopStats.rating)}
          </span>
          <span className="flex flex-col gap-1">
            <span role="img" aria-label={copy.outOfFive} className="tracking-[2px] text-ayc-star">
              ★★★★★
            </span>
            <span className="font-mono text-xs font-medium">
              {copy.shopRatings(formatCount(shopStats.ratingCount))}
            </span>
            <span className="font-mono text-[11px] text-ayc-slate">
              {formatAsOf(shopStats.asOf)}
            </span>
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {rows.map((row, rowIndex) => (
          <Marquee
            key={rowIndex}
            label={copy.row(rowIndex + 1, rows.length)}
            speed={row.speed}
            reverse={row.reverse}
            className="mask-x-from-94% py-2.5"
            rowClassName="items-start pt-2"
          >
            {row.items.map((review, index) => (
              <ReviewCard
                key={review.id}
                review={review}
                showProductLink
                tilt={row.tilts[index % row.tilts.length]}
                clampQuote
                className="w-82.5 flex-none"
              />
            ))}
          </Marquee>
        ))}
      </div>

      {shopeeShopLink ? (
        <MarketplaceLink
          href={shopeeShopLink}
          marketplace="shopee"
          link="shop"
          className="self-center border-b-2 border-ayc-orange pb-0.5 text-base font-bold text-ayc-navy no-underline hover:text-ayc-navy"
        >
          {copy.readAll} <span aria-hidden="true">↗</span>
        </MarketplaceLink>
      ) : null}
    </section>
  );
}
