import posthog from "posthog-js";

import type { Marketplace } from "@/services/catalogue.types";

// Website analytics events. The Website captures pageviews (automatic, via the
// `defaults` option in src/instrumentation-client.ts) and `marketplace_click`,
// both cookieless and anonymous (docs/adr/0009). Every helper is a no-op until
// PostHog has loaded, so it is safe to call when analytics is unconfigured.

export interface MarketplaceClick {
  /** The Product's slug, for a Product's own Listing. Omitted for a shop link. */
  product?: string;
  marketplace: Marketplace;
  /** The pathname the click came from. */
  page: string;
  /** A Product's Marketplace Listing, or the Marketplace's shop page. */
  link: "listing" | "shop";
}

/** Record a click through to a Marketplace. */
export function trackMarketplaceClick({
  product,
  marketplace,
  page,
  link,
}: MarketplaceClick): void {
  if (posthog.__loaded !== true) return;
  posthog.capture("marketplace_click", {
    ...(product ? { product } : {}),
    marketplace,
    page,
    link,
  });
}
