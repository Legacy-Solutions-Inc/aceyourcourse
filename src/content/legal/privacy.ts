import type { LegalDocument } from "@/content/legal/types";
import { formatDate } from "@/lib/manila-time";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Policy v2.1: the Website and the Member App, a draft for the
// client's lawyer ("Draft, pending legal review" shows while `status` is
// "draft"). v1.0 covered the Website only; its text stays as the Website
// sections (2, 3, 13), and v1.0 itself is in git history. The Member App
// sections (4 to 10, and 15) describe what the Member App does (spec, Phase
// 3; docs/adr/0009, 0011 and 0012): Google sign-in, consent, Target Exams and
// progress, one Active Device and its device log, stamped Reviewer PDF pages,
// Access Passes and Staff grants, payments and payment records (v2.1: spec,
// Phase 4 planning decisions → Legal v2.1), anonymous cookieless analytics,
// and Privacy Requests. How many years the tax rules keep payment records is
// for the lawyer to confirm. Keep it true to the code: if either Surface
// starts collecting anything new, this policy changes first, and bumping
// PRIVACY_POLICY_VERSION asks every Member to agree again.
// ─────────────────────────────────────────────────────────────────────────────

/** The current version: what the consent screen asks Members to agree to. */
export const PRIVACY_POLICY_VERSION = "2.1";
const EFFECTIVE_DATE = "2026-11-26";
/** v1.0 was set to take effect on this date, and v2.0 replaced it before then. */
const V1_EFFECTIVE_DATE = "2026-12-01";
const V2_0_EFFECTIVE_DATE = "2026-11-17";

export function privacyPolicy(contactEmail: string): LegalDocument {
  return {
    kind: "privacy",
    title: "Privacy Policy",
    description:
      "How Ace Your Course handles data on the website and in the Member App: Google sign-in, study progress, one Active Device, watermarks and your rights.",
    version: PRIVACY_POLICY_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    status: "draft",
    summary: [
      "The Website has no accounts, forms or payments, so you can browse it without telling us who you are. Its analytics are anonymous and cookieless.",
      "The Member App needs a Google sign-in. We keep your name and email, your Target Exams, your study progress and your Active Device, to run the Member App for you.",
      "Each Reviewer PDF page you open in the Member App is stamped with your email and Member ID, so a shared page can be traced to its account.",
      "We don’t sell your data, and our analytics never build a profile of you, on the Website or in the Member App.",
      "You can ask for a copy of your Member App data, or for your account to be deleted, at any time. We send the copy within 7 days and delete within 30, keeping only the payment records the tax rules require.",
      `For any privacy question or request, email ${contactEmail}.`,
    ],
    sections: [
      {
        id: "s1",
        title: "Who we are and how to reach us",
        paragraphs: [
          "Ace Your Course (“AYC”, “we”, “us”) is a small business in Iloilo City, Philippines, that makes printed reviewers and digital study material for Philippine licensure exams. This policy explains how our website (“the Website”) and our Member App (“the Member App”), where Members study our digital content, handle information about the people who use them.",
          "Sections 2 and 3 are about the Website, and sections 4 to 10 and 15 are about the Member App. The rest covers both.",
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
        title: "Browser storage on the Website",
        paragraphs: [
          "The Website sets no cookies.",
          "It saves one thing in your browser’s local storage: when you close the announcement bar at the top of the page, it remembers which announcement you closed (under the name “ayc.announcement.dismissed”), so the bar stays hidden on later visits until there’s a new announcement. This stays on your device, isn’t sent to us, and isn’t used for analytics.",
          "You can remove it at any time by clearing this site’s data in your browser’s settings. The announcement bar will then show again.",
        ],
      },
      {
        id: "s4",
        title: "Your Member App account and Google sign-in",
        paragraphs: [
          "You sign in to the Member App with your Google account. There’s no separate username or password. Google tells us your name, your email address and that Google has verified it. We never receive your Google password.",
          "Your first sign-in creates your Member App account, which keeps your name and email as they were when you joined. Each account also has a short Member ID. We use them to sign you in, to show who is signed in, and to stamp your watermark (section 7).",
          "Signing in sets cookies in your browser that keep you signed in. They’re needed for the Member App to work, and aren’t used for advertising or analytics.",
          "Before you first use the Member App, it asks you to agree to our Terms of Use and this Privacy Policy. We keep the version of each that you agreed to, and when, and keep your earlier agreements as a record. When either document gets a new version, the Member App asks you to agree again before you continue.",
          "Until the Member App opens to everyone, only our staff and the Beta Testers we invite can use it. We invite a Beta Tester by their Google email address, so we keep the list of invited addresses, which can include yours before you first sign in.",
        ],
      },
      {
        id: "s5",
        title: "Your study data and progress",
        paragraphs: [
          "To run your countdown and dashboard, we keep your Target Exams (the exams you’re preparing for) and your exam date for each.",
          "As you study, we keep your progress: your latest mark on each flashcard (“Got it” or “Review again”), your quiz results and best scores, which Reviewer PDF pages you’ve viewed, where you left off, and the days you studied, which make up your study streak.",
          "We use it to show your progress, your weakest topics and your streak, and to bring you back to where you left off. Our Owners, the staff who manage Members’ accounts, can see your account details, access and progress when they support you.",
          "Your progress stays when your access to an exam ends, so it’s there if you come back. It’s deleted when your account is deleted (section 15).",
        ],
      },
      {
        id: "s6",
        title: "Your Active Device and its device log",
        paragraphs: [
          "You can use the Member App on one device at a time: your Active Device. Signing in on another device makes that one your Active Device, and the old device shows a “Session ended” screen the next time it’s used.",
          "To know which device is active, the Member App sets a random device cookie on the device you use. It’s needed for the Member App to work. We store only a scrambled form of it (a hash), never the cookie itself.",
          "Each time your Active Device changes, we log when it happened and a short device label worked out from your browser, like “Chrome on Android”. Our Owners can see how often your Active Device changes, and can sign it out, for example when an account seems to be shared.",
        ],
      },
      {
        id: "s7",
        title: "Watermarks on Reviewer PDF pages",
        paragraphs: [
          "Every Reviewer PDF page you open in the Member App is stamped with your email address and Member ID, burned into the page image when you open it. Flashcards and quizzes show a watermark over them on screen.",
          "We do this to protect our content. If a page is shared outside the Member App, the watermark shows which account it came from, and we may act on that under our Terms of Use.",
          "A stamped page is kept only in your own browser’s cache, for a short time. We don’t store stamped copies, and we never send anyone the unstamped pages or the original files.",
        ],
      },
      {
        id: "s8",
        title: "Access Passes and grants",
        paragraphs: [
          "An Access Pass lets you open all of one exam’s study content until an end date. Some content is a Free Preview that any Member can open without one.",
          "We keep each Access Pass with its exam and end date. Our Owners may grant, extend or end Access Passes, for example during the beta or to help you, and each time we record who did it, when, and why.",
          "You can also buy an Access Pass in the Member App. Section 9 explains what we keep about payments.",
        ],
      },
      {
        id: "s9",
        title: "Payments and payment records",
        paragraphs: [
          "You buy an Access Pass on the Member App’s Plans screen, and pay through PayMongo, our payment provider, on its own secure page and under its own privacy policy. You enter your payment details there: we never receive or store your card details.",
          "For each purchase, we keep an Order: its reference, the Plan you chose, its price, the payment method you picked (QR Ph, GCash, Maya or card), when, its status (such as paid or refunded) and any refund, PayMongo’s ID for the payment, and your name and email. PayMongo tells us when a payment is confirmed or refunded.",
          "If you ask for the official invoice of an Order, we keep the name, address and TIN you give us for it, as an Invoice Request.",
          "We keep payment records (Orders and Invoice Requests) for as long as the tax rules require, even after your account is deleted.",
        ],
      },
      {
        id: "s10",
        title: "Analytics in the Member App",
        paragraphs: [
          "The Member App uses the same anonymous, cookieless analytics as the Website (section 2), and records only the pages you view.",
          "It sets no cookies and saves nothing on your device for analytics, PostHog discards your IP address, and no profile of you is created. The analytics aren’t linked to your account, your name, your email or your Member ID, so we can’t see what any one Member did.",
        ],
      },
      {
        id: "s11",
        title: "Why we use it, and for how long",
        paragraphs: [
          "We use the analytics only to understand which pages and Products people find useful, and whether the Website helps them reach our official Marketplace stores, so we can improve it.",
          "We use your emails only to answer you.",
          "We keep the analytics events only for as long as they help us improve the Website. We keep emails for as long as we need them to help you, and delete them after that unless the law requires us to keep them longer.",
          "We use your Member App data only to run the Member App for you, as our Terms of Use describe: to sign you in, keep your progress, keep to one Active Device, protect our content with watermarks, give you the access you have, and support you.",
          "We keep payment records to meet the tax rules (section 9).",
          "We keep your Member App data while you have an account. Your progress, device log and agreements stay when an Access Pass ends, and are deleted when your account is deleted, unless the law requires us to keep something longer.",
          "We don’t sell or rent any information, and we don’t use it for advertising.",
        ],
      },
      {
        id: "s12",
        title: "Who processes it, and where",
        paragraphs: [
          "PostHog, Inc. runs our analytics. The events pass through our own address on their way to PostHog, which stores them on its servers in the United States.",
          "Vercel Inc. hosts the Website and the Member App, with its servers in Singapore and pages delivered through Vercel’s global network. Like any web host, Vercel receives your IP address and browser details in order to deliver pages and protect our services from abuse, and may keep them in its logs for a short time.",
          "Supabase, Inc. runs our database in Singapore, along with the Member App’s sign-in and file storage. Your Member App account, study data, device log and agreements are stored there. The Website itself doesn’t send Supabase any information about you.",
          "Google provides our email, so the messages you send us are stored by Google. Google also provides the Member App’s sign-in, under Google’s own privacy policy.",
          "PayMongo takes the payments for Access Passes in the Member App, under its own privacy policy (section 9).",
          "These providers process data on our behalf, only to run their services for us. Some of them process it outside the Philippines.",
        ],
      },
      {
        id: "s13",
        title: "Buying on the Marketplaces",
        paragraphs: [
          "The Website doesn’t sell anything. Its buy buttons open our official stores on Shopee, Lazada and TikTok Shop.",
          "When you buy there, the platform collects your details, such as your name, delivery address and payment, under its own privacy policy and terms. Please read them before you buy.",
          "As the seller, we receive the order and delivery details the platform passes on to us, so we can pack, ship and support your order.",
        ],
      },
      {
        id: "s14",
        title: "Your rights",
        paragraphs: [
          "Under the Data Privacy Act, you have the right to be informed about how your personal information is processed, and to access it, correct it, object to its processing, have it erased or blocked, and get a copy in a portable format. You may also claim damages and file a complaint.",
          `The Website’s analytics are anonymous, so we can’t link them to you, and there is usually no Website data about you to give, correct or delete. For anything else we hold about you, such as your emails, write to ${contactEmail} and tell us what you’d like us to do.`,
          "If you use the Member App, we do hold data about you. Section 15 explains how to get a copy of it, or have your account deleted.",
          "If you believe we’ve mishandled your personal information, please tell us first so we can put it right. You can also file a complaint with the National Privacy Commission at privacy.gov.ph.",
        ],
      },
      {
        id: "s15",
        title: "Privacy Requests: a copy of your data, or deleting your account",
        paragraphs: [
          `You can make a Privacy Request from the Member App’s Account screen, or by emailing ${contactEmail} from the email address on your account. We may ask you to confirm that the request comes from you.`,
          "A copy of your data: within 7 days, we email you a file of your Member App account, Target Exams, agreements, Access Passes and grants, progress, and device log.",
          "Deleting your account: within 30 days, we delete your account and all your Member App data except your payment records (section 9), and your Access Passes end. Access you paid for isn’t refunded when you delete your account, and the Member App says so before you confirm. We keep a note that the deletion happened, without your personal information.",
        ],
      },
      {
        id: "s16",
        title: "Changes and version history",
        paragraphs: [
          "If what the Website or the Member App does with information changes, we’ll update this policy first, give it a new version number and effective date, and show both at the top of this page. The Member App asks you to agree to each new version before you continue.",
          `Version 1.0, set to take effect ${formatDate(V1_EFFECTIVE_DATE, "long")}: the first version, covering the Website only. Version 2.0 replaced it before that date.`,
          `Version 2.0, effective ${formatDate(V2_0_EFFECTIVE_DATE, "long")}: adds the Member App, covering your account and Google sign-in, study data and progress, the Active Device and its device log, watermarks on Reviewer PDF pages, Access Passes and grants, the Member App’s analytics, and Privacy Requests.`,
          `Version ${PRIVACY_POLICY_VERSION}, effective ${formatDate(EFFECTIVE_DATE, "long")}: adds payments and payment records (section 9), including that we keep payment records as the tax rules require. A draft, pending legal review.`,
        ],
      },
    ],
  };
}
