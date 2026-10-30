import type { LegalDocument } from "@/content/legal/types";
import { formatDate } from "@/lib/manila-time";

// ─────────────────────────────────────────────────────────────────────────────
// Terms of Use v1.0: the Website only, a draft for the client's lawyer. The
// Website is a catalogue that links out to the Marketplaces, so these terms
// cover browsing, "as of" prices and figures, Marketplace purchases and AYC's
// IPOPHIL-registered content. The Member App terms (accounts, Plans, payments,
// refunds) arrive as v2.0 at the Member App launch.
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = "1.0";
const EFFECTIVE_DATE = "2026-12-01";

export function termsOfUse(contactEmail: string): LegalDocument {
  return {
    kind: "terms",
    title: "Terms of Use",
    description:
      "The terms for using the Ace Your Course website: purchases on the Marketplaces, prices and figures shown as of a date, and our IPOPHIL-registered content.",
    version: VERSION,
    effectiveDate: EFFECTIVE_DATE,
    status: "draft",
    summary: [
      "The Website is a catalogue. It doesn’t sell anything or take payments.",
      "Prices and Shopee figures are shown as of a date. When you buy, the Marketplace listing is what counts.",
      "You buy on Shopee, Lazada or TikTok Shop, under that platform’s terms, including for returns and refunds.",
      "Our reviewers are registered with IPOPHIL and protected by copyright. Don’t copy, share or resell them.",
      `These terms follow Philippine law. Questions? Email ${contactEmail}.`,
    ],
    sections: [
      {
        id: "s1",
        title: "Using the Website",
        paragraphs: [
          "These terms apply to your use of the Ace Your Course website (“the Website”). By using the Website, you agree to them. If you don’t agree, please don’t use it.",
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
        title: "Limitation of liability",
        paragraphs: [
          "We provide the Website for information, as it is. We work to keep it accurate and available, but we can’t promise it will always be complete, error-free or uninterrupted.",
          "Our reviewers are study aids. They help you review, but they don’t guarantee that you’ll pass a board exam.",
          "To the extent the law allows, we aren’t liable for any loss that comes from using the Website or relying on its information. Nothing in these terms takes away rights you have under the Consumer Act of the Philippines (Republic Act No. 7394) or any other law that can’t be waived.",
        ],
      },
      {
        id: "s7",
        title: "Changes to these terms",
        paragraphs: [
          "We may update these terms. When we do, we’ll give them a new version number and effective date, shown at the top of this page. If you keep using the Website after a change takes effect, the updated terms apply.",
          `Version ${VERSION}, effective ${formatDate(EFFECTIVE_DATE, "long")}: the first version, covering the Website.`,
        ],
      },
      {
        id: "s8",
        title: "Governing law and contact",
        paragraphs: [
          "These terms are governed by the laws of the Republic of the Philippines.",
          `Questions about these terms? Email us at ${contactEmail}. Ace Your Course, Iloilo City, Philippines.`,
        ],
      },
    ],
  };
}
