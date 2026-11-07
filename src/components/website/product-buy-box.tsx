import { StoreButton } from "@/components/website/store-button";
import { SelectedPrice } from "@/components/website/variation-picker";
import { websiteCopy } from "@/content/website";
import { productPriceRange } from "@/lib/catalogue/price";
import { storeLinksFor } from "@/lib/catalogue/store-links";
import type { Product, WebsiteSettings } from "@/services/catalogue.types";

interface ProductBuyBoxProps {
  product: Product;
  shopLinks: WebsiteSettings["shopLinks"];
  contactEmail: string;
}

/**
 * Where to buy a Live Product's printed copy: a store button per Marketplace
 * that has somewhere to go, or a contact note when none does. The price follows
 * the picked variation inside a VariationProvider. Coming Soon Products aren't
 * for sale, so they get no buy box.
 */
export function ProductBuyBox({ product, shopLinks, contactEmail }: ProductBuyBoxProps) {
  const price = productPriceRange(product);
  if (!price) return null;
  const storeButtons = storeLinksFor(product, shopLinks);

  return (
    <div className="border-[1.5px] border-ayc-navy bg-ayc-paper">
      <p
        data-testid="buy-box-header"
        className="flex flex-wrap justify-between gap-x-2.5 gap-y-1.5 border-b-[1.5px] border-ayc-navy px-4 py-3 font-mono text-xs font-bold tracking-[0.06em] uppercase"
      >
        <span>
          Printed copy · <SelectedPrice fallback={price} />
        </span>
        <span className="font-medium text-ayc-slate">
          Ships from {websiteCopy.product.shipsFrom}
        </span>
      </p>
      {storeButtons.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2.5 px-4 pt-3.5 pb-4">
          {storeButtons.map(({ marketplace, storeLink }) => (
            <StoreButton
              key={marketplace}
              marketplace={marketplace}
              storeLink={storeLink}
              productSlug={product.slug}
            />
          ))}
        </div>
      ) : (
        <p className="p-4 text-[15px]">
          {websiteCopy.product.storeLinksSoon}{" "}
          <a href={`mailto:${contactEmail}`} className="font-bold">
            {contactEmail}
          </a>
        </p>
      )}
    </div>
  );
}
