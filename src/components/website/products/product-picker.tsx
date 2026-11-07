"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ProductImage } from "@/components/website/product-image";
import { PRODUCTS_SECTION_IDS } from "@/components/website/products/section-ids";
import { productsPageCopy } from "@/content/products-page";
import { productFormatLabel } from "@/lib/catalogue/format";
import { recommendProduct, STUDY_STYLES, type StudyStyle } from "@/lib/catalogue/picker";
import { productPriceLabel } from "@/lib/catalogue/price";
import { productsHref } from "@/lib/catalogue/product-filters";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Product } from "@/services/catalogue.types";

const copy = productsPageCopy.picker;

const eyebrow = "font-mono text-xs font-bold tracking-[0.08em] uppercase";
const answerButton =
  "cursor-pointer border-[1.5px] border-ayc-navy bg-ayc-cream transition-[background-color,box-shadow] hover:bg-ayc-sand aria-pressed:bg-ayc-navy aria-pressed:text-ayc-cream aria-pressed:shadow-hard-sm aria-pressed:shadow-ayc-orange motion-reduce:transition-none";

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface ProductPickerProps {
  /** Live Products in best-seller order. */
  products: Product[];
  /** The Exams with Live Products, the first question's answers. */
  examCodes: string[];
  memberAppLive: boolean;
}

/**
 * "Help me choose": two questions (the board, then how the Visitor likes to
 * study) and one recommended Product with the reason. "See all" filters the
 * grid by that Exam and scrolls to it. Picking an answer again clears it.
 * The App style is offered only while the Member App switch is on.
 */
export function ProductPicker({ products, examCodes, memberAppLive }: ProductPickerProps) {
  const router = useRouter();
  const ids = useId();
  const [exam, setExam] = useState<string | null>(null);
  const [style, setStyle] = useState<StudyStyle | null>(null);

  const styles = STUDY_STYLES.filter((s) => s !== "app" || memberAppLive);
  const answered = exam !== null && style !== null;
  const match = answered ? recommendProduct(products, exam, style, { memberAppLive }) : null;
  // "App" can fall back to a printed-only Product, which isn't "in the app".
  const resultLabel = !answered
    ? copy.yourMatch
    : style === "app" && match?.product.availableInApp
      ? copy.app.startInTheApp
      : copy.startWithThis;

  const seeAll = (examCode: string) => {
    router.replace(productsHref({ exam: examCode }), { scroll: false });
    document.getElementById(PRODUCTS_SECTION_IDS.grid)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <section
      id={PRODUCTS_SECTION_IDS.picker}
      aria-labelledby={`${ids}-heading`}
      className="mx-auto max-w-324 scroll-mt-24 px-[clamp(20px,5vw,72px)] pt-[clamp(56px,7vw,96px)] pb-[clamp(32px,4vw,48px)]"
    >
      <div className="flex flex-wrap border-[1.5px] border-ayc-navy bg-ayc-paper shadow-hard-lg">
        <div className="-mr-[1.5px] flex min-w-0 flex-[1.3_1_420px] flex-col gap-5.5 border-r-[1.5px] border-ayc-navy p-[clamp(22px,3vw,40px)]">
          <div className="flex flex-col gap-2.5">
            <p className={cn(eyebrow, "text-ayc-blue")}>{copy.eyebrow}</p>
            <h2
              id={`${ids}-heading`}
              className="text-[clamp(30px,3.6vw,48px)] leading-none font-extrabold tracking-[-0.035em]"
            >
              {copy.heading}
            </h2>
          </div>

          <div role="group" aria-labelledby={`${ids}-exam`} className="flex flex-col gap-2.5">
            <p id={`${ids}-exam`} className="text-base font-bold">
              {copy.examQuestion}
            </p>
            <div className="flex flex-wrap gap-2">
              {examCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={exam === code}
                  onClick={() => setExam(exam === code ? null : code)}
                  className={cn(
                    answerButton,
                    "min-h-11 min-w-14 px-3.5 font-mono text-sm font-bold",
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby={`${ids}-style`} className="flex flex-col gap-2.5">
            <p id={`${ids}-style`} className="text-base font-bold">
              {copy.styleQuestion}
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-2">
              {styles.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={style === s}
                  onClick={() => setStyle(style === s ? null : s)}
                  className={cn(
                    answerButton,
                    "group flex min-h-16 flex-col gap-0.75 px-3.5 py-3 text-left",
                  )}
                >
                  <span className="text-[15px] font-bold">{copy.styles[s].label}</span>
                  <span className="text-[13px] text-ayc-slate group-aria-pressed:text-ayc-on-navy-soft">
                    {copy.styles[s].description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          role="status"
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 bg-ayc-sand p-[clamp(22px,3vw,40px)]"
        >
          <p className={cn(eyebrow, "text-[11px] text-ayc-slate")}>{resultLabel}</p>
          {!answered ? (
            <p className="text-[17px] leading-normal text-ayc-slate">{copy.prompt}</p>
          ) : match ? (
            <>
              <Link
                href={paths.products.details(match.product.slug)}
                className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-4 text-ayc-navy no-underline hover:text-ayc-navy"
              >
                <span className="relative size-27.5 overflow-hidden border-[1.5px] border-ayc-navy bg-ayc-cream">
                  <ProductImage photo={match.product.photos[0] ?? null} alt="" sizes="110px" />
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-mono text-[10px] leading-none font-bold tracking-[0.04em] text-ayc-blue uppercase">
                    {match.product.examCode} · {productFormatLabel(match.product.format)}
                  </span>
                  <span className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
                    {match.product.shortName}
                  </span>
                  <span className="text-lg font-extrabold">{productPriceLabel(match.product)}</span>
                </span>
              </Link>
              <p className="text-[15px] leading-normal text-pretty text-ayc-slate">
                {match.reason}
              </p>
              <div className="mt-auto flex flex-wrap gap-2.5">
                <Link
                  href={paths.products.details(match.product.slug)}
                  className="flex min-h-12 items-center gap-1.5 border-[1.5px] border-ayc-navy bg-ayc-navy px-4.5 text-[15px] font-bold text-ayc-cream no-underline hover:bg-ayc-blue hover:text-ayc-cream"
                >
                  {copy.viewReviewer}
                  <span aria-hidden="true">→</span>
                </Link>
                <button
                  type="button"
                  onClick={() => seeAll(match.product.examCode)}
                  className="flex min-h-12 cursor-pointer items-center border-[1.5px] border-ayc-navy px-4 text-[15px] font-bold hover:bg-ayc-paper"
                >
                  {copy.seeAll(match.product.examCode)}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[17px] leading-normal text-ayc-slate">{copy.noneYet(exam)}</p>
          )}
        </div>
      </div>
    </section>
  );
}
