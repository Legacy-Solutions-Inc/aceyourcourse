import { RatingStar } from "@/components/website/rating-star";
import { ReviewCard } from "@/components/website/review-card";
import { websiteCopy } from "@/content/website";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { formatAsOf } from "@/lib/manila-time";
import type { Product, ReviewWithProduct } from "@/services/catalogue.types";

// Hand-placed tilts for the Review wall, from the mockup.
const TILTS = [-1, 0.8, -0.4, 1.1, -0.8];

/** A Live Product's Shopee rating and every one of its Reviews. */
export function ProductReviews({
  product,
  reviews,
}: {
  product: Product;
  reviews: ReviewWithProduct[];
}) {
  return (
    <section
      aria-labelledby="reviews-heading"
      className="flex flex-col gap-[clamp(28px,3.5vw,44px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <h2
          id="reviews-heading"
          className="text-[clamp(32px,4vw,52px)] leading-none font-extrabold tracking-[-0.03em]"
        >
          Reviews
        </h2>
        {product.shopee ? (
          <p data-testid="review-summary" className="font-mono text-[13px] font-medium">
            <RatingStar /> {formatRating(product.shopee.rating)} ·{" "}
            {formatCount(product.shopee.ratingCount)} ratings on Shopee ·{" "}
            {formatAsOf(product.shopee.asOf)}
          </p>
        ) : null}
      </div>
      {reviews.length > 0 ? (
        <ul className="columns-[3_280px] gap-6">
          {reviews.map((review, index) => (
            <li key={review.id} className="break-inside-avoid px-1 pt-3.5 pb-5.5">
              <ReviewCard review={review} tilt={TILTS[index % TILTS.length]} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex max-w-140 flex-col gap-2.5 border-[1.5px] border-dashed border-ayc-slate p-6">
          <p className="text-[22px] font-extrabold tracking-[-0.02em]">
            {websiteCopy.product.noReviewsTitle}
          </p>
          <p className="text-base leading-normal">{websiteCopy.product.noReviews}</p>
        </div>
      )}
    </section>
  );
}
