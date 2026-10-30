import { MARKETPLACES } from "@/content/website";
import { isMarketplaceUrl } from "@/lib/catalogue/store-links";
import { manilaDayStart } from "@/lib/manila-time";
import { paths } from "@/paths";
import type { Marketplace, PromoBanner } from "@/services/catalogue.types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure: whether the Home promo strip shows at `now`. It runs over whole
 * Asia/Manila days, from 00:00 Manila on its start date until 23:59:59 Manila
 * on its end date, so it turns itself on and off with no redeploy. Off while
 * the banner is turned off or missing, and when its dates are not ISO dates or
 * end before they start.
 */
export function isPromoActive(banner: PromoBanner | null, now: Date): boolean {
  if (!banner?.visible) return false;
  let start: Date;
  let end: Date;
  try {
    start = manilaDayStart(banner.startDate);
    end = manilaDayStart(banner.endDate);
  } catch {
    return false;
  }
  // Manila has no daylight saving, so every day is 24 hours long. Dates that
  // end before they start leave no time in between.
  const time = now.getTime();
  return time >= start.getTime() && time < end.getTime() + DAY_MS;
}

/** Where the promo button goes, which decides how it links. */
export type PromoLink =
  | { kind: "internal" }
  | { kind: "member-app" }
  | { kind: "marketplace"; marketplace: Marketplace }
  | { kind: "external" };

const MEMBER_APP = paths.memberApp.home;

/**
 * Pure: a Website path stays on the Website; a Member App path does too, but
 * only links while the Member App is live. A Marketplace link (its host or a
 * subdomain) opens in a new tab and records a `marketplace_click`; any other
 * link just opens in a new tab.
 */
export function promoLink(href: string): PromoLink {
  if (href === MEMBER_APP || href.startsWith(`${MEMBER_APP}/`)) return { kind: "member-app" };
  if (href.startsWith("/") && !href.startsWith("//")) return { kind: "internal" };
  const marketplace = MARKETPLACES.find(({ id }) => isMarketplaceUrl(href, id))?.id;
  return marketplace ? { kind: "marketplace", marketplace } : { kind: "external" };
}
