import type { ProductFormat } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed Exam page copy (docs/mockup/website/Exam_v2.dc.html), typed so a
// missing string is a type error: the best-for map, three sample formula cards
// per Exam (exam-pages.test.ts checks every Exam has its three) and the promo
// banners. Exams, Subjects, counts and prices are
// catalogue data, read through the Catalogue seam; a banner's price is always
// its Product's. Copy that mentions the Member App is kept separate, so it
// renders only while the switch is on. Arrows are added by the components.
// ─────────────────────────────────────────────────────────────────────────────

/** What each format is best for, in the "Which one should I get?" table (L220). */
export const bestFor: Record<ProductFormat, string> = {
  "flash-cards": "Quick recall on the go",
  posters: "Your study wall, active recall",
  notebook: "Practice solving and notes",
  bundle: "Everything in one order",
};

export interface SampleCard {
  /** One of the Exam's Subject codes. */
  subject: string;
  /** The prompt on the front. */
  front: string;
  /** The formula on the back. */
  back: string;
  /** A line under the formula: what its symbols are, or when it applies. */
  note: string;
}

/** Three sample formula cards per Exam code, for "Try a {code} card" (L213–219). */
export const sampleCards: Partial<Record<string, SampleCard[]>> = {
  CE: [
    {
      subject: "MSTC",
      front: "Tangent distance of a simple curve",
      back: "T = R tan(I/2)",
      note: "R = radius, I = central angle",
    },
    {
      subject: "HPGE",
      front: "Pressure at a depth in a liquid",
      back: "p = γh",
      note: "γ = unit weight; 9.81 kN/m³ for water",
    },
    {
      subject: "PSAD",
      front: "Balanced steel ratio",
      back: "ρb = 0.85β₁f′c(600) / [fy(600 + fy)]",
      note: "f′c and fy in MPa",
    },
  ],
  ME: [
    {
      subject: "PIP",
      front: "Ideal gas equation",
      back: "PV = mRT",
      note: "R = 0.287 kJ/kg·K for air",
    },
    {
      subject: "PIP",
      front: "Carnot efficiency",
      back: "η = 1 − T_L / T_H",
      note: "Temperatures in kelvin",
    },
    {
      subject: "MD",
      front: "Power transmitted by a shaft",
      back: "P = 2πTN",
      note: "T = torque, N in rev/s",
    },
  ],
  EE: [
    { subject: "ESAS", front: "Ohm’s law", back: "V = IR", note: "Voltage, current, resistance" },
    {
      subject: "EE PROF",
      front: "Real power, balanced three-phase",
      back: "P = √3 · V_L · I_L · cos θ",
      note: "θ = power factor angle",
    },
    {
      subject: "MATH",
      front: "Quadratic formula",
      back: "x = [−b ± √(b² − 4ac)] / 2a",
      note: "For ax² + bx + c = 0",
    },
  ],
  MT: [
    {
      subject: "CLIN CHEM",
      front: "Friedewald LDL equation",
      back: "LDL = TC − HDL − TG/5",
      note: "In mg/dL; not valid when TG is above 400 mg/dL",
    },
    {
      subject: "HEMA",
      front: "Mean corpuscular volume",
      back: "MCV = Hct × 10 / RBC",
      note: "Hct in %, RBC × 10¹²/L, result in fL",
    },
    {
      subject: "HEMA",
      front: "Mean corpuscular Hgb concentration",
      back: "MCHC = Hgb × 100 / Hct",
      note: "Hgb in g/dL, Hct in %, result in g/dL",
    },
  ],
  CPA: [
    {
      subject: "FAR",
      front: "The accounting equation",
      back: "Assets = Liabilities + Equity",
      note: "Every transaction keeps both sides equal",
    },
    {
      subject: "FAR",
      front: "Current ratio",
      back: "Current assets ÷ Current liabilities",
      note: "A liquidity measure",
    },
    {
      subject: "MS",
      front: "Break-even point in units",
      back: "Fixed costs ÷ Contribution margin per unit",
      note: "CM per unit = price − variable cost",
    },
  ],
};

export interface ExamPromo {
  examCode: string;
  /** The Product the banner offers and links to. Its price is read from the catalogue. */
  productSlug: string;
  eyebrow: string;
  body: string;
}

/**
 * A banner on an Exam page offering one Product (L163–170). It shows only while
 * that Product is Live.
 */
export const examPromos: ExamPromo[] = [
  {
    examCode: "CE",
    productSlug: "ce-review-bundle-3-in-1",
    eyebrow: "CE Review Bundle 3-in-1 · save ₱200",
    body: "Cards, notebook, and posters for MSTC, HPGE, and PSAD in one order.",
  },
];

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const examPageCopy = {
  breadcrumbExams: "Exams",
  switcherLabel: "Switch exam",
  hero: {
    seeProducts: (count: number) => `See ${count} ${plural(count, "reviewer", "reviewers")}`,
    stats: {
      productCount: "Reviewers",
      unitsSold: "Units sold",
      averageRating: "Avg rating",
      priceFrom: "From",
      /** The average rating with no ratings yet. */
      noRatings: "New",
      /** Under the stats, e.g. "… as of Oct 2026": the figures are copied from Shopee by hand. */
      figuresNote: (asOf: string) => `Units sold and ratings from Shopee, ${asOf}`,
    },
    stackLabel: "Top sellers",
    tickerLabel: (code: string) => `${code} subjects`,
    // Shown only while the Member App switch is on.
    reviewInApp: (code: string) => `Review ${code} in the app`,
  },
  subjects: {
    eyebrow: (count: number, board: string) =>
      `${count} ${plural(count, "subject", "subjects")} on the ${board}`,
    heading: "What’s covered",
    intro: (code: string) =>
      `Every ${code} reviewer follows the board’s own subject list, so you study what actually shows up.`,
  },
  products: {
    eyebrow: "Best selling first",
    heading: (code: string) => `Every ${code} reviewer`,
    topSeller: (code: string) => `#1 in ${code}`,
    filterLabel: "Filter by format",
    all: "All",
    /** After a chip's count, for screen readers: "Posters 1 reviewer". */
    chipCount: (count: number) => ` ${plural(count, "reviewer", "reviewers")}`,
  },
  compare: {
    eyebrow: "Side by side",
    heading: "Which one should I get?",
    columns: {
      reviewer: "Reviewer",
      format: "Format",
      bestFor: "Best for",
      inApp: "In the app",
      price: "Price",
    },
    // The In-the-app column shows only while the Member App switch is on.
    inApp: "Yes",
    physicalOnly: "Physical only",
  },
  tryCard: {
    eyebrow: (code: string) => `Try a ${code} card`,
    heading: "One formula a card. Flip, recall, repeat.",
    intro: "Tap the card to flip it.",
    getPrintedSet: "Get the printed set",
    flip: "Flip card",
    tapToFlip: "Tap to flip",
    back: "Back",
    previous: "Previous",
    next: "Next card",
    // Shown only while the Member App switch is on.
    appIntro: "The app works the same way, and remembers which cards you need to see again.",
    seeAppPlans: (code: string) => `See ${code} app plans`,
  },
  promo: {
    seeBundle: "See the bundle",
  },
  reviews: {
    eyebrow: "Copied word for word from Shopee",
    heading: (code: string) => `From ${code} reviewees`,
    marqueeLabel: (code: string) => `Reviews from ${code} reviewees`,
    empty:
      "No written reviews yet. Buyers have left star ratings on Shopee but no comments so far.",
  },
  storeBand: {
    heading: (code: string) => `Get your ${code} reviewer from our official stores.`,
  },
} as const;
