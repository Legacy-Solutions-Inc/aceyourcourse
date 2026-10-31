// Copied Marketplace Reviews and Shopee ratings are shown on the Website but
// never emitted as structured data (Google's self-serving and third-party
// review rules; the spec's Phase 1 SEO). Product titles say "Review" ("CE
// Review Bundle 3-in-1"), so this checks JSON-LD keys and @type values, not
// text. Shared by the unit tests and the e2e suite.

const RATING_KEYS = new Set([
  "aggregaterating",
  "review",
  "reviews",
  "reviewrating",
  "ratingvalue",
  "ratingcount",
  "reviewcount",
]);
const RATING_TYPES = new Set(["review", "aggregaterating", "rating"]);

/** Every place `value` carries rating or review markup, as a path like "$.offers[0].review". */
export function ratingMarkup(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => ratingMarkup(item, `${path}[${index}]`));
  }
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const at = `${path}.${key}`;
    const ratingType =
      key === "@type" &&
      [child]
        .flat()
        .some((type) => typeof type === "string" && RATING_TYPES.has(type.toLowerCase()));
    const found = RATING_KEYS.has(key.toLowerCase()) || ratingType ? [at] : [];
    return [...found, ...ratingMarkup(child, at)];
  });
}
