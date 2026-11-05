import type { Metadata } from "next";

import { config } from "@/config";
import { aboutCopy } from "@/content/about";
import { faqPageCopy } from "@/content/faq-page";
import { homeCopy } from "@/content/home";
import { productsPageCopy } from "@/content/products-page";
import { reviewsPageCopy } from "@/content/reviews-page";
import { paths } from "@/paths";
import { getSitePage } from "@/services/catalogue";
import { sitePageDefaults } from "@/services/catalogue.schema";
import type { SitePage, SitePageKey } from "@/services/catalogue.types";

// The Site pages' search title, description and share image (ticket 20; spec,
// Phase 2 → Site pages). Staff's saved values override today's text in
// src/content, which stays the default: blank uses it, and the Admin shows it
// as each field's placeholder. Canonical addresses never change.

/** Each Site page's address and today's title and description, kept in code. */
export const SITE_PAGE_DEFAULTS: Record<
  SitePageKey,
  { path: string; title: string; description: string }
> = {
  home: { path: paths.home, title: homeCopy.metaTitle, description: homeCopy.metaDescription },
  about: { path: paths.about, title: aboutCopy.metaTitle, description: aboutCopy.metaDescription },
  products: {
    path: paths.products.list,
    title: productsPageCopy.metaTitle,
    description: productsPageCopy.metaDescription,
  },
  faq: { path: paths.faq, title: faqPageCopy.metaTitle, description: faqPageCopy.metaDescription },
  reviews: {
    path: paths.reviews,
    title: reviewsPageCopy.metaTitle,
    description: reviewsPageCopy.metaDescription,
  },
};

/** Pure: PAGE ADDRESS, as the Admin shows it: "aceyourcourse.ph/about", and the root for Home. */
export const sitePageAddress = (page: SitePageKey) =>
  `aceyourcourse.ph${SITE_PAGE_DEFAULTS[page].path}`;

/** Pure: the title and description the page shows: Staff's, or today's text when blank. */
export function sitePageSeo(page: Pick<SitePage, "page" | "seoTitle" | "seoDescription">): {
  title: string;
  description: string;
} {
  const defaults = SITE_PAGE_DEFAULTS[page.page];
  return {
    title: page.seoTitle ?? defaults.title,
    description: page.seoDescription ?? defaults.description,
  };
}

/** The Site page's record, or nothing set when it can't be read: the Website never breaks on it. */
async function readSitePage(page: SitePageKey): Promise<SitePage> {
  try {
    return await getSitePage(page);
  } catch (error) {
    console.error(
      `Couldn't read the ${page} page's search settings; using its text in code:`,
      error,
    );
    return sitePageDefaults(page);
  }
}

/** A Site page's metadata: its title, description, canonical address and share data. */
export async function sitePageMetadata(page: SitePageKey): Promise<Metadata> {
  const record = await readSitePage(page);
  const { title, description } = sitePageSeo(record);
  const url = SITE_PAGE_DEFAULTS[page].path;
  const shareTitle = `${title} · ${config.site.name}`;
  // Setting openGraph here replaces the root's, so the site's share image is
  // repeated when the page has none of its own.
  const images = [
    record.shareImage
      ? { url: record.shareImage, alt: title }
      : { url: paths.shareImage, alt: config.site.name },
  ];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: config.site.name,
      locale: "en_PH",
      title: shareTitle,
      description,
      url,
      images,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}
