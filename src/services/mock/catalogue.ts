import { paths } from "@/paths";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { Faq } from "@/services/catalogue.types";
import { exams, products, reviews } from "@/services/mock/catalogue.generated";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue seed. The Exams, Products and Reviews are generated from the
// catalogue spreadsheet by `pnpm catalogue:import` (data/catalogue/template/README.md);
// today that is the sample spreadsheet, the mockup's data from
// docs/mockup/aycData.js. Its Subject codes for ME, EE, CPA and MT were mapped
// from the mockup's free strings, pending the client's confirmation (BUILD-MAP
// §8 item 10), and its Home Review pins follow the hand-picked selection at
// Home_v2.dc.html L349–351. The client's full spreadsheet replaces it before
// launch. The Website settings and FAQs are kept here by hand: the settings
// from aycData.js (STORES, CONTACT, SHOP) and the announcement in
// docs/mockup/website/SiteNav.dc.html, and the FAQs from FAQ_v2.dc.html
// L111–133, rewritten for the Website (see the FAQ note below). Pages never
// import this file: they read it through @/services/catalogue.
// ─────────────────────────────────────────────────────────────────────────────

const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";

/**
 * An FAQ, shown on the FAQ page, with no quote, chip or coverage table unless
 * given. The mockup's answers were written for inside the Member App ("here in
 * the app"), so they are rewritten for the Website with the CONTEXT.md terms
 * (a Plan, never a subscription). Answers about the Member App need it live,
 * so they stay hidden while the switch is off. The mockup's two quotes that no
 * seeded Review contains are dropped, pending the client's confirmation. A
 * quote names its Review by id, which the import numbers by the Review's row
 * on reviews.csv (rev-014 is row 15): if the Reviews move, update the ids here.
 * The import reports a quote that no longer matches its Review.
 */
function faq(
  id: string,
  slug: string,
  group: Faq["group"],
  order: number,
  fields: Pick<Faq, "question" | "answer"> & Partial<Faq>,
): Faq {
  return {
    id,
    slug,
    group,
    order,
    reviewQuote: null,
    popularLabel: null,
    requiresMemberApp: false,
    showOnFaqPage: true,
    showCoverageTable: false,
    ...fields,
  };
}

export const CATALOGUE_SEED: CatalogueSeed = {
  exams,
  settings: {
    shopLinks: {
      shopee: SHOPEE_SHOP,
      lazada: "https://www.lazada.com.ph/shop/aceyourcourse",
      tiktok: "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
    },
    socialLinks: {
      tiktok: "https://www.tiktok.com/@aceyourcourse",
      facebook: "https://www.facebook.com/aceyourcourseph",
      instagram: "https://www.instagram.com/aceyourcourseph",
    },
    contactEmail: "aceyourcourseinc@gmail.com",
    shopStats: { rating: 4.8, ratingCount: 874, followers: "3.7K", asOf: "2026-10-29" },
    announcement: {
      // Change the id whenever the messages change, so Visitors who dismissed
      // the old bar see the new one.
      id: "2026-10-launch",
      messages: [
        {
          text: "Physical copies on Shopee, Lazada & TikTok Shop",
          href: paths.products.list,
          requiresMemberApp: false,
        },
        {
          text: "Digital reviewers in the app · no auto-renew",
          href: paths.memberApp.home,
          requiresMemberApp: true,
        },
        {
          text: "Ships from Iloilo City · SPayLater 0% on Shopee",
          href: paths.faq,
          requiresMemberApp: false,
        },
      ],
    },
    promoBanner: {
      visible: false,
      text: "11.11 · Any 2 reviewers, 4% off on Shopee",
      buttonLabel: "Shop the sale",
      href: SHOPEE_SHOP,
      startDate: "2026-11-09",
      endDate: "2026-11-11",
    },
  },
  products,
  reviews,
  faqs: [
    faq("faq-001", "ship", "shipping", 1, {
      question: "Where do orders ship from?",
      answer:
        "Every order ships from Iloilo City through Shopee, TikTok Shop, and Lazada. We ship daily so your reviewers reach you faster.",
      popularLabel: "Where do orders ship from?",
    }),
    faq("faq-002", "nationwide", "shipping", 2, {
      question: "Do you deliver nationwide?",
      answer: "Yes, we ship nationwide! Order through Shopee, TikTok Shop, or Lazada.",
    }),
    faq("faq-003", "tracking", "shipping", 3, {
      question: "How do I track my order?",
      answer:
        "In the Shopee, TikTok Shop, or Lazada app, under My Purchases. Tracking updates come from the courier.",
    }),
    faq("faq-004", "flash-cards", "paper", 1, {
      question: "How thick are the flash cards?",
      answer:
        "Flash cards are 4 × 6 in, printed on 160 gsm board paper. Sturdy enough to shuffle through all review season, light enough to carry a full deck.",
    }),
    faq("faq-005", "posters", "paper", 2, {
      question: "What are the posters like?",
      answer: "A3 size, printed big enough to read from your desk while you solve.",
      reviewQuote: {
        reviewId: "rev-014",
        text: "Glossy type yung paper, makapal sya. Malalaki printing ng formulas kaya mababasa mo mga 6ft away hahaha.",
      },
    }),
    faq("faq-006", "notebook", "paper", 3, {
      question: "What size is the notebook?",
      answer: "Our notebooks are A5 size.",
    }),
    faq("faq-007", "coverage", "coverage", 1, {
      question: "What subjects does each exam’s reviewer cover?",
      answer:
        "Each reviewer follows that exam’s board subjects. Topics are updated and based on recent exam trends.",
      showCoverageTable: true,
    }),
    faq("faq-008", "one-subject", "coverage", 2, {
      question: "Can I buy just one subject?",
      answer:
        "For some reviewers, yes:\nCE posters per subject: MSTC ₱400 · HPGE ₱470 · PSAD ₱700\nEE flash cards per subject: ₱600 each, or ₱1,550 for all three\nMedTech flash cards per module: ₱550 each, or ₱2,750 for all six",
    }),
    faq("faq-009", "on-its-own", "coverage", 3, {
      question: "Is it enough on its own?",
      answer:
        "Think of it as your recall and practice kit. It works alongside a review center or self-review, so you spend less time copying formulas and more time solving.",
    }),
    faq("faq-010", "my-exam", "coverage", 4, {
      question: "My exam isn’t on the site yet.",
      answer: "More exams are coming soon.",
    }),
    faq("faq-011", "where-to-buy", "buying", 1, {
      question: "Where can I buy?",
      answer:
        "Physical copies are sold through our official stores on Shopee, Lazada, and TikTok Shop. Every store link on this site goes there.",
    }),
    faq("faq-012", "digital", "buying", 2, {
      question: "Is there a digital version?",
      answer:
        "Yes. Digital flashcards, quizzes, Reviewer PDFs, and video courses are in the Member App. Buy a Plan there and pay through PayMongo, including QR payments.",
      requiresMemberApp: true,
    }),
    faq("faq-013", "auto-renew", "buying", 3, {
      question: "Does my Plan renew automatically?",
      answer:
        "No. A Plan gives you access for a fixed period, like one month, and never renews by itself. When it ends, buy another Plan from the Billing page to keep going. We never charge you automatically.",
      popularLabel: "Does my Plan renew automatically?",
      requiresMemberApp: true,
    }),
    faq("faq-014", "two-devices", "buying", 4, {
      question: "Can I use my account on two devices?",
      answer:
        "You can sign in with Google on any device, but only one at a time. Signing in on a new device signs out the old one.",
      popularLabel: "Can I use my account on two devices?",
      requiresMemberApp: true,
    }),
    faq("faq-015", "discounts", "buying", 5, {
      question: "Are there discounts?",
      answer:
        "On Shopee, most listings have “Any 2 enjoy 4% off” when you add two items to the same order. The CE Review Bundle 3-in-1 is ₱3,499, which is ₱200 less than buying the cards, notebook, and posters separately.",
    }),
    faq("faq-016", "installments", "buying", 6, {
      question: "Can I pay in installments?",
      answer: "For physical copies on Shopee, every listing supports SPayLater at 0% interest.",
    }),
    faq("faq-017", "original", "authenticity", 1, {
      question: "How do I know I’m buying the original?",
      answer:
        "1. Buy from the official AceYourCourse stores on Shopee, Lazada, or TikTok Shop. Every store link on this site goes there.\n2. Check that the listing says “Ships from Iloilo City, Iloilo.”\n3. Look for the established reviews by our dear future board passers. A new shop with our photos is a red flag.",
      popularLabel: "How do I know I’m buying the original?",
    }),
    faq("faq-018", "copies", "authenticity", 2, {
      question: "Someone is selling PDFs or photocopies. Are those yours?",
      answer:
        "No. AceYourCourse products are registered with IPOPHIL and protected by copyright law. Unauthorized reproduction, distribution, or use is prohibited. Copies may be outdated or incomplete. If you see one, send us the link through Shopee chat.",
    }),
  ],
};
