import { websiteCopy } from "@/content/website";
import { formatList } from "@/lib/text";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed About copy (docs/mockup/website/About_v2.dc.html), typed so a missing
// string is a type error: the hero, the story and timeline, the mission tabs,
// the Iloilo City roots and the closing call to action. The stats, the Exam
// names and codes, and the shop links are catalogue data, read through the
// Catalogue seam. The page never mentions the Member App. Arrows are added by
// the components.
// ─────────────────────────────────────────────────────────────────────────────

/** A self-hosted About photo, in public/about. */
export interface AboutPhoto {
  src: string;
  alt: string;
}

/** The hero's team photo (L28). */
export const teamPhoto: AboutPhoto = {
  src: "/about/about-team-studying.webp",
  alt: "Two of the team going through flash cards and a notebook at a desk",
};

/** The three photos under the timeline, in the mockup's order (L82–84). */
export const storyPhotos: ReadonlyArray<AboutPhoto> = [
  {
    src: "/about/about-handover.webp",
    alt: "A team member handing a reviewee her package",
  },
  {
    src: "/about/about-mother-daughter.webp",
    alt: "A reviewee opening her package while her mother looks on",
  },
  {
    src: "/about/about-hug.webp",
    alt: "A reviewee hugging her mother, package in hand",
  },
];

/** One of the mission tabs. The component numbers them from 01. */
export interface MissionTab {
  title: string;
  body: string;
}

/**
 * "The mission" (L163–167). Tab 03's prices are the catalogue's lowest prices
 * today; about.test.ts fails when the catalogue's prices move away from them.
 */
export const missionTabs: ReadonlyArray<MissionTab> = [
  {
    title: "Board-focused, nothing extra",
    body: "High-yield formulas and concepts, organized around each exam’s own subjects, so every card earns its place in your bag.",
  },
  {
    title: "Updated to the trend",
    body: "Topics follow what’s showing up in recent exams. Our CE flash cards are already on their second edition.",
  },
  {
    title: "Made for tight budgets",
    body: "Buy one subject at a time where it makes sense: CE posters from ₱400, EE cards at ₱600 per subject, MedTech cards at ₱550 per module. SPayLater 0% on every listing.",
  },
  {
    title: "Original, and protected",
    body: "Every reviewer is registered with IPOPHIL. Buying the original keeps the content accurate and supports the passers who wrote it.",
  },
];

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The timeline's Now line before the catalogue's Exams. */
const NOW_LEAD = "Then came updated editions and reviewers for more courses.";

export const aboutCopy = {
  metaTitle: "About · made by board passers in Iloilo",
  metaDescription:
    "Ace Your Course is run by board passers in Iloilo City. We make the flash cards, notebooks and posters we wished we’d had for our own board exams, and ship them nationwide.",
  hero: {
    pill: `About ${websiteCopy.wordmark}`,
    headingLead: websiteCopy.footer.headlineLead,
    headingHighlight: websiteCopy.footer.headlineHighlight,
    intro:
      "Everyone behind AceYourCourse has taken a board exam and passed. We make the reviewers we wish we’d had, then pack and ship every order ourselves from Iloilo City.",
    readOurStory: "Read our story",
    seeTheReviewers: "See the reviewers",
    ipophil: "IPOPHIL registered",
    statsLabel: "AceYourCourse in numbers",
    /** Followed by "as of {month year}". */
    figuresNote: "Shop figures from Shopee",
  },
  /** The stat tiles' labels, under their figures. */
  stats: {
    reviewers: (count: number) => plural(count, "reviewer", "reviewers"),
    exams: (count: number) => plural(count, "board exam", "board exams"),
    ratings: (count: number, figure: string) =>
      `${figure} shop ${plural(count, "rating", "ratings")}`,
    followers: "Shopee followers",
  },
  story: {
    eyebrow: "Our story",
    heading: "We passed. Then we made what we wished we had.",
    paragraphs: [
      "During review season, almost every reviewee does the same thing: copies formulas onto index cards and manila paper, page by page, the night before. It works, but it eats hours you could spend solving.",
      "So we printed those cards properly. Organized by the exam’s actual subjects, sized at 4 × 6 in to fit in a bag, on 160 gsm paper that survives a whole review season. Posters for the wall you stare at while solving. Notebooks for practice problems.",
    ],
    before: {
      label: "Before · the night before",
      title: "Hand-copied index cards and manila paper",
      body: "Page by page, hours away from solving.",
    },
    after: {
      label: "After · AYC reviewers",
      title: "Made properly, by the exam’s subjects",
      specs: ["4 × 6 in", "160 gsm", "By subject", "Posters", "Notebooks"],
    },
    timelineHeading: "How it grew",
    first: { label: "First", title: "Civil Engineering flash cards" },
    now: {
      label: "Now",
      /** The sentence before the Exams, which Staff can change in the Admin. */
      lead: NOW_LEAD,
      /** The mockup's hardcoded course list (L174) is the catalogue's Exams instead. */
      body: (examNames: string[], lead: string = NOW_LEAD) =>
        examNames.length > 0 ? `${lead} We now make reviewers for ${formatList(examNames)}.` : lead,
    },
    today: {
      label: "Today",
      body: "We’re still growing. Reaching out to more courses so we can help even more students on their journey. From one set of flash cards to a growing community of learners, our goal has always been the same: to make studying a little easier and help thousands of students move closer to their dreams.",
    },
    beginning: "And this is only the beginning.",
  },
  mission: {
    eyebrow: "What we stand for",
    heading: "The mission",
    intro:
      "Help more reviewees walk out of the exam room as registered professionals, without spending more than they have.",
  },
  roots: {
    eyebrow: "Iloilo City roots",
    heading: "Packed in Iloilo. Shipped to wherever you’re reviewing.",
    body: "We’re a small Visayas shop, and every order still goes out from Iloilo City, through Shopee, TikTok Shop, and Lazada, to reviewees all over the Philippines.",
    storesLabel: "Our official stores",
    /** The mock shipping label (L124–127). */
    label: {
      title: "Shipping label",
      via: "Via Shopee",
      from: "From",
      sender: websiteCopy.wordmark,
      senderCity: "Iloilo City, Iloilo",
      to: "To",
      recipient: "Future RCE, RME, REE, RMT, CPA",
    },
  },
  cta: {
    heading: "Your turn. Find the reviewer for your board.",
    examCta: "Reviewers",
    /** The mockup's "+ Other courses" tile, which went to Home#exams. */
    allReviewers: "All reviewers",
  },
};
