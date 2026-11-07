import Link from "next/link";
import { useId } from "react";

import { reviewsPageCopy } from "@/content/reviews-page";
import { paths } from "@/paths";

const copy = reviewsPageCopy.passedWithOurCards;

/**
 * "Passed with our cards?": an invitation to email AYC a board exam story.
 * There is no on-site review form, so Reviews stay word for word from Shopee.
 */
export function PassedWithOurCards({ contactEmail }: { contactEmail: string }) {
  const headingId = useId();
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(copy.emailSubject)}`;

  return (
    <section
      aria-labelledby={headingId}
      className="border-y-[1.5px] border-ayc-navy bg-ayc-orange text-ayc-navy"
    >
      <div className="mx-auto flex max-w-324 flex-wrap items-center justify-between gap-x-10 gap-y-5 px-[clamp(20px,5vw,72px)] py-[clamp(40px,5vw,72px)]">
        <div className="flex max-w-140 flex-col gap-2.5">
          <h2
            id={headingId}
            className="text-[clamp(30px,3.8vw,52px)] leading-none font-extrabold tracking-[-0.035em]"
          >
            {copy.heading}
          </h2>
          <p className="text-[17px] leading-normal">{copy.body}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a
            href={mailto}
            className="flex min-h-14 flex-col justify-center gap-0.75 border-[1.5px] border-ayc-navy bg-ayc-navy px-5.5 py-1.5 text-ayc-cream no-underline shadow-hard-md shadow-ayc-cream transition-[translate,box-shadow] hover:-translate-0.5 hover:text-ayc-cream hover:shadow-hard-lg hover:shadow-ayc-cream motion-reduce:transition-none"
          >
            <span className="text-base font-extrabold">{copy.emailUs}</span>
            <span className="font-mono text-xs font-medium text-ayc-on-navy-soft">
              {contactEmail}
            </span>
          </a>
          <Link
            href={paths.products.list}
            className="flex min-h-14 items-center border-[1.5px] border-ayc-navy px-5 text-base font-bold text-ayc-navy no-underline hover:bg-ayc-navy/10 hover:text-ayc-navy"
          >
            {copy.browseReviewers}
          </Link>
        </div>
      </div>
    </section>
  );
}
