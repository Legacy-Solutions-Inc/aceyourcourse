import type { MetadataRoute } from "next";

/**
 * Public, indexable routes listed in the sitemap. The signed-in areas are
 * intentionally excluded.
 */
export const SITEMAP_ROUTES = ["/"] as const;

/**
 * Pure: build sitemap entries as absolute URLs against `baseUrl`. `lastModified`
 * is passed in (not read from the clock) so the builder stays deterministic and
 * testable. `new URL(route, baseUrl)` joins cleanly regardless of trailing slash.
 */
export function buildSitemap(baseUrl: string, lastModified: Date): MetadataRoute.Sitemap {
  return SITEMAP_ROUTES.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.5,
  }));
}

/** Pure: allow crawling the Website; link the sitemap. */
export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: new URL("sitemap.xml", baseUrl).toString(),
    host: new URL(baseUrl).origin,
  };
}
