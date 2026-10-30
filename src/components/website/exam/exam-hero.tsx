import Link from "next/link";

import { ExamSwitcher } from "@/components/website/exam/exam-switcher";
import { EXAM_SECTION_IDS } from "@/components/website/exam/section-ids";
import { Marquee } from "@/components/website/marquee";
import { ProductImage } from "@/components/website/product-image";
import { examPageCopy } from "@/content/exam-pages";
import type { ExamStats } from "@/lib/catalogue/exam-stats";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { formatAsOf } from "@/lib/manila-time";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Exam, Product } from "@/services/catalogue.types";

const copy = examPageCopy.hero;
const container = "mx-auto max-w-324 px-[clamp(20px,5vw,72px)]";
const heroLink =
  "flex min-h-14 items-center gap-1.5 border-[1.5px] border-ayc-cream no-underline focus-visible:outline-ayc-cream";

/** Where each of the top 3 photos sits in the stack, the top seller first and in front (L255). */
const STACK = [
  "z-30 inset-[10%_14%_14%_10%] -rotate-2",
  "z-20 inset-[18%_6%_6%_22%] rotate-4",
  "z-10 inset-[4%_24%_24%_4%] -rotate-6",
];

/** The ticker repeats the Subjects until it has at least this many items (L264). */
const TICKER_MIN = 8;

interface ExamHeroProps {
  exam: Exam;
  /** Every Exam on the Website, for the switcher. */
  exams: Exam[];
  stats: ExamStats;
  /** The Exam's Live Products, best selling first. The top 3 make the photo stack. */
  liveProducts: Product[];
  /** "Review {code} in the app": only while the Member App is live and a Product is in it. */
  showAppLink: boolean;
}

/**
 * The Exam page hero: the breadcrumb and Exam switcher, the Exam's code,
 * board, names and blurb, its stats, a stack of its top sellers' photos and a
 * ticker of its Subjects.
 */
export function ExamHero({ exam, exams, stats, liveProducts, showAppLink }: ExamHeroProps) {
  const statTiles = [
    { term: copy.stats.productCount, detail: String(stats.productCount) },
    { term: copy.stats.unitsSold, detail: formatCount(stats.unitsSold) },
    {
      term: copy.stats.averageRating,
      detail:
        stats.averageRating === null ? copy.stats.noRatings : formatRating(stats.averageRating),
    },
    ...(stats.priceFrom === null
      ? []
      : [{ term: copy.stats.priceFrom, detail: formatPeso(stats.priceFrom) }]),
  ];
  const topSellers = liveProducts.slice(0, STACK.length);
  // The oldest copy date, so no figure is claimed fresher than it is.
  const [asOf] = liveProducts
    .flatMap((product) => (product.shopee ? [product.shopee.asOf] : []))
    .sort();
  const subjects = exam.subjects.map((subject) => `${subject.code} · ${subject.name}`);
  const repeats = subjects.length === 0 ? 0 : Math.ceil(TICKER_MIN / subjects.length);
  const ticker = Array.from({ length: repeats }, () => subjects).flat();

  return (
    <section className="relative overflow-hidden bg-ayc-navy text-ayc-cream">
      <div className={cn(container, "flex flex-wrap items-center justify-between gap-3 pt-5")}>
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap gap-2 font-mono text-xs font-medium tracking-[0.04em] text-ayc-on-navy-muted uppercase">
            <li className="flex gap-2">
              <Link
                href={`${paths.home}#exams`}
                className="text-ayc-on-navy-muted no-underline hover:text-ayc-cream focus-visible:outline-ayc-cream"
              >
                {examPageCopy.breadcrumbExams}
              </Link>
              <span aria-hidden="true">/</span>
            </li>
            <li>
              <span aria-current="page" className="text-ayc-cream">
                {exam.name}
              </span>
            </li>
          </ol>
        </nav>
        <ExamSwitcher exams={exams} current={exam.code} />
      </div>

      <div
        className={cn(
          container,
          "flex flex-wrap items-center gap-[clamp(40px,6vw,88px)] pt-[clamp(36px,5vw,72px)] pb-[clamp(56px,6vw,96px)]",
        )}
      >
        <div className="flex min-w-0 flex-[1.2_1_400px] flex-col gap-6">
          <p className="flex items-end gap-4">
            <span className="border-[1.5px] border-ayc-cream bg-ayc-orange px-4.5 pt-4 pb-3 font-mono text-[clamp(52px,7vw,96px)] leading-[0.82] font-bold tracking-[-0.02em] text-ayc-navy shadow-[6px_6px_0_var(--ayc-blue)]">
              {exam.code}
            </span>
            <span className="pb-1.5 font-mono text-xs leading-[1.4] font-bold tracking-[0.06em] text-ayc-on-navy-soft uppercase">
              {exam.board}
              <br />
              <span className="font-normal">{exam.longName}</span>
            </span>
          </p>
          <h1 className="text-[clamp(44px,6.4vw,92px)] leading-[0.94] font-extrabold tracking-[-0.045em] text-balance">
            {exam.name}
          </h1>
          <p className="max-w-[32em] text-[clamp(17px,1.5vw,20px)] leading-normal text-pretty text-ayc-on-navy-soft">
            {exam.blurb}
          </p>
          {stats.productCount > 0 || showAppLink ? (
            <div className="flex flex-wrap items-center gap-3">
              {stats.productCount > 0 ? (
                <a
                  href={`#${EXAM_SECTION_IDS.products}`}
                  className={cn(
                    heroLink,
                    "bg-ayc-orange px-6 text-[17px] font-extrabold text-ayc-navy shadow-hard-md shadow-ayc-cream transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-ayc-navy motion-reduce:transition-none",
                  )}
                >
                  {copy.seeProducts(stats.productCount)} <span aria-hidden="true">↓</span>
                </a>
              ) : null}
              {showAppLink ? (
                <Link
                  href={paths.memberApp.home}
                  className={cn(
                    heroLink,
                    "px-5.5 text-base font-bold text-ayc-cream hover:bg-ayc-cream/10 hover:text-ayc-cream",
                  )}
                >
                  {copy.reviewInApp(exam.code)}
                </Link>
              ) : null}
            </div>
          ) : null}
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] border-t-[1.5px] border-ayc-cream/30">
            {statTiles.map((tile) => (
              <div key={tile.term} className="pt-3.5 pr-3">
                <dt className="font-mono text-[11px] font-medium tracking-[0.06em] text-ayc-on-navy-muted uppercase">
                  {tile.term}
                </dt>
                <dd className="mt-1.5 text-[clamp(22px,2.4vw,30px)] font-extrabold tracking-[-0.02em]">
                  {tile.detail}
                </dd>
              </div>
            ))}
          </dl>
          {asOf ? (
            <p className="-mt-3 font-mono text-[11px] text-ayc-on-navy-muted">
              {copy.stats.figuresNote(formatAsOf(asOf))}
            </p>
          ) : null}
        </div>

        {topSellers.length > 0 ? (
          <div className="relative mx-auto aspect-square max-w-110 min-w-0 flex-[1_1_300px]">
            <span
              aria-hidden="true"
              className="absolute inset-[8%_4%_4%_8%] rotate-6 border-[1.5px] border-ayc-cream bg-ayc-blue"
            />
            <span
              aria-hidden="true"
              className="absolute inset-[6%_8%_6%_4%] -rotate-4 border-[1.5px] border-ayc-navy bg-ayc-orange"
            />
            <ul aria-label={copy.stackLabel}>
              {topSellers.map((product, index) => (
                <li key={product.id}>
                  <Link
                    href={paths.products.details(product.slug)}
                    className={cn(
                      "absolute overflow-hidden border-[1.5px] border-ayc-cream bg-ayc-sand shadow-panel transition-transform hover:scale-102 hover:rotate-0 focus-visible:outline-ayc-cream motion-reduce:transition-none",
                      STACK[index],
                    )}
                  >
                    <ProductImage
                      photo={product.photos[0] ?? null}
                      alt={product.shortName}
                      sizes="(min-width: 47.5rem) 30vw, 70vw"
                      priority={index === 0}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {ticker.length > 0 ? (
        <Marquee
          label={copy.tickerLabel(exam.code)}
          className="border-t-[1.5px] border-ayc-navy bg-ayc-orange text-ayc-navy"
          rowClassName="gap-6.5 pr-6.5 py-3.25 font-mono text-[13px] font-bold tracking-[0.05em] whitespace-nowrap uppercase"
        >
          {ticker.map((item, index) => (
            // Repeats fill the row; screen readers hear each Subject once.
            <span
              key={`${item}-${index}`}
              aria-hidden={index >= subjects.length ? true : undefined}
              className="flex items-center gap-6.5"
            >
              <span>{item}</span>
              <span aria-hidden="true">✦</span>
            </span>
          ))}
        </Marquee>
      ) : null}
    </section>
  );
}
