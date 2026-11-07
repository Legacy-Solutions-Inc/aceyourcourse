import Link from "next/link";
import { useId } from "react";

import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { ProductImage } from "@/components/website/product-image";
import { formatCards, homeCopy } from "@/content/home";
import { formatCardStats } from "@/lib/catalogue/format-cards";
import { productsHref } from "@/lib/catalogue/product-filters";
import { formatPeso } from "@/lib/money";
import { paths } from "@/paths";
import type { Exam, Product } from "@/services/catalogue.types";

const copy = homeCopy.formats;

interface FormatsProps {
  /** The Live Products in best-selling order, as listProducts returns them. */
  products: Product[];
  exams: Pick<Exam, "code">[];
  memberAppLive: boolean;
}

/**
 * "Which format fits how you study?" `#formats`: a card per format with Live
 * Products, its "For" Exams, "From" price and the bundle's saving computed
 * from them, linking to the Products page filtered by that format. The app
 * band shows only while the Member App switch is on. Renders nothing with no
 * Live Products.
 */
export function Formats({ products, exams, memberAppLive }: FormatsProps) {
  const headingId = useId();
  const stats = formatCardStats(products, exams);
  const cards = formatCards.flatMap((card) => {
    const figures = stats[card.format];
    return figures ? [{ ...card, ...figures }] : [];
  });
  if (cards.length === 0) return null;

  return (
    <section
      id={HOME_SECTION_IDS.formats}
      aria-labelledby={headingId}
      className="mx-auto flex max-w-324 scroll-mt-24 flex-col gap-[clamp(28px,3.5vw,48px)] px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,120px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-[0.08em] text-ayc-blue uppercase">
            {copy.eyebrow}
          </p>
          <h2
            id={headingId}
            className="max-w-[16ch] text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
          >
            {copy.heading}
          </h2>
        </div>
        <p className="max-w-[26em] text-[17px] leading-normal text-ayc-slate">{copy.intro}</p>
      </div>

      <ul
        aria-labelledby={headingId}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-5.5"
      >
        {cards.map((card) => (
          <li
            key={card.format}
            className="relative flex flex-col border-[1.5px] border-ayc-navy bg-ayc-paper shadow-hard transition-[transform,box-shadow] duration-200 hover:-translate-x-0.75 hover:-translate-y-0.75 hover:shadow-[8px_8px_0_var(--ayc-blue)] motion-reduce:transition-none"
          >
            <div className="relative aspect-4/3 overflow-hidden border-b-[1.5px] border-ayc-navy bg-ayc-sand">
              <ProductImage
                photo={card.coverPhoto}
                alt=""
                sizes="(min-width: 81rem) 300px, (min-width: 47.5rem) 45vw, 100vw"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="shrink-0 text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
                  <Link
                    href={productsHref({ format: card.format })}
                    className="text-ayc-navy no-underline after:absolute after:inset-0 hover:text-ayc-navy"
                  >
                    {card.title}
                  </Link>
                </h3>
                <p className="text-right font-mono text-[11px] font-medium text-ayc-blue">
                  {card.size}
                </p>
              </div>
              <p className="text-[15px] leading-normal text-pretty text-ayc-slate">
                {card.saving !== null && card.bodyWithSaving
                  ? card.bodyWithSaving(formatPeso(card.saving))
                  : card.body}
              </p>
              <div className="mt-auto flex items-end justify-between gap-2 border-t border-dashed border-ayc-rule pt-3">
                <p className="font-mono text-[11px] font-medium text-ayc-slate uppercase">
                  {copy.forExams(card.examCodes)}
                </p>
                <p className="flex flex-col items-end">
                  <span className="font-mono text-[10px] font-medium text-ayc-slate uppercase">
                    {copy.from}
                  </span>
                  <span className="text-xl font-extrabold">{formatPeso(card.priceFrom)}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {memberAppLive ? (
        <Link
          href={paths.memberApp.plans}
          className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3.5 border-[1.5px] border-ayc-navy bg-ayc-blue px-[clamp(20px,2.8vw,32px)] py-[clamp(18px,2.4vw,26px)] text-ayc-cream no-underline transition-colors hover:bg-ayc-blue-dark hover:text-ayc-cream motion-reduce:transition-none"
        >
          <span className="flex flex-col gap-1.5">
            {/* Cream, not the mockup's orange: orange on blue is under 3:1. */}
            <span className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase">
              {copy.app.eyebrow}
            </span>
            <span className="text-[clamp(20px,2.2vw,26px)] font-extrabold tracking-[-0.02em]">
              {copy.app.text}
            </span>
          </span>
          <span className="text-base font-bold whitespace-nowrap">
            {copy.app.cta} <span aria-hidden="true">→</span>
          </span>
        </Link>
      ) : null}
    </section>
  );
}
