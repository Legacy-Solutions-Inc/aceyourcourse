import type { Marketplace } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed Website copy that isn't catalogue data, typed so a missing string is a
// type error. Copy is from the mockup (docs/mockup/website/). Anything that
// promises the Member App is kept separate, so it renders only while the
// Member App switch is on. Later tickets add to this file.
// ─────────────────────────────────────────────────────────────────────────────

/** Marketplaces in display order, with their full and short names. */
export const MARKETPLACES: ReadonlyArray<{ id: Marketplace; name: string; shortName: string }> = [
  { id: "shopee", name: "Shopee", shortName: "Shopee" },
  { id: "lazada", name: "Lazada", shortName: "Lazada" },
  { id: "tiktok", name: "TikTok Shop", shortName: "TikTok" },
];

/**
 * The Marketplaces that have a shop link, in display order, each with its
 * link. A Marketplace with no shop link is left out, so no empty link renders.
 */
export function marketplaceShops(shopLinks: Record<Marketplace, string | null>) {
  return MARKETPLACES.flatMap((marketplace) => {
    const href = shopLinks[marketplace.id];
    return href ? [{ ...marketplace, href }] : [];
  });
}

export const websiteCopy = {
  // The brand as the mockup writes it in running copy. Titles and alt text use
  // config.site.name ("Ace Your Course").
  wordmark: "AceYourCourse",
  home: {
    eyebrow: "Licensure exam reviewers · Made by passers",
    headlineLead: "Remember every formula on",
    headlineHighlight: "board day.",
    subheadline:
      "Flash cards, notebooks, and posters for board exam review in various courses. Shipped nationwide.",
  },
  nav: {
    examsMenuLabel: "Pick your board exam",
    browseAll: "Browse all reviewers",
    printedCopies: "Printed copies",
    signIn: "Sign in",
    startReviewing: "Start reviewing",
  },
  footer: {
    headlineLead: "Built by board passers. Designed for",
    headlineHighlight: "dreamers.",
    whereToBuyLabel: "Where to buy",
    whereToBuy: "Physical copies from our official stores, shipped nationwide.",
    whereToBuyApp: "Digital reviewers in the app.",
    spotAFake: "Spot a fake copy",
    signInToApp: "Sign in to the app",
    ipophil: "Registered with IPOPHIL. Unauthorized reproduction is prohibited.",
    shipping: "Ships all over the Philippines",
  },
  // The Product page (docs/mockup/website/Product.dc.html).
  product: {
    shipsFrom: "Iloilo City",
    deal: "Shopee: any 2 enjoy 4% off",
    cardDeal: "Any 2 · 4% off",
    comingSoon: "Coming soon",
    reviewUse: "For the board exam, school, and professional review.",
    boardExamReviewees: "Board exam reviewees",
    authentic:
      "AceYourCourse reviewers are registered with IPOPHIL and protected by copyright law. Unauthorized reproduction, distribution, or use is prohibited.",
    oneOption: "One option: the complete set.",
    pickOnStore: "Sold per subject or as a full set. Pick your option on the store page:",
    noReviewsTitle: "No written reviews yet",
    noReviews:
      "This one is new. Buyers have left star ratings but no comments so far. Bought it? Leave a review on the store you ordered from.",
    storeLinksSoon: "Store links coming soon. Questions?",
    followOnShopee: "Follow on Shopee",
    comingSoonNote: "Not out yet. Follow our Shopee shop to hear when it launches.",
    // Shown only while the Member App switch is on.
    app: {
      bandTitle: "Also available in the app",
      band: "The same content one card at a time, plus scored quizzes and reviewers.",
      seePlans: "See plans →",
      printedOnly: "Printed only · not available in the app",
      cardBadge: "In app",
    },
  },
  // The summary for AI assistants at /llms.txt (ticket 22). It never mentions
  // the Member App.
  llmsTxt: {
    /** After the site name; followed by where AYC sells and ships from. */
    whoWeAre:
      "makes formula flash cards, notebooks and posters for Philippine licensure board exams, made by board passers.",
  },
} as const;
