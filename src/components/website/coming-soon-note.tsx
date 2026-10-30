import { StoreButton } from "@/components/website/store-button";
import { websiteCopy } from "@/content/website";
import { followLink } from "@/lib/catalogue/store-links";
import type { WebsiteSettings } from "@/services/catalogue.types";

/**
 * Shown in place of the price and buy box on a Coming Soon Product: it isn't
 * for sale, so the only link is "Follow on Shopee" to the shop page, when
 * there is one.
 */
export function ComingSoonNote({
  productSlug,
  shopLinks,
}: {
  productSlug: string;
  shopLinks: WebsiteSettings["shopLinks"];
}) {
  const follow = followLink(shopLinks);
  return (
    <div className="flex flex-col items-start gap-4 border-[1.5px] border-dashed border-ayc-slate p-4">
      <p className="text-[15px] leading-snug">{websiteCopy.product.comingSoonNote}</p>
      {follow ? (
        <StoreButton
          marketplace="shopee"
          action="follow"
          storeLink={follow}
          productSlug={productSlug}
        />
      ) : null}
    </div>
  );
}
