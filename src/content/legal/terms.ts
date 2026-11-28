import type { LegalDocument } from "@/content/legal/types";
import { formatDate } from "@/lib/manila-time";

// ─────────────────────────────────────────────────────────────────────────────
// Terms of Use v2.2: the Website and the Member App, a draft for the client's
// lawyer ("Draft, pending legal review" shows while `status` is "draft").
// v1.0 covered the Website only: browsing, "as of" prices and figures,
// Marketplace purchases and AYC's IPOPHIL-registered content. Its text stays
// as the Website sections (1 to 5), and v1.0 itself is in git history. The
// Member App sections (6 to 11) cover the account and consent, one Active
// Device, Access Passes, Free Preview and Staff grants (spec, Phase 3), paying
// for Plans and refunds (v2.1: spec, Phase 4 planning decisions → Legal v2.1;
// story 151k), video Courses sold separately (v2.2: spec, Phase 5 planning
// decisions → Legal v2.2: a one-time purchase with no expiry, which a refund
// removes), watermarked content, and ending access or deleting the account.
// Its refund rule is a placeholder for the client and the lawyer to change.
// Bumping TERMS_OF_USE_VERSION asks every Member to agree again; the Privacy
// Policy keeps its own version (v2.1).
// ─────────────────────────────────────────────────────────────────────────────

/** The current version: what the consent screen asks Members to agree to. */
export const TERMS_OF_USE_VERSION = "2.2";
const EFFECTIVE_DATE = "2026-11-28";
/** v2.1 (payments and refunds) took effect on this date. */
const V2_1_EFFECTIVE_DATE = "2026-11-26";
/** v1.0 was set to take effect on this date, and v2.0 replaced it before then. */
const V1_EFFECTIVE_DATE = "2026-12-01";
const V2_0_EFFECTIVE_DATE = "2026-11-17";

export function termsOfUse(contactEmail: string): LegalDocument {
  return {
    kind: "terms",
    title: "Terms of Use",
    description:
      "The terms for the Ace Your Course website and Member App: your account, one Active Device, Access Passes, payments and refunds, and Marketplace purchases.",
    version: TERMS_OF_USE_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    status: "draft",
    summary: [
      "The Website is a catalogue. It doesn’t sell anything or take payments: you buy our printed reviewers on Shopee, Lazada or TikTok Shop, under that platform’s terms.",
      "Prices and Shopee figures are shown as of a date. When you buy, the Marketplace listing is what counts.",
      "The Member App is for your own study, with your own Google account, on one Active Device at a time.",
      "An Access Pass opens one exam’s content until its end date. Each Order is paid once, in pesos, through PayMongo: nothing renews automatically, and refunds are at our discretion.",
      "Member App content is watermarked with your email and Member ID, and our reviewers are registered with IPOPHIL. All our content is protected by copyright: don’t share, copy or resell it.",
      `These terms follow Philippine law. Questions? Email ${contactEmail}.`,
    ],
    sections: [
      {
        id: "s1",
        title: "Using the Website",
        paragraphs: [
          "These terms apply to your use of the Ace Your Course website (“the Website”) and our Member App (“the Member App”). By using the Website, you agree to them, and the Member App asks you to agree to them before you first use it. If you don’t agree, please don’t use either.",
          "You may use the Website to learn about our reviewers and find our official stores, for your own personal, non-commercial use.",
          "Please don’t misuse it: don’t try to break or overload it, get around its security, or copy its content in bulk, by hand or with automated tools.",
        ],
      },
      {
        id: "s2",
        title: "Product information and “as of” figures",
        paragraphs: [
          "We work to keep the product details, photos and prices on the Website accurate, but they can change. Prices and Shopee figures (ratings, rating counts and units sold) are shown as of a date, and may have changed since.",
          "The Marketplace listing is authoritative. The price, stock, variations, promotions and shipping shown on the listing when you buy are what apply, even if the Website shows something different.",
          "Colours on screen may differ slightly from the printed product. Products marked Coming Soon aren’t for sale yet, and their details may change before they launch.",
          "The reviews on the Website are buyers’ reviews from the Marketplaces, quoted word for word. We choose which ones to show.",
        ],
      },
      {
        id: "s3",
        title: "Buying on the Marketplaces",
        paragraphs: [
          "The Website doesn’t sell anything or take payments. Our printed reviewers are sold only through our official stores on Shopee, Lazada and TikTok Shop, which the Website’s buy buttons link to.",
          "When you buy, you buy on that platform, under its terms and policies, including for payment, shipping, cancellations, returns and refunds.",
          `For help with an order, use the platform’s chat or order page, or email us at ${contactEmail}.`,
        ],
      },
      {
        id: "s4",
        title: "Intellectual property",
        paragraphs: [
          "Unless we say otherwise, our reviewers (the flash cards, notebooks and posters) and the Website’s content, including its text, photos, designs and logo, belong to Ace Your Course.",
          "Our reviewers are registered with the Intellectual Property Office of the Philippines (IPOPHIL) and protected by copyright under the Intellectual Property Code of the Philippines (Republic Act No. 8293).",
          "You may not reproduce, photocopy, scan, print, share, sell or distribute our reviewers or the Website’s content, in whole or in part, on paper or digitally, without our written permission. Buying a printed copy lets you use that copy for your own review. It doesn’t give you the right to copy it.",
          `If you come across copies or unofficial sellers, please tell us at ${contactEmail}.`,
        ],
      },
      {
        id: "s5",
        title: "Links to other sites",
        paragraphs: [
          "The Website links to sites we don’t run, such as Shopee, Lazada, TikTok Shop and our social media pages. They have their own terms and privacy policies, and we aren’t responsible for their content, products or practices.",
        ],
      },
      {
        id: "s6",
        title: "The Member App and your account",
        paragraphs: [
          "The Member App is where Members study our digital content: flashcards, quizzes and Reviewer PDFs, organised by exam, subject and topic.",
          "You sign in with your Google account, and your first sign-in creates your Member App account. It’s for you alone: don’t share it or let anyone else use it. Keep your Google account secure, because what happens under your account is your responsibility.",
          "Before you first use the Member App, you agree to these terms and our Privacy Policy. When either gets a new version, the Member App asks you to agree again before you continue.",
          "The Member App is in a beta. Until it opens to everyone, only our staff and the Beta Testers we invite can use it, and its features may change or not always work as they should.",
        ],
      },
      {
        id: "s7",
        title: "One Active Device",
        paragraphs: [
          "You can use the Member App on one device at a time: your Active Device. Signing in on another device makes that one your Active Device, and ends the Member App session on the old one.",
          "We log each change of Active Device. If an account seems to be shared, we may sign out its Active Device, and act under section 11.",
        ],
      },
      {
        id: "s8",
        title: "Access Passes, Free Preview and grants",
        paragraphs: [
          "Some Member App content is a Free Preview that any Member can open. The rest needs an Access Pass for its exam.",
          "An Access Pass lets you open all of one exam’s study content until its end date, in Philippine time. When it ends, that content locks again, and your progress is kept.",
          "Our Owners may grant you an Access Pass, for example during the beta, and may extend it or end it early. Each grant is recorded with a reason.",
          "You can also buy an Access Pass in the Member App, as section 9 explains.",
        ],
      },
      {
        id: "s9",
        anchor: "payments-and-refunds",
        title: "Payments and refunds",
        paragraphs: [
          "You buy an Access Pass on the Member App’s Plans screen. Each Plan gives a number of days of access to one exam, for one price. Prices are in Philippine pesos, including VAT if we are registered for VAT, and you pay through PayMongo, our payment provider, on its secure page. Each purchase is an Order.",
          "Your access starts when your payment is confirmed. The Member App then shows a Payment Acknowledgement for your Order. It isn’t an official invoice.",
          "While you have an Access Pass for that exam, the new days are added to its current end date, so you don’t lose any days you have left.",
          "Some video courses are sold separately, on the same Plans screen. A course is a one-time purchase: you pay for it once and own it, with no expiry, and an Access Pass doesn’t open it.",
          "Nothing renews automatically: each Order is paid once, and your Access Pass ends on its end date unless you buy again. We never store your card details: you enter them on PayMongo’s page, under PayMongo’s own terms.",
          "Ask Support within 7 days of payment. Refunds are at our discretion. A refund removes that Order’s days, or the course that Order bought.",
        ],
      },
      {
        id: "s10",
        title: "Member App content and watermarks",
        paragraphs: [
          "The Member App’s flashcards, quizzes and Reviewer PDFs, with their text, images and figures, belong to Ace Your Course and are protected by copyright. Your Access Pass lets you study them in the Member App for your own review. It doesn’t give you the right to copy them.",
          "Don’t copy, download, record, print, share or resell Member App content, in whole or in part, and don’t use tools to scrape it or get around its protections.",
          "Each Reviewer PDF page is stamped with your email address and Member ID, and flashcards and quizzes show a watermark on screen. Don’t remove, hide or crop out a watermark.",
        ],
      },
      {
        id: "s11",
        title: "Ending your access, and deleting your account",
        paragraphs: [
          `You can stop using the Member App at any time. You can also ask us to delete your account, from the Member App’s Account screen or by emailing ${contactEmail}. We delete it within 30 days, as our Privacy Policy explains.`,
          "Deleting your account ends your Access Passes, and your progress is deleted with it. Access you paid for isn’t refunded when you delete your account.",
          "We may suspend or close your account, or end your Access Passes, if you break these terms, for example by sharing your account or our content. Where we can, we’ll tell you why.",
        ],
      },
      {
        id: "s12",
        title: "Limitation of liability",
        paragraphs: [
          "We provide the Website and the Member App as they are. We work to keep them accurate and available, but we can’t promise they will always be complete, error-free or uninterrupted, especially while the Member App is in its beta.",
          "Our reviewers and Member App content are study aids. They help you review, but they don’t guarantee that you’ll pass a board exam.",
          "To the extent the law allows, we aren’t liable for any loss that comes from using the Website or the Member App, or relying on their information. Nothing in these terms takes away rights you have under the Consumer Act of the Philippines (Republic Act No. 7394) or any other law that can’t be waived.",
        ],
      },
      {
        id: "s13",
        title: "Changes to these terms",
        paragraphs: [
          "We may update these terms. When we do, we’ll give them a new version number and effective date, shown at the top of this page. If you keep using the Website after a change takes effect, the updated terms apply. The Member App asks you to agree to each new version before you continue using it.",
          `Version 1.0, set to take effect ${formatDate(V1_EFFECTIVE_DATE, "long")}: the first version, covering the Website only. Version 2.0 replaced it before that date.`,
          `Version 2.0, effective ${formatDate(V2_0_EFFECTIVE_DATE, "long")}: adds the Member App, covering your account, one Active Device, Access Passes, Free Preview and grants, watermarked content, and ending your access or deleting your account.`,
          `Version 2.1, effective ${formatDate(V2_1_EFFECTIVE_DATE, "long")}: adds payments and refunds (section 9), for buying Access Passes in the Member App.`,
          `Version ${TERMS_OF_USE_VERSION}, effective ${formatDate(EFFECTIVE_DATE, "long")}: adds video courses sold separately (section 9), each a one-time purchase with no expiry that a refund removes. A draft, pending legal review.`,
        ],
      },
      {
        id: "s14",
        title: "Governing law and contact",
        paragraphs: [
          "These terms are governed by the laws of the Republic of the Philippines.",
          `Questions about these terms? Email us at ${contactEmail}. Ace Your Course, Iloilo City, Philippines.`,
        ],
      },
    ],
  };
}
