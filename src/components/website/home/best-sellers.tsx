import Link from "next/link";
import { useId } from "react";

import { BestSellersCarousel } from "@/components/website/home/best-sellers-carousel";
import { ProductImage } from "@/components/website/product-image";
import { RatingStar } from "@/components/website/rating-star";
import { homeCopy } from "@/content/home";
import { figuresAsOf, soldBarPercent } from "@/lib/catalogue/best-sellers";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { productFormatLabel } from "@/lib/catalogue/format";
import { productPriceLabel } from "@/lib/catalogue/price";
import { formatAsOf } from "@/lib/manila-time";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Product } from "@/services/catalogue.types";

const copy = homeCopy.bestSellers;

/**
 * "Best sellers": Live Products with Shopee figures, ranked by units sold (as
 * listBestSellers returns them), in a carousel that snaps to each card. Each
 * card's sold bar is its units sold relative to #1. Renders nothing without
 * best sellers.
 */
export function BestSellers({ products }: { products: Product[] }) {
  const headingId = useId();
  const sellers = products.filter((product) => product.state === "live" && product.shopee);
  const top = sellers[0];
  if (!top) return null;
  const asOf = figuresAsOf(sellers);

  return (
    <section aria-labelledby={headingId} className="bg-ayc-navy text-ayc-cream">
      <div className="mx-auto flex max-w-324 flex-col px-[clamp(20px,5vw,72px)] py-[clamp(64px,8vw,112px)]">
        <BestSellersCarousel
          headingId={headingId}
          intro={
            <div className="flex flex-col gap-3">
              <p className="flex flex-wrap gap-x-2.5 font-mono text-xs font-bold tracking-[0.08em] uppercase">
                <span className="text-ayc-orange">{copy.eyebrow}</span>
                {asOf ? <span className="text-ayc-on-navy-soft">{formatAsOf(asOf)}</span> : null}
              </p>
              <h2
                id={headingId}
                className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
              >
                {copy.heading}
              </h2>
            </div>
          }
        >
          {sellers.map((product, index) => (
            <BestSellerCard
              key={product.id}
              product={product}
              rank={index + 1}
              soldPercent={soldBarPercent(product, top)}
            />
          ))}
        </BestSellersCarousel>
      </div>
    </section>
  );
}

interface BestSellerCardProps {
  product: Product;
  rank: number;
  soldPercent: number;
}

function BestSellerCard({ product, rank, soldPercent }: BestSellerCardProps) {
  const figures = product.shopee;
  return (
    <li className="flex flex-[0_0_clamp(250px,28vw,320px)] snap-start">
      <article className="relative flex w-full flex-col border-[1.5px] border-ayc-cream bg-ayc-cream text-ayc-navy transition-[transform,box-shadow] duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--ayc-orange)] motion-reduce:transition-none">
        <div className="relative aspect-square overflow-hidden border-b-[1.5px] border-ayc-navy bg-ayc-sand">
          <ProductImage photo={product.photos[0] ?? null} alt="" sizes="320px" />
          <span
            className={cn(
              "absolute top-0 left-0 border-r-[1.5px] border-b-[1.5px] border-ayc-navy px-3.25 py-2.5 font-mono text-[22px] leading-none font-bold",
              rank === 1 ? "bg-ayc-orange" : "bg-ayc-cream",
            )}
          >
            {copy.rank(rank)}
          </span>
          <span className="absolute right-2.5 bottom-2.5 bg-ayc-navy px-1.75 py-1.25 font-mono text-[10px] leading-none font-bold tracking-[0.04em] text-ayc-cream uppercase">
            {product.examCode} · {productFormatLabel(product.format)}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 px-4.5 pt-4 pb-4.5">
          <h3 className="text-[19px] leading-tight font-extrabold tracking-[-0.01em]">
            <Link
              href={paths.products.details(product.slug)}
              className="text-ayc-navy no-underline after:absolute after:inset-0 hover:text-ayc-navy"
            >
              {product.shortName}
            </Link>
          </h3>
          <div className="flex items-baseline justify-between gap-2.5">
            {figures ? (
              <p className="font-mono text-xs text-ayc-slate">
                <RatingStar /> {formatRating(figures.rating)} · {formatCount(figures.ratingCount)}
                <span className="sr-only"> ratings</span>
              </p>
            ) : null}
            <p className="text-base font-extrabold">{productPriceLabel(product)}</p>
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <span aria-hidden="true" className="relative block h-1.5 bg-ayc-rule">
              <span
                data-sold-bar
                className="absolute inset-y-0 left-0 bg-ayc-blue"
                style={{ width: `${soldPercent}%` }}
              />
            </span>
            {figures ? (
              <p className="font-mono text-xs font-bold">
                {copy.sold(formatCount(figures.unitsSold))}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
