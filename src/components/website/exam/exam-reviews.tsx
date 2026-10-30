import { useId } from "react";

import { Marquee } from "@/components/website/marquee";
import { ReviewCard } from "@/components/website/review-card";
import { examPageCopy } from "@/content/exam-pages";
import { reviewDisplayMode } from "@/lib/catalogue/review-display";
import { cn } from "@/lib/utils";
import type { ReviewWithProduct } from "@/services/catalogue.types";

const copy = examPageCopy.reviews;
const container = "mx-auto w-full max-w-324 px-[clamp(20px,5vw,72px)]";
/** A slight tilt per card, so the wall looks pinned up by hand (L258). */
const TILTS = [-1, 1.1, -0.5, 0.8, -1.2, 0.6, -0.8];
const tilt = (index: number) => TILTS[index % TILTS.length];

interface ExamReviewsProps {
  examCode: string;
  /** The Exam's Reviews in best-seller order, at most 7. */
  reviews: ReviewWithProduct[];
}

/**
 * "From {code} reviewees". Four or more Reviews scroll in a marquee that
 * pauses on hover and stands still with reduced motion; one to three sit in a
 * grid; none shows the no-reviews message. Each Review links to its Product.
 */
export function ExamReviews({ examCode, reviews }: ExamReviewsProps) {
  const headingId = useId();
  const mode = reviewDisplayMode(reviews.length);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-[clamp(28px,3.5vw,44px)] py-[clamp(64px,8vw,112px)]"
    >
      <div className={container}>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading(examCode)}
          </h2>
        </div>
      </div>

      {mode === "marquee" ? (
        <Marquee
          label={copy.marqueeLabel(examCode)}
          speed={30}
          className="mask-x-from-94% py-2.5"
          rowClassName="items-start pt-2"
        >
          {reviews.map((review, index) => (
            <ReviewCard
              key={review.id}
              review={review}
              showProductLink
              tilt={tilt(index)}
              className="w-82.5 flex-none"
            />
          ))}
        </Marquee>
      ) : null}

      {mode === "grid" ? (
        <ul
          aria-labelledby={headingId}
          className={cn(
            container,
            "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6",
          )}
        >
          {reviews.map((review, index) => (
            <li key={review.id} className="px-1 py-2.5">
              <ReviewCard review={review} showProductLink tilt={tilt(index)} />
            </li>
          ))}
        </ul>
      ) : null}

      {mode === "empty" ? (
        <div className={container}>
          <p className="max-w-140 border-[1.5px] border-dashed border-ayc-slate p-6 text-base leading-normal text-ayc-slate">
            {copy.empty}
          </p>
        </div>
      ) : null}
    </section>
  );
}
