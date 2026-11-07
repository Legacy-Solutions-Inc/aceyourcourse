import type { StudyStyle } from "@/lib/catalogue/picker";
import type { ProductSort } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed Products page copy (docs/mockup/website/Products_v2.dc.html), typed so
// a missing string is a type error. Counts, Exam codes and prices are
// catalogue data, read through the Catalogue seam. Copy that mentions the
// Member App is kept separate, so it renders only while the switch is on.
// ─────────────────────────────────────────────────────────────────────────────

export const productsPageCopy = {
  metaTitle: "All reviewers · flash cards, notebooks & posters",
  metaDescription:
    "Every Ace Your Course board exam reviewer: formula flash cards, posters, notebooks and bundles made by board passers. Filter by exam, format and price, then buy from our official Shopee, Lazada or TikTok Shop stores.",
  hero: {
    pill: (examCount: number) =>
      `All reviewers · ${examCount} board exam${examCount === 1 ? "" : "s"}`,
    heading: "Find the reviewer that fits how you study.",
    /** Followed by the Exam codes, as a list. */
    subLineLead: "Flash cards, posters, notebooks, and bundles for",
    shipped: "Shipped nationwide.",
    helpMeChoose: "Help me choose",
    browseAll: "Browse all",
    tickerLabel: "About our reviewers",
    /** The ticker also lists the Exam codes. */
    ticker: ["IPOPHIL registered", "Ships from Iloilo City", "Made by board passers"],
    /**
     * Shown only while the Member App switch is on: "Most" when more than half
     * of the Live Products are in the app, "Some" when at least one is, and
     * nothing when none are.
     */
    appSentence: (inApp: number, live: number) =>
      inApp === 0
        ? null
        : inApp * 2 > live
          ? "Most are also in the app."
          : "Some are also in the app.",
  },
  picker: {
    eyebrow: "Help me choose · 2 questions",
    heading: "Not sure where to start?",
    examQuestion: "1. Which board are you taking?",
    styleQuestion: "2. How do you like to study?",
    yourMatch: "Your match",
    startWithThis: "Start with this",
    prompt: "Answer both questions and we’ll suggest one reviewer to start with.",
    viewReviewer: "View reviewer",
    seeAll: (examCode: string) => `See all ${examCode} reviewers`,
    noneYet: (examCode: string) => `No ${examCode} reviewers are out yet.`,
    /** The reason when the Product isn't in the style's first-choice format. */
    closestFit: (examCode: string, shortName: string) =>
      `For ${examCode}, the ${shortName} is the closest fit.`,
    styles: {
      "on-the-go": {
        label: "On the go",
        description: "Quick recall, anywhere",
        reason:
          "Flash cards fit in a bag or pocket, so you can drill formulas between classes or on the commute.",
      },
      "on-my-wall": {
        label: "On my wall",
        description: "See it while solving",
        reason:
          "Posters keep every formula in view while you solve. Where there are no posters for your board, flash cards are the closest fit.",
      },
      solving: {
        label: "Solving problems",
        description: "Write and practice",
        reason:
          "The notebook gives you space to solve board problems and keep your own notes next to the concepts.",
      },
      everything: {
        label: "Everything",
        description: "One complete set",
        reason:
          "The bundle covers every format in one order and costs less than buying each separately.",
      },
      // Offered only while the Member App switch is on.
      app: {
        label: "App",
        description: "Digital lessons and reviewers",
        reason:
          "The app has digital flash cards, quizzes, reviewer PDFs, and video lessons for this exam, with a countdown to your exam date.",
      },
    } satisfies Record<StudyStyle, { label: string; description: string; reason: string }>,
    // Shown only while the Member App switch is on.
    app: {
      startInTheApp: "Start in the app",
      /** Follows the closest-fit reason when that Product is in the app. */
      alsoInApp: "It’s also in the app.",
    },
  },
  all: {
    heading: "All reviewers",
    count: (shown: number, total: number) => `${shown} of ${total} reviewers`,
    searchLabel: "Search reviewers",
    searchPlaceholder: "Search by exam, subject, or format",
    sortLabel: "Sort",
    sorts: {
      "best-selling": "Best selling",
      "price-asc": "Price: low to high",
      "price-desc": "Price: high to low",
      "top-rated": "Top rated",
    } satisfies Record<ProductSort, string>,
    examLabel: "Exam",
    formatLabel: "Format",
    /** What a chip's count is of, for screen readers. */
    reviewerNoun: { one: "reviewer", other: "reviewers" },
    allChip: "All",
    maxPriceLabel: "Max price",
    anyPrice: "Any",
    clearFilters: "Clear filters",
    // Shown only while the Member App switch is on.
    alsoInApp: "Also in app",
  },
  empty: {
    heading: "No reviewers match those filters.",
    hint: "Try a higher max price or a different exam.",
    /** Shown only when there's a Shopee shop link. */
    shopeeHint: "Reviewers for PhLE, LET and other boards are on Shopee already.",
    clearFilters: "Clear filters",
    browseShopee: "Browse Shopee",
  },
  comingSoon: {
    heading: "Coming soon",
    intro: "Announced but not out yet, so there’s no price until they launch.",
  },
  // The whole section shows only while the Member App switch is on.
  physicalOrApp: {
    eyebrow: "Physical or app?",
    heading: "Same content. Two ways to study it.",
    intro: "Many reviewees get both: physical cards for the desk, the app for the commute.",
    physical: {
      title: "Physical",
      tag: "Shopee · Lazada · TikTok Shop",
      points: [
        "Cards, posters, and notebooks you can hold, mark up, and pin to a wall",
        "Every format, including posters, notebooks, and bundles",
        "Pay once, keep it. Ships nationwide",
      ],
    },
    app: {
      title: "In the app",
      tag: "Paid plan · no auto-renew",
      points: [
        "Flash cards that track which ones you still need to review",
        "Scored quizzes, PDF reviewers, and video lessons",
        "A countdown to your exam date, on your phone",
      ],
      cta: "See app plans",
    },
  },
};
