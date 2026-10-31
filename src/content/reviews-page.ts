import type { ReviewWallSort, StarBucket } from "@/lib/catalogue/review-filters";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed Reviews page copy (docs/mockup/website/Reviews_v2.dc.html), typed so a
// missing string is a type error. The Reviews, shop figures and contact email
// are catalogue data, read through the Catalogue seam. The page never mentions
// the Member App.
// ─────────────────────────────────────────────────────────────────────────────

export const reviewsPageCopy = {
  metaTitle: "Reviews from board passers",
  metaDescription:
    "Every written review of Ace Your Course board exam reviewers, by verified buyers on our Shopee shop and copied word for word, including the critical ones. Filter by exam, stars or reviewer.",
  hero: {
    pill: "Reviews · from Shopee buyers",
    headingLead: "What reviewees",
    headingHighlight: "say after",
    headingTail: "using them.",
    subLine:
      "Every review here was written by a verified buyer on our Shopee shop, copied word for word, including the critical ones.",
    shopRating: "shop rating on Shopee",
    ratings: "ratings",
    followers: "followers",
    /** Followed by "as of {month year}". */
    figuresNote: "Shopee figures",
  },
  ratings: {
    heading: "Ratings by reviewer",
    hint: "Click a row to read its reviews",
    /** Read before a row's rating, as the bar is visual only. */
    rated: "rated",
    ratingCount: (count: string) => `${count} ratings`,
    /** Followed by "as of {month year}". */
    figuresNote: "Product ratings on Shopee",
  },
  wall: {
    heading: "The review wall",
    count: (shown: number, total: number) => `${shown} of ${total} written reviews`,
    searchLabel: "Search reviews",
    searchPlaceholder: "font size, delivery, paper…",
    sortLabel: "Sort",
    sorts: {
      "most-helpful": "Most helpful",
      highest: "Highest rated",
      "most-critical": "Most critical",
      "most-detailed": "Most detailed",
    } satisfies Record<ReviewWallSort, string>,
    examLabel: "Exam",
    starsLabel: "Stars",
    allChip: "All",
    starChips: {
      "5": { label: "5★", spoken: "5 stars" },
      "4": { label: "4★", spoken: "4 stars" },
      "3-or-less": { label: "≤3★", spoken: "3 stars or fewer" },
    } satisfies Record<StarBucket, { label: string; spoken: string }>,
    /** What a chip's count is of, for screen readers. */
    reviewNoun: { one: "review", other: "reviews" },
    /** Follows the Product chip's name in its accessible name. */
    removeFilter: ", remove this filter",
    clearFilters: "Clear filters",
  },
  empty: {
    heading: "No reviews match those filters.",
    hint: "Newer reviewers like the MedTech flash cards have ratings on Shopee but no written reviews yet.",
    clearFilters: "Clear filters",
  },
  passedWithOurCards: {
    heading: "Passed with our cards?",
    body: "Send us a message! We would like to feature you and your story.",
    emailUs: "Email us",
    emailSubject: "My board exam story",
    browseReviewers: "Browse reviewers",
  },
};
