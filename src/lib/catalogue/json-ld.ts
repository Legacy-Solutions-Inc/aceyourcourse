import { config } from "@/config";
import { productSeoDescription } from "@/lib/catalogue/product-copy";
import { paths } from "@/paths";
import type { Exam, Product, WebsiteSettings } from "@/services/catalogue.types";

// JSON-LD builders. Reviews and Shopee ratings are copied from the Marketplaces,
// so they are NEVER emitted as Review or AggregateRating markup (Google's
// self-serving and third-party review rules; see the spec's Phase 1 SEO). Only
// a Product's own Listings become Offers; shop-page fallbacks never do.

type JsonLdObject = Record<string, unknown>;

const absolute = (path: string, siteUrl: string) => new URL(path, siteUrl).toString();
const pesos = (centavos: number) => centavos / 100;

/** Product markup with Offers at its Listings. Null for Coming Soon. */
export function productJsonLd(product: Product, exam: Exam, siteUrl: string): JsonLdObject | null {
  if (product.state !== "live" || product.priceFrom === null) return null;

  const listingUrls = Object.values(product.listings).filter((url): url is string => !!url);
  const jsonLd: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: productSeoDescription(product, exam),
    url: absolute(paths.products.details(product.slug), siteUrl),
    image: product.photos.map((photo) => absolute(photo.src, siteUrl)),
    brand: { "@type": "Brand", name: config.site.name },
  };
  if (listingUrls.length === 0) return jsonLd;

  const priceFrom = product.priceFrom;
  jsonLd.offers =
    product.priceTo !== null && product.priceTo !== priceFrom
      ? {
          "@type": "AggregateOffer",
          lowPrice: pesos(priceFrom),
          highPrice: pesos(product.priceTo),
          priceCurrency: "PHP",
          offerCount: listingUrls.length,
          offers: listingUrls.map((url) => ({ "@type": "Offer", url })),
        }
      : listingUrls.map((url) => ({
          "@type": "Offer",
          url,
          price: pesos(priceFrom),
          priceCurrency: "PHP",
        }));
  return jsonLd;
}

export function breadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; path: string }>,
  siteUrl: string,
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(item.path, siteUrl),
    })),
  };
}

/**
 * AYC itself, on every Website page: its logo, contact email, and in sameAs the
 * Marketplace shops and socials it links to. A hidden (null) link is left out,
 * and with none, so is sameAs.
 */
export function organizationJsonLd(
  settings: Pick<WebsiteSettings, "shopLinks" | "socialLinks" | "contactEmail">,
  siteUrl: string,
): JsonLdObject {
  const sameAs = [
    ...Object.values(settings.shopLinks),
    ...Object.values(settings.socialLinks),
  ].filter((url): url is string => !!url);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.site.name,
    url: absolute(paths.home, siteUrl),
    logo: absolute(paths.icon, siteUrl),
    email: settings.contactEmail,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/**
 * Pure: JSON for a `<script type="application/ld+json">`, with every "<"
 * escaped so no value (a title containing "</script>") can end the script.
 */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
