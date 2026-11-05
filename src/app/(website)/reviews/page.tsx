import type { Metadata } from "next";

import { PassedWithOurCards } from "@/components/website/reviews/passed-with-our-cards";
import { RatingsTable } from "@/components/website/reviews/ratings-table";
import { ReviewWall } from "@/components/website/reviews/review-wall";
import { ReviewWallFilters } from "@/components/website/reviews/review-wall-filters";
import { reviewsPageCopy } from "@/content/reviews-page";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { reviewFacetCounts } from "@/lib/catalogue/review-filters";
import { parseReviewSearchParams } from "@/lib/catalogue/review-search-params";
import { formatAsOf } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import { sitePageMetadata } from "@/lib/catalogue/site-page-seo";
import { getWebsiteSettings, listExams, listProducts, listReviews } from "@/services/catalogue";

interface ReviewsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = reviewsPageCopy;
const container = "mx-auto max-w-324 px-[clamp(20px,5vw,72px)]";

// Every filtered view is one page to search engines: /reviews. The Reviews are
// shown but never emitted as Review or AggregateRating structured data.
// The title, description and share image Staff set in Pages & promo, or
// today's text (src/content) and the site's image.
export async function generateMetadata(): Promise<Metadata> {
  return sitePageMetadata("reviews");
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  // Live Products only, best selling first: Coming Soon Products have no
  // Reviews and no ratings row.
  const [exams, settings, { items: live }, { items: written }] = await Promise.all([
    listExams(),
    getWebsiteSettings(),
    listProducts(),
    listReviews(),
  ]);
  const examCodes = exams
    .map((exam) => exam.code)
    .filter((code) => live.some((product) => product.examCode === code));
  const filters = parseReviewSearchParams(await searchParams, {
    productSlugs: live.map((product) => product.slug),
    examCodes,
  });
  // The wall, and what each chip group would show with its own filter
  // cleared, for the chip counts.
  const [{ items: shown }, { items: forExams }, { items: forStars }] = await Promise.all([
    listReviews(filters),
    listReviews({ ...filters, examCode: undefined }),
    listReviews({ ...filters, stars: undefined }),
  ]);
  const product = live.find((p) => p.slug === filters.productSlug);
  const { shopStats } = settings;

  return (
    <>
      <section className="bg-ayc-navy text-ayc-cream">
        <div
          className={cn(
            container,
            "flex flex-wrap items-end gap-[clamp(32px,5vw,72px)] py-[clamp(48px,6vw,96px)]",
          )}
        >
          <div className="flex min-w-0 flex-[1.3_1_420px] flex-col gap-5.5">
            <p className="flex items-center gap-2.5 self-start rounded-full border-[1.5px] border-ayc-cream/50 px-3 py-2.25 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase">
              <span aria-hidden="true" className="size-2 rounded-full bg-ayc-orange" />
              {copy.hero.pill}
            </p>
            <h1 className="max-w-[12ch] text-[clamp(46px,6.8vw,96px)] leading-[0.94] font-extrabold tracking-[-0.045em] text-balance">
              {copy.hero.headingLead}{" "}
              <span className="text-ayc-orange">{copy.hero.headingHighlight}</span>{" "}
              {copy.hero.headingTail}
            </h1>
            <p className="max-w-[32em] text-[clamp(17px,1.5vw,20px)] leading-normal text-ayc-on-navy-soft">
              {copy.hero.subLine}
            </p>
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
            <div className="grid grid-cols-2 border-[1.5px] border-ayc-cream shadow-hard-lg shadow-ayc-orange">
              <p className="col-span-2 flex items-center gap-4.5 border-b-[1.5px] border-ayc-cream px-6 py-5.5">
                <span className="text-[clamp(64px,7vw,96px)] leading-[0.85] font-black tracking-[-0.05em] text-ayc-orange">
                  {formatRating(shopStats.rating)}
                </span>{" "}
                <span className="flex flex-col gap-1.5">
                  <span aria-hidden="true" className="text-[22px] tracking-[3px] text-ayc-orange">
                    ★★★★★
                  </span>
                  <span className="font-mono text-xs font-medium tracking-[0.06em] text-ayc-on-navy-muted uppercase">
                    {copy.hero.shopRating}
                  </span>
                </span>
              </p>
              <p className="flex flex-col gap-1.5 border-r-[1.5px] border-ayc-cream px-6 py-4.5">
                <HeroFigure>{formatCount(shopStats.ratingCount)}</HeroFigure>{" "}
                <HeroLabel>{copy.hero.ratings}</HeroLabel>
              </p>
              <p className="flex flex-col gap-1.5 px-6 py-4.5">
                <HeroFigure>{shopStats.followers}</HeroFigure>{" "}
                <HeroLabel>{copy.hero.followers}</HeroLabel>
              </p>
            </div>
            <p className="font-mono text-xs text-ayc-on-navy-muted">
              {copy.hero.figuresNote} {formatAsOf(shopStats.asOf)}
            </p>
          </div>
        </div>
      </section>

      <RatingsTable products={live} selectedSlug={filters.productSlug} />

      <ReviewWall
        reviews={shown}
        total={written.length}
        filterBar={
          <ReviewWallFilters
            filters={filters}
            examCodes={examCodes}
            counts={reviewFacetCounts({ forExams, forStars })}
            productName={product?.shortName ?? null}
          />
        }
      />

      <PassedWithOurCards contactEmail={settings.contactEmail} />
    </>
  );
}

function HeroFigure({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[clamp(32px,3.4vw,44px)] leading-none font-black tracking-[-0.04em]">
      {children}
    </span>
  );
}

function HeroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-ayc-on-navy-muted uppercase">
      {children}
    </span>
  );
}
