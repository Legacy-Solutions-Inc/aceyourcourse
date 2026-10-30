import { Marquee } from "@/components/website/marquee";
import { homeCopy } from "@/content/home";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import type { ShopStats } from "@/services/catalogue.types";

const copy = homeCopy.ticker;

interface HomeTickerProps {
  shopStats: ShopStats;
  /** Every Exam on the Website, in order. */
  examCodes: string[];
}

/**
 * The orange ticker under the hero: the content items with the shop's rating
 * and number of ratings, and the Exam codes. Under reduced motion the Marquee
 * is a single static row.
 */
export function HomeTicker({ shopStats, examCodes }: HomeTickerProps) {
  const items = copy.items({
    rating: formatRating(shopStats.rating),
    ratingCount: formatCount(shopStats.ratingCount),
    examCodes,
  });
  return (
    <Marquee
      label={copy.label}
      className="border-t-[1.5px] border-ayc-navy bg-ayc-orange text-ayc-navy"
      rowClassName="gap-7 pr-7 py-3.25 font-mono text-[13px] font-bold tracking-[0.06em] whitespace-nowrap"
    >
      {items.map((item) => (
        <span key={item} className="flex items-center gap-7">
          <span>{item}</span>
          <span aria-hidden="true">✦</span>
        </span>
      ))}
    </Marquee>
  );
}
