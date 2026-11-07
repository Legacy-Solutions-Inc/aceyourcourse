import Link from "next/link";

import { MarketplaceLink } from "@/components/website/marketplace-link";
import { ProductCard } from "@/components/website/product-card";
import { PRODUCTS_SECTION_IDS } from "@/components/website/products/section-ids";
import { productsPageCopy } from "@/content/products-page";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { Product, WebsiteSettings } from "@/services/catalogue.types";

const copy = productsPageCopy;

interface ProductsGridProps {
  /** The Live Products that match the filters, in the chosen sort. */
  products: Product[];
  /** Every Live Product, the "M" in "N of M reviewers". */
  total: number;
  memberAppLive: boolean;
  shopLinks: WebsiteSettings["shopLinks"];
  /** The filter bar, between the heading and the grid. */
  filterBar: React.ReactNode;
}

/**
 * "All reviewers": the count, the filter bar and a ProductCard per matching
 * Live Product with its store buttons. With no match, the empty state offers
 * Clear filters and the Shopee shop (when there's a link to it).
 */
export function ProductsGrid({
  products,
  total,
  memberAppLive,
  shopLinks,
  filterBar,
}: ProductsGridProps) {
  return (
    <section
      id={PRODUCTS_SECTION_IDS.grid}
      aria-labelledby="all-heading"
      className="mx-auto flex max-w-324 scroll-mt-24 flex-col gap-5 px-[clamp(20px,5vw,72px)] pt-[clamp(32px,4vw,48px)] pb-[clamp(64px,8vw,112px)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h2
          id="all-heading"
          className="text-[clamp(36px,4.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]"
        >
          {copy.all.heading}
        </h2>
        <p role="status" className="font-mono text-[13px] font-bold tracking-[0.04em] uppercase">
          {copy.all.count(products.length, total)}
        </p>
      </div>

      {filterBar}

      {products.length > 0 ? (
        <ul
          aria-labelledby="all-heading"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-x-6.5 gap-y-8 pt-2"
        >
          {products.map((product) => (
            <li key={product.id} className="flex">
              <ProductCard
                product={product}
                memberAppLive={memberAppLive}
                shopLinks={shopLinks}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState shopeeShop={shopLinks.shopee} />
      )}
    </section>
  );
}

const button = "flex min-h-11.5 items-center gap-1.5 px-4.5 text-[15px] font-bold no-underline";

function EmptyState({ shopeeShop }: { shopeeShop: string | null }) {
  return (
    <div className="flex flex-col items-start gap-3.5 border-[1.5px] border-dashed border-ayc-navy bg-ayc-paper p-8">
      <p className="text-2xl font-extrabold tracking-[-0.02em]">{copy.empty.heading}</p>
      <p className="text-base text-ayc-slate">
        {copy.empty.hint}
        {shopeeShop ? ` ${copy.empty.shopeeHint}` : null}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href={paths.products.list}
          replace
          scroll={false}
          className={cn(
            button,
            "bg-ayc-navy text-ayc-cream hover:bg-ayc-blue hover:text-ayc-cream",
          )}
        >
          {copy.empty.clearFilters}
        </Link>
        {shopeeShop ? (
          <MarketplaceLink
            href={shopeeShop}
            marketplace="shopee"
            link="shop"
            className={cn(
              button,
              "border-[1.5px] border-ayc-navy text-ayc-navy hover:bg-ayc-sand hover:text-ayc-navy",
            )}
          >
            {copy.empty.browseShopee}
            <span aria-hidden="true">↗</span>
          </MarketplaceLink>
        ) : null}
      </div>
    </div>
  );
}
