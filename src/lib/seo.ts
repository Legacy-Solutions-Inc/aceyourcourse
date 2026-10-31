import type { MetadataRoute } from "next";

import { paths } from "@/paths";

/**
 * The Website's fixed pages, listed in the sitemap ahead of the Exam and
 * Product pages. The signed-in areas are never listed.
 */
export const STATIC_ROUTES = [
  paths.home,
  paths.products.list,
  paths.reviews,
  paths.faq,
  paths.about,
  paths.legal.privacy,
  paths.legal.terms,
] as const;

/**
 * The routes robots keeps crawlers out of: each signed-in area, its root
 * matched exactly ("$" ends the pattern, RFC 9309) so /apple-icon stays
 * crawlable, and the analytics proxy.
 */
const DISALLOWED = ["/app$", "/app/", "/admin$", "/admin/", "/auth$", "/auth/", "/relay/"];

/** What the sitemap lists beyond the static pages: what the Website shows. */
interface SitemapCatalogue {
  /** Every Exam on the Website: listExams(). */
  examCodes: readonly string[];
  /** Every Product on the Website, Live and Coming Soon. */
  productSlugs: readonly string[];
}

type SitemapRank = Pick<MetadataRoute.Sitemap[number], "changeFrequency" | "priority">;

// Home first, then the catalogue pages (they change as Products do), then the rest.
const HOME: SitemapRank = { changeFrequency: "weekly", priority: 1 };
const CATALOGUE: SitemapRank = { changeFrequency: "weekly", priority: 0.8 };
const OTHER: SitemapRank = { changeFrequency: "monthly", priority: 0.5 };

/**
 * Pure: build sitemap entries as absolute URLs against `baseUrl`. `lastModified`
 * is passed in (not read from the clock) so the builder stays deterministic and
 * testable. `new URL(route, baseUrl)` joins cleanly regardless of trailing slash.
 */
export function buildSitemap(
  baseUrl: string,
  lastModified: Date,
  { examCodes, productSlugs }: SitemapCatalogue,
): MetadataRoute.Sitemap {
  const entry = (route: string, rank: SitemapRank) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified,
    ...rank,
  });
  return [
    ...STATIC_ROUTES.map((route) =>
      entry(route, route === paths.home ? HOME : route === paths.products.list ? CATALOGUE : OTHER),
    ),
    ...examCodes.map((code) => entry(paths.exams.details(code), CATALOGUE)),
    ...productSlugs.map((slug) => entry(paths.products.details(slug), CATALOGUE)),
  ];
}

/** Pure: allow crawling the Website, keep the signed-in areas out, and link the sitemap. */
export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED },
    sitemap: new URL("sitemap.xml", baseUrl).toString(),
    host: new URL(baseUrl).origin,
  };
}
