import { MARKETPLACES } from "@/content/website";
import type { Marketplace, Product, WebsiteSettings } from "@/services/catalogue.types";

export interface StoreLink {
  href: string;
  /** The Product's own Listing, or the Marketplace's shop page. */
  link: "listing" | "shop";
}

type ShopLinks = WebsiteSettings["shopLinks"];

/**
 * Pure: where a store button for this Marketplace goes. The Product's own
 * Listing first, then the Marketplace's shop page, otherwise null (hide the
 * button). A Coming Soon Product is not for sale, so it never gets a buy link.
 * Pass null for a shop-wide button that isn't about one Product.
 */
export function resolveStoreLink(
  product: Pick<Product, "state" | "listings"> | null,
  marketplace: Marketplace,
  shopLinks: ShopLinks,
): StoreLink | null {
  if (product?.state === "coming-soon") return null;
  const listing = product?.listings[marketplace];
  if (listing) return { href: listing, link: "listing" };
  const shop = shopLinks[marketplace];
  return shop ? { href: shop, link: "shop" } : null;
}

/** Pure: a store link per Marketplace that has somewhere to go, in display order. */
export function storeLinksFor(
  product: Pick<Product, "state" | "listings">,
  shopLinks: ShopLinks,
): { marketplace: Marketplace; storeLink: StoreLink }[] {
  return MARKETPLACES.flatMap(({ id }) => {
    const storeLink = resolveStoreLink(product, id, shopLinks);
    return storeLink ? [{ marketplace: id, storeLink }] : [];
  });
}

/** Pure: the "Follow on Shopee" link (the shop page) a Coming Soon Product offers instead. */
export function followLink(shopLinks: ShopLinks): StoreLink | null {
  return shopLinks.shopee ? { href: shopLinks.shopee, link: "shop" } : null;
}
