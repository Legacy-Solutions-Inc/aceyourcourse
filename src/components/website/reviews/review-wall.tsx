import Link from "next/link";
import { useId } from "react";

import { ReviewCard } from "@/components/website/review-card";
import { REVIEWS_SECTION_IDS } from "@/components/website/reviews/section-ids";
import { reviewsPageCopy } from "@/content/reviews-page";
import { paths } from "@/paths";
import type { ReviewWithProduct } from "@/services/catalogue.types";

const copy = reviewsPageCopy;
/** A slight tilt per card, so the wall looks pinned up by hand (L120). */
const TILTS = [-1.2, 0.8, -0.4, 1.1, -0.9, 0.5];

interface ReviewWallProps {
  /** The Reviews that match the filters, in the chosen sort. */
  reviews: ReviewWithProduct[];
  /** Every written Review, the "M" in "N of M written reviews". */
  total: number;
  /** The filter bar, between the heading and the cards. */
  filterBar: React.ReactNode;
}

/**
 * "The review wall" (#wall): the count, the filters and a ReviewCard per
 * matching Review, each linking to its Product. With no match, the empty
 * state offers Clear filters.
 */
export function ReviewWall({ reviews, total, filterBar }: ReviewWallProps) {
  const headingId = useId();

  return (
    <section
      id={REVIEWS_SECTION_IDS.wall}
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 scroll-mt-24 flex-col gap-5 px-[clamp(20px,5vw,72px)] pt-[clamp(48px,6vw,80px)] pb-[clamp(64px,8vw,112px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h2
          id={headingId}
          className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
        >
          {copy.wall.heading}
        </h2>
        <p role="status" className="font-mono text-[13px] font-bold tracking-[0.04em] uppercase">
          {copy.wall.count(reviews.length, total)}
        </p>
      </div>

      {filterBar}

      {reviews.length > 0 ? (
        <ul aria-labelledby={headingId} className="columns-[3_300px] gap-7 pt-5">
          {reviews.map((review, index) => (
            <li key={review.id} className="break-inside-avoid px-1 pt-2.5 pb-5.5">
              <ReviewCard review={review} showProductLink tilt={TILTS[index % TILTS.length]} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3.5 border-[1.5px] border-dashed border-ayc-navy bg-ayc-paper p-8">
          <p className="text-2xl font-extrabold tracking-[-0.02em]">{copy.empty.heading}</p>
          <p className="text-base text-ayc-slate">{copy.empty.hint}</p>
          <Link
            href={paths.reviews}
            replace
            scroll={false}
            className="flex min-h-11.5 items-center bg-ayc-navy px-4.5 text-[15px] font-bold text-ayc-cream no-underline hover:bg-ayc-blue hover:text-ayc-cream"
          >
            {copy.empty.clearFilters}
          </Link>
        </div>
      )}
    </section>
  );
}
