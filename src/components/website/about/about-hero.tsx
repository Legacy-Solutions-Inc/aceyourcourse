import Image from "next/image";
import Link from "next/link";

import { ABOUT_SECTION_IDS } from "@/components/website/about/section-ids";
import { aboutCopy } from "@/content/about";
import type { AboutCopy } from "@/lib/catalogue/about-content";
import type { AboutStat } from "@/lib/catalogue/about-stats";
import { formatAsOf } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

const copy = aboutCopy.hero;
const cta =
  "flex min-h-13.5 items-center border-[1.5px] border-ayc-cream text-base no-underline focus-visible:outline-ayc-cream motion-reduce:transition-none";

interface AboutHeroProps {
  /** The intro and the team photo: Staff's, or today's. */
  copy: AboutCopy["header"];
  /** From aboutStats: only the tiles with a figure. */
  stats: AboutStat[];
  /** ISO date the shop's Shopee figures were copied. */
  shopFiguresAsOf: string;
}

/**
 * The About hero: the brand line, "Read our story" and "See the reviewers",
 * the team photo with its IPOPHIL sticker, and the stat tiles. The shop's
 * Shopee figures are dated once, under the tiles, while any of them shows.
 * The labels and the brand line (shared with the footer) stay in code.
 */
export function AboutHero({ copy: { intro, teamPhoto }, stats, shopFiguresAsOf }: AboutHeroProps) {
  const showsShopFigures = stats.some((stat) => stat.id === "rating" || stat.id === "followers");

  return (
    <section className="bg-ayc-navy text-ayc-cream">
      <div className="mx-auto flex max-w-324 flex-wrap items-center gap-[clamp(36px,5vw,72px)] px-[clamp(20px,5vw,72px)] py-[clamp(48px,6vw,96px)]">
        <div className="flex min-w-0 flex-[1.2_1_380px] flex-col gap-5.5">
          <p className="flex items-center gap-2.5 self-start rounded-full border-[1.5px] border-ayc-cream/50 px-3 py-2.25 font-mono text-xs leading-none font-bold tracking-[0.08em] uppercase">
            <span aria-hidden="true" className="size-2 rounded-full bg-ayc-orange" />
            {copy.pill}
          </p>
          <h1 className="text-[clamp(46px,6.8vw,96px)] leading-[0.94] font-extrabold tracking-[-0.045em] text-balance">
            {copy.headingLead} <span className="text-ayc-orange">{copy.headingHighlight}</span>
          </h1>
          <p className="max-w-[32em] text-[clamp(17px,1.5vw,20px)] leading-normal text-pretty text-ayc-on-navy-soft">
            {intro}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`#${ABOUT_SECTION_IDS.story}`}
              className={cn(
                cta,
                "gap-2 bg-ayc-orange px-5.5 font-extrabold text-ayc-navy shadow-hard-md shadow-ayc-cream transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-ayc-navy hover:shadow-[7px_7px_0_var(--ayc-cream)]",
              )}
            >
              {copy.readOurStory} <span aria-hidden="true">↓</span>
            </Link>
            <Link
              href={paths.products.list}
              className={cn(
                cta,
                "px-5 font-bold text-ayc-cream transition-colors hover:bg-ayc-cream/12 hover:text-ayc-cream",
              )}
            >
              {copy.seeTheReviewers}
            </Link>
          </div>
        </div>

        <div className="relative min-w-0 flex-[1_1_340px] pr-3.5 pb-3.5">
          <div
            aria-hidden="true"
            className="absolute inset-[14px_0_0_14px] border-[1.5px] border-ayc-cream bg-ayc-orange"
          />
          <div className="relative aspect-4/3 overflow-hidden border-[1.5px] border-ayc-cream bg-ayc-navy-rule">
            <Image
              src={teamPhoto.src}
              alt={teamPhoto.alt}
              fill
              priority
              sizes="(min-width: 81rem) 560px, (min-width: 47.5rem) 45vw, 100vw"
              className="object-cover object-[center_30%]"
            />
          </div>
          <p className="absolute bottom-8.5 -left-2.5 -rotate-4 border-[1.5px] border-ayc-navy bg-ayc-cream px-3 py-2 font-mono text-xs font-bold tracking-[0.04em] text-ayc-navy uppercase shadow-hard-sm">
            {copy.ipophil}
          </p>
        </div>
      </div>

      {stats.length > 0 ? (
        // Clips the right border each row's last tile pushes past the edge.
        <div className="overflow-hidden border-t-[1.5px] border-ayc-cream/30">
          <ul
            aria-label={copy.statsLabel}
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]"
          >
            {stats.map((stat) => (
              <li
                key={stat.id}
                className="-mr-[1.5px] flex flex-col gap-1.5 border-r-[1.5px] border-ayc-cream/30 px-[clamp(20px,3vw,40px)] py-[clamp(20px,2.6vw,32px)]"
              >
                <span
                  className={cn(
                    "text-[clamp(40px,4.6vw,60px)] leading-none font-black tracking-[-0.04em]",
                    stat.id === "rating" && "text-ayc-orange",
                  )}
                >
                  {stat.value}
                  {stat.id === "rating" ? <span aria-hidden="true">★</span> : null}
                </span>{" "}
                <span className="font-mono text-xs font-medium tracking-[0.06em] text-ayc-on-navy-muted uppercase">
                  {stat.label}
                </span>
              </li>
            ))}
          </ul>
          {showsShopFigures ? (
            <p className="border-t-[1.5px] border-ayc-cream/30 px-[clamp(20px,3vw,40px)] py-3 font-mono text-xs text-ayc-on-navy-muted">
              {copy.figuresNote} {formatAsOf(shopFiguresAsOf)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
