import { MarketplaceLink } from "@/components/website/marketplace-link";
import { MARKETPLACES } from "@/content/website";
import type { StoreLink } from "@/lib/catalogue/store-links";
import { cn } from "@/lib/utils";
import type { Marketplace } from "@/services/catalogue.types";

interface StoreButtonProps {
  marketplace: Marketplace;
  /** From resolveStoreLink; render nothing when that is null. */
  storeLink: StoreLink;
  /** The Product the button is for, recorded with the click. */
  productSlug?: string;
  /** "follow" is a Coming Soon Product's link to the Shopee shop page. */
  action?: "buy" | "follow";
  size?: "default" | "compact";
  className?: string;
}

/**
 * A button out to a Marketplace, in a new tab. Each click records a
 * `marketplace_click`. The selected variation is never passed on: the
 * Marketplace owns the variations and the stock.
 */
export function StoreButton({
  marketplace,
  storeLink,
  productSlug,
  action = "buy",
  size = "default",
  className,
}: StoreButtonProps) {
  const name = MARKETPLACES.find((m) => m.id === marketplace)?.name ?? marketplace;
  const label = action === "follow" ? `Follow on ${name}` : name;
  return (
    <MarketplaceLink
      href={storeLink.href}
      marketplace={marketplace}
      link={storeLink.link}
      product={productSlug}
      aria-label={`${action === "follow" ? "Follow" : "Buy"} on ${name} (opens in a new tab)`}
      className={cn(
        "flex items-center justify-center gap-1.5 border-[1.5px] border-ayc-navy text-ayc-navy no-underline transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none",
        marketplace === "shopee" ? "bg-ayc-orange" : "bg-ayc-paper hover:bg-ayc-cream",
        size === "compact"
          ? "min-h-10 px-2 text-sm font-bold shadow-hard-sm hover:shadow-hard"
          : "min-h-13.5 px-4 text-base font-extrabold shadow-hard hover:shadow-hard-md",
        className,
      )}
    >
      {label}
      <span aria-hidden="true">↗</span>
    </MarketplaceLink>
  );
}
