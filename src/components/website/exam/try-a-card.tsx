import Link from "next/link";
import { useId } from "react";

import { FormulaCard } from "@/components/website/exam/formula-card";
import { examPageCopy, type SampleCard } from "@/content/exam-pages";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

const copy = examPageCopy.tryCard;
const link =
  "flex min-h-13 items-center gap-1.5 border-[1.5px] px-5 text-[15px] font-bold no-underline focus-visible:outline-ayc-cream";

interface TryACardProps {
  examCode: string;
  cards: SampleCard[];
  /** The top Live seller, for "Get the printed set". Null hides the link. */
  printedSetSlug: string | null;
  /** "See {code} app plans": only while the Member App is live and a Product is in it. */
  showAppPlans: boolean;
}

/** "Try a {code} card": the Exam's sample formula cards. Hidden when it has none. */
export function TryACard({ examCode, cards, printedSetSlug, showAppPlans }: TryACardProps) {
  const headingId = useId();
  if (cards.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-x-clip border-b-[1.5px] border-ayc-navy bg-ayc-blue text-ayc-cream"
    >
      <div className="mx-auto flex max-w-324 flex-wrap items-center gap-[clamp(40px,6vw,88px)] px-[clamp(20px,5vw,72px)] py-[clamp(56px,7vw,104px)]">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4.5">
          <p className="font-mono text-xs font-bold tracking-[0.08em] uppercase">
            {copy.eyebrow(examCode)}
          </p>
          <h2
            id={headingId}
            className="text-[clamp(34px,4.2vw,56px)] leading-none font-extrabold tracking-[-0.035em] text-balance"
          >
            {copy.heading}
          </h2>
          <p className="max-w-[30em] text-[17px] leading-relaxed text-ayc-on-navy-soft">
            {copy.intro}
            {showAppPlans ? ` ${copy.appIntro}` : null}
          </p>
          {showAppPlans || printedSetSlug ? (
            <div className="mt-1.5 flex flex-wrap gap-2.5">
              {showAppPlans ? (
                <Link
                  href={paths.memberApp.plans}
                  className={cn(
                    link,
                    "border-ayc-navy bg-ayc-cream text-ayc-navy shadow-hard hover:text-ayc-navy",
                  )}
                >
                  {copy.seeAppPlans(examCode)} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
              {printedSetSlug ? (
                <Link
                  href={paths.products.details(printedSetSlug)}
                  className={cn(
                    link,
                    "border-ayc-cream text-ayc-cream hover:bg-ayc-cream/10 hover:text-ayc-cream",
                  )}
                >
                  {copy.getPrintedSet}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mx-auto w-full max-w-115 min-w-0 flex-[1_1_320px]">
          <FormulaCard examCode={examCode} cards={cards} />
        </div>
      </div>
    </section>
  );
}
