import type { LegalDocument } from "@/content/legal/types";
import { formatDate } from "@/lib/manila-time";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Policy v1.0: the Website only, a draft for the client's lawyer. It
// describes what the Website actually does (docs/adr/0009 and 0012): anonymous,
// cookieless PostHog analytics, Vercel hosting, no accounts or payments, and
// the announcement bar's local storage. The Member App sections (sign-in,
// progress, payments, watermarking, one Active Device) arrive as v2.0 at the
// Member App launch. Keep it true to the code: if the Website starts collecting
// anything new, this policy changes first.
// ─────────────────────────────────────────────────────────────────────────────

const VERSION = "1.0";
const EFFECTIVE_DATE = "2026-12-01";

export function privacyPolicy(contactEmail: string): LegalDocument {
  return {
    kind: "privacy",
    title: "Privacy Policy",
    description:
      "How the Ace Your Course website handles data: anonymous, cookieless analytics, no accounts or payments, and your rights under the Data Privacy Act.",
    version: VERSION,
    effectiveDate: EFFECTIVE_DATE,
    status: "draft",
    summary: [
      "The Website has no accounts, sign-in, forms or payments. You can browse it without telling us who you are.",
      "We measure page views and clicks through to our Marketplace stores with anonymous, cookieless analytics. The events are stored without your IP address, and no profiles are created.",
      "Nothing is saved on your device for analytics. The only thing the Website remembers in your browser is that you closed the announcement bar.",
      "When you buy, you buy on Shopee, Lazada or TikTok Shop, under that platform’s own privacy policy.",
      `For any privacy question or request, email ${contactEmail}.`,
    ],
    sections: [
      {
        id: "s1",
        title: "Who we are and how to reach us",
        paragraphs: [
          "Ace Your Course (“AYC”, “we”, “us”) is a small business in Iloilo City, Philippines, that makes printed reviewers for Philippine licensure exams. This policy explains how our website (“the Website”) handles information about the people who visit it.",
          "In the Philippines, the Data Privacy Act of 2012 (Republic Act No. 10173) protects your personal information, and the National Privacy Commission (NPC) enforces it.",
          `Our data protection contact is ${contactEmail}. Email us there with any question about this policy or your personal information.`,
        ],
      },
      {
        id: "s2",
        title: "What the Website collects",
        paragraphs: [
          "The Website has no accounts, no sign-in, no forms, no cart and no payments. You can use all of it without giving us your name, email address or any other details.",
          "To see how the Website is used, we run anonymous analytics with PostHog. It records each page you view, including when you leave it (which shows how long you stayed), and each click through to one of our Marketplace stores (which Product, which Marketplace, and the page you clicked from). Each event also carries the technical details any browser sends, such as the page address, the page you came from, and your browser and device type.",
          "The analytics are cookieless. Your visit gets a random identifier that is kept only in the open page’s memory, never saved on your device, and gone when you close or reload the page, so separate visits can’t be linked.",
          "PostHog discards your IP address, so it isn’t stored with the events, and no profile of you is created. We don’t try to identify anyone from this data.",
          "If your browser sends a “Do Not Track” signal, no analytics are recorded at all.",
          "If you email us, we receive your email address and whatever you write. We use it only to reply to you and help with your question.",
          "We don’t collect names, contact details or payment information on the Website, and we don’t use advertising or tracking cookies.",
        ],
      },
      {
        id: "s3",
        title: "Browser storage",
        paragraphs: [
          "The Website sets no cookies.",
          "It saves one thing in your browser’s local storage: when you close the announcement bar at the top of the page, it remembers which announcement you closed (under the name “ayc.announcement.dismissed”), so the bar stays hidden on later visits until there’s a new announcement. This stays on your device, isn’t sent to us, and isn’t used for analytics.",
          "You can remove it at any time by clearing this site’s data in your browser’s settings. The announcement bar will then show again.",
        ],
      },
      {
        id: "s4",
        title: "Why we use it, and for how long",
        paragraphs: [
          "We use the analytics only to understand which pages and Products people find useful, and whether the Website helps them reach our official Marketplace stores, so we can improve it.",
          "We use your emails only to answer you.",
          "We keep the analytics events only for as long as they help us improve the Website. We keep emails for as long as we need them to help you, and delete them after that unless the law requires us to keep them longer.",
          "We don’t sell or rent any information, and we don’t use it for advertising.",
        ],
      },
      {
        id: "s5",
        title: "Who processes it, and where",
        paragraphs: [
          "PostHog, Inc. runs our analytics. The events pass through the Website’s own address on their way to PostHog, which stores them on its servers in the United States.",
          "Vercel Inc. hosts the Website, with its servers in Singapore and pages delivered through Vercel’s global network. Like any web host, Vercel receives your IP address and browser details in order to deliver pages and protect the Website from abuse, and may keep them in its logs for a short time.",
          "Supabase, Inc. runs our database in Singapore. The Website doesn’t send Supabase any information about you.",
          "Google provides our email, so the messages you send us are stored by Google.",
          "These providers process data on our behalf, only to run their services for us. Some of them process it outside the Philippines.",
        ],
      },
      {
        id: "s6",
        title: "Buying on the Marketplaces",
        paragraphs: [
          "The Website doesn’t sell anything. Its buy buttons open our official stores on Shopee, Lazada and TikTok Shop.",
          "When you buy there, the platform collects your details, such as your name, delivery address and payment, under its own privacy policy and terms. Please read them before you buy.",
          "As the seller, we receive the order and delivery details the platform passes on to us, so we can pack, ship and support your order.",
        ],
      },
      {
        id: "s7",
        title: "Your rights",
        paragraphs: [
          "Under the Data Privacy Act, you have the right to be informed about how your personal information is processed, and to access it, correct it, object to its processing, have it erased or blocked, and get a copy in a portable format. You may also claim damages and file a complaint.",
          `The Website’s analytics are anonymous, so we can’t link them to you, and there is usually no Website data about you to give, correct or delete. For anything else we hold about you, such as your emails, write to ${contactEmail} and tell us what you’d like us to do.`,
          "If you believe we’ve mishandled your personal information, please tell us first so we can put it right. You can also file a complaint with the National Privacy Commission at privacy.gov.ph.",
        ],
      },
      {
        id: "s8",
        title: "Changes and version history",
        paragraphs: [
          "If what the Website does with information changes, we’ll update this policy first, give it a new version number and effective date, and show both at the top of this page.",
          `Version ${VERSION}, effective ${formatDate(EFFECTIVE_DATE, "long")}: the first version, covering the Website.`,
        ],
      },
    ],
  };
}
