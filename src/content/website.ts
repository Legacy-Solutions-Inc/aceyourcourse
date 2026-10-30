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
    browseCta: "Browse all reviewers",
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
} as const;
