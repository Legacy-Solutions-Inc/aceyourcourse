import Link from "next/link";

import { HeroVideo } from "@/components/website/home/hero-video";
import { HOME_SECTION_IDS } from "@/components/website/home/section-ids";
import { TryACard } from "@/components/website/home/try-a-card";
import { homeCopy, type TryCard } from "@/content/home";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { formatAsOf } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { ShopStats } from "@/services/catalogue.types";

const copy = homeCopy.hero;
const cta =
  "flex min-h-14 items-center gap-2.5 no-underline focus-visible:outline-ayc-cream motion-reduce:transition-none";

interface HeroProps {
  shopStats: ShopStats;
  cards: TryCard[];
  memberAppLive: boolean;
}

/**
 * The Home hero, over the promo video: the pill, H1 and sub-headline, the
 * CTAs, the trust line with the shop's Shopee figures and their date, and
 * "Try a card". The app clause and "Try the app free" show only while the
 * Member App switch is on.
 */
export function Hero({ shopStats, cards, memberAppLive }: HeroProps) {
  return (
    <section className="overflow-hidden bg-ayc-navy text-ayc-cream">
      <HeroVideo>
        <div className="mx-auto flex min-h-[clamp(600px,58vw,780px)] max-w-324 flex-wrap items-center gap-[clamp(48px,6vw,96px)] px-[clamp(20px,5vw,72px)] pt-[clamp(48px,6vw,96px)] pb-[clamp(56px,6vw,96px)]">
          <div className="flex min-w-0 flex-[1.25_1_420px] flex-col gap-6.5">
            <p className="flex items-center gap-2.5 self-start rounded-full border-[1.5px] border-ayc-cream/50 px-3 py-2.25 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ayc-orange" />
              {copy.eyebrow}
            </p>
            <h1 className="max-w-[13ch] text-[clamp(46px,7.2vw,108px)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance">
              {copy.headlineLead}{" "}
              {/* The marker is an underline, so contrast checks still see cream on navy. */}
              <span className="underline decoration-ayc-orange decoration-[0.3em] underline-offset-[-0.12em] [text-decoration-skip-ink:none]">
                {copy.headlineHighlight}
              </span>
            </h1>
            <p className="max-w-[31em] text-[clamp(17px,1.5vw,21px)] leading-normal text-pretty text-ayc-on-navy-soft">
              {memberAppLive ? copy.subheadlineApp : copy.subheadline}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`#${HOME_SECTION_IDS.exams}`}
                className={cn(
                  cta,
                  "border-[1.5px] border-ayc-cream bg-ayc-orange px-6 text-[17px] font-extrabold text-ayc-navy shadow-hard-md shadow-ayc-cream transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-ayc-navy hover:shadow-[7px_7px_0_var(--ayc-cream)]",
                )}
              >
                {copy.findYourExam} <span aria-hidden="true">↓</span>
              </Link>
              {memberAppLive ? (
                <Link
                  href={paths.memberApp.home}
                  className={cn(
                    cta,
                    "border-[1.5px] border-ayc-cream px-5.5 text-base font-bold text-ayc-cream transition-colors hover:bg-ayc-cream/12 hover:text-ayc-cream",
                  )}
                >
                  {copy.tryTheApp}
                </Link>
              ) : null}
              <Link
                href={`#${HOME_SECTION_IDS.video}`}
                className={cn(
                  cta,
                  "px-1.5 text-[15px] font-bold text-ayc-cream hover:text-ayc-cream",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-8.5 items-center justify-center rounded-full border-[1.5px] border-ayc-cream pl-0.5 text-[11px]"
                >
                  ▶
                </span>
                {copy.watch}
              </Link>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2.5 font-mono text-xs leading-snug font-medium tracking-[0.04em] text-ayc-on-navy-soft uppercase">
              <span className="flex items-center gap-2">
                <span
                  role="img"
                  aria-label={copy.starsLabel}
                  className="text-sm tracking-[1px] text-ayc-orange"
                >
                  ★★★★★
                </span>
                {copy.ratings(formatRating(shopStats.rating), formatCount(shopStats.ratingCount))}
              </span>
              <span aria-hidden="true">·</span>
              <span>{copy.ipophil}</span>
              <span aria-hidden="true">·</span>
              <span>{formatAsOf(shopStats.asOf)}</span>
            </p>
          </div>
          <TryACard cards={cards} />
        </div>
      </HeroVideo>
    </section>
  );
}
