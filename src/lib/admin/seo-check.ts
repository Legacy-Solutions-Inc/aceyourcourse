import { config } from "@/config";

// "Search & AI visibility" (spec, Phase 2 → Exam pages & promo; BUILD-MAP
// §3.2, mockup 1047): whether a page's title and description fit what a
// search result shows. The root layout's title template adds the site name,
// so the whole <title> is what's counted. The Exam pages editor shows it per
// page, and the Overview lists the pages that need a look.

/** The longest whole <title> a search result shows. */
export const WHOLE_TITLE_MAX = 60;
/** A description shorter than this gives a search result too little to show. */
export const SEO_DESCRIPTION_MIN = 80;
export const SEO_DESCRIPTION_MAX = 160;

const SUFFIX = ` · ${config.site.name}`;

/** The longest page title that keeps the whole <title> within WHOLE_TITLE_MAX. */
export const SEO_PAGE_TITLE_MAX = WHOLE_TITLE_MAX - SUFFIX.length;

/** Pure: the whole <title> for a page's own title, as the root layout's template makes it. */
export const fullTitle = (title: string) => `${title.trim()}${SUFFIX}`;

export type SeoState = "good" | "check";

/** Pure: "good" when the whole title is at most 60 characters and the description 80–160. */
export function seoCheck({ title, description }: { title: string; description: string }): SeoState {
  const length = description.trim().length;
  return fullTitle(title).length <= WHOLE_TITLE_MAX &&
    length >= SEO_DESCRIPTION_MIN &&
    length <= SEO_DESCRIPTION_MAX
    ? "good"
    : "check";
}
