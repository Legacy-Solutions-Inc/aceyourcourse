"use client";

import { usePathname } from "next/navigation";

import { ExternalLink } from "@/components/website/external-link";
import { type MarketplaceClick, trackMarketplaceClick } from "@/lib/analytics/events";

type MarketplaceLinkProps = Omit<
  React.ComponentProps<typeof ExternalLink>,
  keyof MarketplaceClick
> &
  Omit<MarketplaceClick, "page">;

/**
 * A link out to a Marketplace, in a new tab, that records a `marketplace_click`
 * from the current page (a no-op while analytics is unconfigured).
 */
export function MarketplaceLink({
  marketplace,
  link,
  product,
  onClick,
  ...props
}: MarketplaceLinkProps) {
  const pathname = usePathname() ?? "";

  return (
    <ExternalLink
      {...props}
      onClick={(event) => {
        trackMarketplaceClick({ product, marketplace, page: pathname, link });
        onClick?.(event);
      }}
    />
  );
}
