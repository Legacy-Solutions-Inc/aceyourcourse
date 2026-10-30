import Link from "next/link";

import { ProductImage } from "@/components/website/product-image";
import { RatingStar } from "@/components/website/rating-star";
import { StoreButton } from "@/components/website/store-button";
import { MARKETPLACES, websiteCopy } from "@/content/website";
import { formatCount, formatRating } from "@/lib/catalogue/figures";
import { productFormatLabel } from "@/lib/catalogue/format";
import { productPriceLabel } from "@/lib/catalogue/price";
import { storeLinksFor } from "@/lib/catalogue/store-links";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Product, WebsiteSettings } from "@/services/catalogue.types";

interface ProductCardProps {
  product: Product;
  memberAppLive: boolean;
  /** When given, a row of store buttons shows under the card. */
  shopLinks?: WebsiteSettings["shopLinks"];
  /** A label in the photo's corner, e.g. "#1 in CE" on an Exam's top seller. */
  highlight?: string;
  className?: string;
}

const badge = "font-mono text-[10px] leading-none font-bold tracking-[0.04em] uppercase";

/**
 * A Product in a grid. The whole card links to the Product page. A Coming Soon
 * Product shows its badge and the placeholder, with no price, figures or buy
 * buttons.
 */
export function ProductCard({
  product,
  memberAppLive,
  shopLinks,
  highlight,
  className,
}: ProductCardProps) {
  const live = product.state === "live";
  const price = productPriceLabel(product);
  const storeButtons = shopLinks ? storeLinksFor(product, shopLinks) : [];

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col border-[1.5px] border-ayc-navy bg-ayc-paper text-ayc-navy shadow-[7px_7px_0_-1.5px_var(--ayc-sand),7px_7px_0_0_var(--ayc-navy)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[10px_10px_0_-1.5px_var(--ayc-sand),10px_10px_0_0_var(--ayc-navy)] motion-reduce:transition-none",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden border-b-[1.5px] border-ayc-navy bg-ayc-sand">
        <ProductImage
          photo={live ? (product.photos[0] ?? null) : null}
          alt=""
          sizes="(min-width: 47.5rem) 30vw, 100vw"
        />
        <span
          className={cn(
            badge,
            "absolute top-3 left-3 bg-ayc-blue px-2.25 py-1.75 text-[13px] text-ayc-cream",
          )}
        >
          {product.examCode}
        </span>
        {live && product.deal ? (
          <span
            className={cn(
              badge,
              "absolute top-3 right-3 bg-ayc-orange px-1.75 py-1.5 text-ayc-navy",
            )}
          >
            {websiteCopy.product.cardDeal}
          </span>
        ) : null}
        {live ? null : (
          <span
            className={cn(
              badge,
              "absolute top-3 right-3 border-[1.5px] border-ayc-navy bg-ayc-paper px-1.75 py-1.5",
            )}
          >
            {websiteCopy.product.comingSoon}
          </span>
        )}
        {highlight ? (
          <span
            className={cn(
              badge,
              "absolute right-0 bottom-0 border-t-[1.5px] border-l-[1.5px] border-ayc-navy bg-ayc-orange px-2.5 py-2 text-[11px] whitespace-nowrap text-ayc-navy",
            )}
          >
            {highlight}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-4">
        <p className="font-mono text-[11px] leading-snug font-medium tracking-[0.06em] text-ayc-slate uppercase">
          {productFormatLabel(product.format)} · {product.size}
        </p>
        <h3 className="text-[19px] leading-tight font-bold tracking-[-0.01em] text-balance">
          <Link
            href={paths.products.details(product.slug)}
            className="text-ayc-navy no-underline after:absolute after:inset-0 hover:text-ayc-navy"
          >
            {product.shortName}
          </Link>
        </h3>
        <p className="font-mono text-[11px] leading-snug font-medium text-ayc-blue">
          {product.subjectCodes.join(" · ")}
        </p>
        {live ? (
          <p className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] leading-tight font-medium tracking-[0.03em] text-ayc-slate uppercase">
            {memberAppLive && product.availableInApp ? (
              <span className={cn(badge, "bg-ayc-blue px-1.5 py-1.25 text-ayc-cream")}>
                {websiteCopy.product.app.cardBadge}
              </span>
            ) : null}
            {MARKETPLACES.map((m) => m.name).join(" · ")}
          </p>
        ) : null}
        {price ? (
          <div className="mt-auto flex items-baseline justify-between gap-2.5 border-t border-dashed border-ayc-rule pt-2.5">
            <p className="text-xl font-extrabold tracking-[-0.01em]">{price}</p>
            {product.shopee ? (
              <p className="font-mono text-xs whitespace-nowrap text-ayc-slate">
                <RatingStar /> {formatRating(product.shopee.rating)} ·{" "}
                {formatCount(product.shopee.unitsSold)} sold
              </p>
            ) : null}
          </div>
        ) : null}
        {storeButtons.length > 0 ? (
          <div className="relative z-10 mt-1 grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-2">
            {storeButtons.map(({ marketplace, storeLink }) => (
              <StoreButton
                key={marketplace}
                marketplace={marketplace}
                storeLink={storeLink}
                productSlug={product.slug}
                size="compact"
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
