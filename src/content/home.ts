import { websiteCopy } from "@/content/website";
import { paths } from "@/paths";
import type { ProductFormat } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed Home copy (docs/mockup/website/Home_v2.dc.html), typed so a missing
// string is a type error: the hero, the "Try a card" sample cards, the ticker,
// the four steps, the format cards, the video, the Reviews wall, the
// authenticity guide and the store band. Exams, Subjects, Products, prices,
// the promo banner and the Shopee figures are
// catalogue data, read through the Catalogue seam. Copy that mentions the
// Member App is kept separate, so it renders only while the switch is on.
// Arrows are added by the components.
// ─────────────────────────────────────────────────────────────────────────────

/** The self-hosted promo video (59 s, 720p) and its poster, in public/media. */
export const promoVideo = {
  src: "/media/ayc-promo-720p.mp4",
  poster: "/media/ayc-promo-poster.webp",
} as const;

/** A "Try a card" sample: the topic on the front, the real card on the back. */
export interface TryCard {
  examCode: string;
  subjectCode: string;
  topic: string;
  /** The card's image, in public/cards. */
  image: string;
  /** What the card says, for screen readers. */
  alt: string;
}

/** The three hero sample cards (L275–279). */
export const tryCards: TryCard[] = [
  {
    examCode: "CE",
    subjectCode: "HPGE",
    topic: "Major head loss",
    image: "/cards/card-ce-major-head-loss.webp",
    alt: "Flash card: Major head loss, Darcy-Weisbach. h_f = 0.0826 f L Q² / D⁵.",
  },
  {
    examCode: "ME",
    subjectCode: "MATH",
    topic: "Potential energy",
    image: "/cards/card-me-potential-energy.webp",
    alt: "Flash card: Potential energy. PE = mgh.",
  },
  {
    examCode: "EE",
    subjectCode: "ESAS",
    topic: "Wave motion",
    image: "/cards/card-ee-wave-motion.webp",
    alt: "Flash card: Wave motion is a disturbance that moves through a medium. A wave drawn about its equilibrium level, labelled with its amplitude, wavelength, crest and trough.",
  },
];

/**
 * Where a step's link goes: a Home section (resolved to its id by the
 * component) or a Website path.
 */
export type HomeStepTarget = { section: "exams" | "formats" | "reviews" } | { path: string };

/** One of the four steps. */
export interface HomeStep {
  title: string;
  description: string;
  cta: string;
  target: HomeStepTarget;
}

// The first step never mentions the Member App, so both variants share it.
const pickYourExam: HomeStep = {
  title: "Pick your board exam",
  description: "Select the licensure exam you want to review.",
  cta: "Find your exam",
  target: { section: "exams" },
};

/**
 * "Four steps to your reviewer" (L317–321). `appOn` is the mockup's copy, shown
 * while the Member App switch is on. `appOff` never mentions or links to the
 * app; its steps 02–04 are new copy, for client review.
 */
export const homeSteps: ReadonlyArray<{ appOn: HomeStep; appOff: HomeStep }> = [
  { appOn: pickYourExam, appOff: pickYourExam },
  {
    appOn: {
      title: "Choose physical, app, or both",
      description:
        "Physical copies shipped nationwide. The app includes other features including quizzes and reviewers.",
      cta: "Compare formats",
      target: { section: "formats" },
    },
    appOff: {
      title: "Choose your format",
      description: "Flash cards, a notebook, posters, or the bundle.",
      cta: "Compare formats",
      target: { section: "formats" },
    },
  },
  {
    appOn: {
      title: "Review anywhere",
      description:
        "Cards in your bag, posters on your wall, and a countdown to your exam date in the app.",
      cta: "See reviews",
      target: { section: "reviews" },
    },
    appOff: {
      title: "Review anywhere",
      description: "Cards in your bag, posters on your wall.",
      cta: "See reviews",
      target: { section: "reviews" },
    },
  },
  {
    appOn: {
      title: "Watch anywhere",
      description: "Access video lessons and courses for every topic, anytime, right in the app.",
      cta: "See app plans",
      target: { path: paths.memberApp.plans },
    },
    appOff: {
      title: "Order from our official stores",
      description: "Shopee, Lazada or TikTok Shop, shipped from Iloilo City.",
      cta: "Browse all reviewers",
      target: { path: paths.products.list },
    },
  },
];

/**
 * A format card's fixed copy. Its "For" Exams, "From" price and any saving
 * come from the catalogue.
 */
export interface FormatCardCopy {
  format: ProductFormat;
  title: string;
  size: string;
  body: string;
  /** Shown instead of `body` while the catalogue gives a saving, e.g. "₱200". */
  bodyWithSaving?: (saving: string) => string;
}

/** "Which format fits how you study?", in the mockup's order (L344–348). */
export const formatCards: ReadonlyArray<FormatCardCopy> = [
  {
    format: "flash-cards",
    title: "Flash cards",
    size: "4 × 6 in · 160 gsm",
    body: "Formulas and high-yield concepts grouped by subject, small enough for your bag or pocket.",
  },
  {
    format: "notebook",
    title: "Notebook",
    size: "A5",
    body: "Practice solving board problems, with a study schedule and blank pages for concepts.",
  },
  {
    format: "posters",
    title: "Posters",
    size: "A3",
    body: "For your study wall. One reviewer says you can read them from 6 ft away.",
  },
  {
    format: "bundle",
    title: "Bundle",
    size: "Cards + notebook + posters",
    body: "All three CE formats in one order.",
    bodyWithSaving: (saving) =>
      `All three CE formats in one order, ${saving} less than buying each separately.`,
  },
];

/** One of the authenticity steps. `highlight` is the listing text to look for. */
export interface AuthenticityStep {
  text: string;
  highlight?: string;
}

export const homeCopy = {
  metaTitle: "Board exam reviewers made by passers",
  metaDescription:
    "Formula flash cards, notebooks and posters for Philippine board exams, made by board passers. Try a sample card, find your exam's reviewers, and buy from our official Shopee, Lazada or TikTok Shop stores.",
  hero: {
    eyebrow: websiteCopy.home.eyebrow,
    headlineLead: websiteCopy.home.headlineLead,
    headlineHighlight: websiteCopy.home.headlineHighlight,
    subheadline: websiteCopy.home.subheadline,
    /** Shown in place of `subheadline` only while the Member App switch is on. */
    subheadlineApp: websiteCopy.home.subheadline.replace(/\.$/, ", and also available in the app."),
    findYourExam: "Find your exam",
    watch: "Watch 1 min",
    /** Shown only while the Member App switch is on. */
    tryTheApp: "Try the app free",
    playVideo: "Play video",
    pauseBackground: "Pause background video",
    playBackground: "Play background video",
    videoLabel: "Ace Your Course promo video",
    /** Read out in place of the five stars. */
    starsLabel: "5 stars",
    ratings: (rating: string, ratingCount: string) => `${rating} from ${ratingCount} ratings`,
    ipophil: "IPOPHIL registered",
  },
  tryCard: {
    heading: "Try a card · tap to flip",
    flip: "Flip card",
    front: "Front",
    back: "Actual card",
    topic: "Topic",
    tapToSee: "Tap to see the card",
    chooseCard: "Sample cards",
    showCard: (examCode: string) => `Show the ${examCode} card`,
    next: "Next card",
  },
  ticker: {
    label: "Why reviewees choose us",
    /** The mockup's ticker (L316), with the shop's figures and Exam codes filled in. */
    items: ({
      rating,
      ratingCount,
      examCodes,
    }: {
      rating: string;
      ratingCount: string;
      examCodes: string[];
    }) => [
      "Licensure exam reviewers",
      `★ ${rating} shop rating`,
      "Updated & high yield",
      `${ratingCount} ratings`,
      "Trusted by students",
      "IPOPHIL registered",
      "Made by board passers",
      "Ships nationwide",
      examCodes.join(" · "),
    ],
  },
  steps: {
    heading: "Four steps to your reviewer",
    intro: "Every reviewer is built around your board’s subjects, so you only study what shows up.",
  },
  findExam: {
    eyebrow: "Step 1 · Pick your board",
    heading: "Find your exam",
    examsLabel: "Board exams",
    subjects: "Subjects covered",
    allReviewers: (examCode: string) => `All ${examCode} reviewers`,
    /** Shown only while the Member App switch is on. */
    reviewInApp: (examCode: string) => `Review ${examCode} in the app`,
    formats: (count: number) =>
      `Step 2 · Choose a format · ${count} reviewer${count === 1 ? "" : "s"}`,
    /** Shown only while the Member App switch is on. */
    alsoInApp: "Also in app",
  },
  bestSellers: {
    eyebrow: "Ranked by units sold on Shopee",
    heading: "Best sellers",
    previous: "Previous best sellers",
    next: "Next best sellers",
    rank: (rank: number) => `#${rank}`,
    sold: (count: string) => `${count} sold`,
  },
  promo: {
    label: "Sale",
  },
  formats: {
    eyebrow: "Step 2 · Choose your format",
    heading: "Which format fits how you study?",
    intro:
      "Most passers mix two: cards for recall on the go, posters for the wall you stare at while solving.",
    forExams: (examCodes: string[]) => `For ${examCodes.join(" · ")}`,
    from: "From",
    /** The app band. Shown only while the Member App switch is on. */
    app: {
      eyebrow: "Prefer your phone?",
      text: "Flashcards, scored quizzes, reviewers, and video lessons in the app, with a countdown to your exam.",
      cta: "See app plans",
    },
  },
  video: {
    eyebrow: "Watch · 1 min",
    heading: "See what’s inside before you order.",
    intro: "A minute with the cards, notebooks, and posters, from the people who made them.",
    playerLabel: "One-minute promo video",
  },
  reviews: {
    eyebrow: "Copied word for word from Shopee",
    heading: "Pinned by reviewees",
    intro: "Most are five stars. Not all of them, and we leave those up too.",
    /** The badge's stars, read out after the shop's rating: "4.8, out of 5 stars". */
    outOfFive: "out of 5 stars",
    shopRatings: (count: string) => `${count} shop ratings`,
    row: (row: number, rows: number) => `Pinned reviews, row ${row} of ${rows}`,
    readAll: "Read every review on Shopee",
  },
  authenticity: {
    stamp: { top: "Registered with", name: "IPOPHIL", bottom: "Original · AceYourCourse" },
    heading: "Copies are going around. Make sure yours is the real one.",
    body: "Our reviewers are registered with IPOPHIL and protected by copyright law. Photocopies and PDFs sold elsewhere aren’t ours, and you can’t tell if what’s inside is updated or correct.",
    steps: [
      {
        text: "Buy only from the official AceYourCourse stores on Shopee, Lazada, or TikTok Shop.",
      },
      { text: "Check the listing says", highlight: "Ships from Iloilo City" },
      {
        text: "Look for the established reviews by our dear future board passers. A new shop with our photos is a red flag.",
      },
    ] satisfies AuthenticityStep[],
  },
  storeBand: {
    heading: "Physical copies from our official stores.",
    /** Shown in place of `heading` only while the Member App switch is on. */
    headingApp: "Physical copies from our official stores. Digital in the app.",
    /** Shown only while the Member App switch is on. */
    openApp: "Open the app",
  },
} as const;
