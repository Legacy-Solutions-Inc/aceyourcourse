import { describe, expect, it } from "vitest";

import { paths } from "@/paths";

import { currentLegalVersions, legalDocuments } from "./documents";
import { legalDocumentSchema } from "./schema";
import type { LegalDocument, LegalKind } from "./types";

// Built with a test address, so a hardcoded email would show up as a failure.
const EMAIL = "help@example.com";

function byKind(kind: LegalKind, contactEmail = EMAIL): LegalDocument {
  const found = legalDocuments(contactEmail).find((document) => document.kind === kind);
  if (!found) throw new Error(`there is no ${kind} document`);
  return found;
}

const privacy = byKind("privacy");
const terms = byKind("terms");

/** Everything a Visitor reads in the document, as one string. */
const fullText = (document: LegalDocument) =>
  [
    document.title,
    ...document.summary,
    ...document.sections.flatMap((section) => [section.title, ...section.paragraphs]),
  ].join("\n");

/** A section's title and text, found by its title. */
const sectionText = (document: LegalDocument, title: string) => {
  const section = document.sections.find((candidate) => candidate.title === title);
  if (!section) throw new Error(`${document.kind} has no section titled ${title}`);
  return [section.title, ...section.paragraphs].join("\n");
};

const titles = (document: LegalDocument) => document.sections.map((section) => section.title);

describe.each([
  [privacy, 16],
  [terms, 14],
])("the $title", (document, sectionCount) => {
  it("passes the content schema", () => {
    expect(legalDocumentSchema.safeParse(document).error?.issues ?? []).toEqual([]);
  });

  it("is version 2.1, effective 26 Nov 2026, and a draft pending legal review", () => {
    expect(document).toMatchObject({
      version: "2.1",
      effectiveDate: "2026-11-26",
      status: "draft",
    });
  });

  it(`has ${sectionCount} numbered sections and a 6-point summary`, () => {
    expect(document.sections.map((section) => section.id)).toEqual(
      Array.from({ length: sectionCount }, (_, index) => `s${index + 1}`),
    );
    expect(document.summary).toHaveLength(6);
  });

  it("covers the Member App, in its summary and description too", () => {
    expect(fullText(document)).toContain("Member App");
    expect(document.description).toContain("Member App");
    expect(document.summary.join(" ")).toContain("Member App");
  });

  // An Access Pass isn't a subscription, a Payment Acknowledgement isn't a
  // receipt, and the mockup's draft addresses were never real.
  it.each([
    "subscription",
    "receipt",
    "Billing",
    "privacy@aceyourcourse.ph",
    "support@aceyourcourse.ph",
  ])("doesn't mention %j", (term) => {
    expect(fullText(document).toLowerCase()).not.toContain(term.toLowerCase());
    expect(document.description.toLowerCase()).not.toContain(term.toLowerCase());
  });

  // v2.1 covers payments (Phase 4), so the v2.0 promise of a new version is kept.
  it("covers payments through PayMongo, and no longer says the Member App doesn't take them", () => {
    expect(fullText(document)).toContain("PayMongo");
    expect(fullText(document)).not.toMatch(/doesn’t take payments yet/);
  });

  it("uses the contact email from the Website settings", () => {
    expect(fullText(document)).toContain(EMAIL);
    expect(fullText(byKind(document.kind, "other@example.com"))).not.toContain(EMAIL);
    expect(fullText(document)).not.toContain("aceyourcourseinc@gmail.com");
  });

  it("dates its version history: 1.0 replaced before it took effect, 2.0, then 2.1 as a draft", () => {
    const history = document.sections.at(document.kind === "privacy" ? -1 : -2);
    const paragraphs = history?.paragraphs ?? [];
    expect(paragraphs).toContain(
      "Version 1.0, set to take effect 1 December 2026: the first version, covering the Website only. Version 2.0 replaced it before that date.",
    );
    const v20 = paragraphs.find((paragraph) => paragraph.startsWith("Version 2.0,"));
    expect(v20).toMatch(/^Version 2\.0, effective 17 November 2026: adds the Member App/);
    expect(v20).not.toContain("draft");
    expect(paragraphs.at(-1)).toMatch(/^Version 2\.1, effective 26 November 2026: adds payments/);
    expect(paragraphs.at(-1)).toMatch(/A draft, pending legal review\.$/);
  });

  it("says the Member App asks everyone to agree again to each new version", () => {
    expect(fullText(document)).toMatch(/Member App asks you to agree to each new version/);
  });
});

describe("the Privacy Policy", () => {
  const text = fullText(privacy);

  it("keeps the Website sections, then the Member App sections, then the shared ones", () => {
    expect(titles(privacy)).toEqual([
      "Who we are and how to reach us",
      "What the Website collects",
      "Browser storage on the Website",
      "Your Member App account and Google sign-in",
      "Your study data and progress",
      "Your Active Device and its device log",
      "Watermarks on Reviewer PDF pages",
      "Access Passes and grants",
      "Payments and payment records",
      "Analytics in the Member App",
      "Why we use it, and for how long",
      "Who processes it, and where",
      "Buying on the Marketplaces",
      "Your rights",
      "Privacy Requests: a copy of your data, or deleting your account",
      "Changes and version history",
    ]);
    expect(sectionText(privacy, "Who we are and how to reach us")).toContain(
      "Sections 2 and 3 are about the Website, and sections 4 to 10 and 15 are about the Member App.",
    );
  });

  it("describes the Website's anonymous, cookieless analytics of page views and Marketplace clicks", () => {
    const collects = sectionText(privacy, "What the Website collects");
    expect(collects).toMatch(/anonymous analytics/);
    expect(collects).toMatch(/cookieless/);
    expect(collects).toMatch(/each page you view/);
    expect(collects).toMatch(/click through to one of our Marketplace stores/);
    expect(collects).toMatch(/never saved on your device/);
    expect(collects).toMatch(/discards your IP address/);
    expect(collects).toMatch(/no profile of you is created/);
  });

  it("says there are no accounts or payments on the Website", () => {
    const collects = sectionText(privacy, "What the Website collects");
    expect(collects).toMatch(/no accounts, no sign-in, no forms, no cart/);
    expect(collects).toMatch(/no payments/);
  });

  it("discloses the announcement bar's local storage, and no cookies on the Website", () => {
    const storage = sectionText(privacy, "Browser storage on the Website");
    expect(storage).toMatch(/The Website sets no cookies/);
    expect(storage).toContain("ayc.announcement.dismissed");
  });

  it("covers the Member App account: Google sign-in, sign-in cookies, consent and the Beta Tester list", () => {
    const account = sectionText(privacy, "Your Member App account and Google sign-in");
    expect(account).toMatch(/sign in to the Member App with your Google account/);
    expect(account).toMatch(/your name, your email address/);
    expect(account).toMatch(/never receive your Google password/);
    expect(account).toMatch(/Member ID/);
    expect(account).toMatch(/cookies in your browser that keep you signed in/);
    expect(account).toMatch(/keep the version of each that you agreed to, and when/);
    expect(account).toMatch(/Beta Testers/);
  });

  it("covers study data and progress, kept when access ends", () => {
    const study = sectionText(privacy, "Your study data and progress");
    expect(study).toMatch(/Target Exams/);
    expect(study).toMatch(/“Got it” or “Review again”/);
    expect(study).toMatch(/best scores/);
    expect(study).toMatch(/Reviewer PDF pages you’ve viewed/);
    expect(study).toMatch(/study streak/);
    expect(study).toMatch(/stays when your access to an exam ends/);
    expect(study).toMatch(/deleted when your account is deleted \(section 15\)/);
    expect(privacy.sections[14]?.title).toBe(
      "Privacy Requests: a copy of your data, or deleting your account",
    );
  });

  it("covers the Active Device, its hashed device cookie and the device log", () => {
    const device = sectionText(privacy, "Your Active Device and its device log");
    expect(device).toMatch(/one device at a time/);
    expect(device).toMatch(/“Session ended”/);
    expect(device).toMatch(/device cookie/);
    expect(device).toMatch(/a hash/);
    expect(device).toMatch(/log when it happened and a short device label/);
  });

  it("covers the watermark: email and Member ID stamped on every Reviewer PDF page", () => {
    const watermark = sectionText(privacy, "Watermarks on Reviewer PDF pages");
    expect(watermark).toMatch(
      /Every Reviewer PDF page you open .* stamped with your email address and Member ID/,
    );
    expect(watermark).toMatch(/We don’t store stamped copies/);
  });

  it("covers Access Passes, Free Preview and Staff grants", () => {
    const access = sectionText(privacy, "Access Passes and grants");
    expect(access).toMatch(/An Access Pass lets you open all of one exam’s study content/);
    expect(access).toMatch(/Free Preview/);
    expect(access).toMatch(/grant, extend or end Access Passes/);
    expect(access).toMatch(/who did it, when, and why/);
  });

  it("covers payments: PayMongo takes them, and card details are never stored", () => {
    const payments = sectionText(privacy, "Payments and payment records");
    expect(payments).toMatch(/PayMongo/);
    expect(payments).toMatch(/we never receive or store your card details/);
    expect(payments).toMatch(
      /we keep an Order: its reference, the Plan you chose, its price, the payment method you picked \(QR Ph, GCash, Maya or card\), when, its status \(such as paid or refunded\) and any refund, PayMongo’s ID for the payment, and your name and email/,
    );
    expect(sectionText(privacy, "Why we use it, and for how long")).toMatch(
      /We keep payment records to meet the tax rules \(section 9\)/,
    );
    expect(payments).toMatch(/Invoice Request/);
    expect(sectionText(privacy, "Access Passes and grants")).toMatch(/Section 9 explains/);
    expect(sectionText(privacy, "Who processes it, and where")).toMatch(/PayMongo/);
  });

  it("keeps payment records as the tax rules require, even after an account is deleted", () => {
    expect(sectionText(privacy, "Payments and payment records")).toContain(
      "We keep payment records (Orders and Invoice Requests) for as long as the tax rules require, even after your account is deleted.",
    );
    expect(
      sectionText(privacy, "Privacy Requests: a copy of your data, or deleting your account"),
    ).toMatch(/all your Member App data except your payment records \(section 9\)/);
    expect(privacy.summary.join(" ")).toMatch(/payment records the tax rules require/);
  });

  it("covers the Member App's analytics: anonymous, cookieless, no profiles, no link to the account", () => {
    const analytics = sectionText(privacy, "Analytics in the Member App");
    expect(analytics).toMatch(/anonymous, cookieless analytics/);
    expect(analytics).toMatch(/sets no cookies/);
    expect(analytics).toMatch(/no profile of you is created/);
    expect(analytics).toMatch(/aren’t linked to your account/);
  });

  it("covers Privacy Requests: a copy within 7 days, deletion within 30, no refund for paid access", () => {
    const requests = sectionText(
      privacy,
      "Privacy Requests: a copy of your data, or deleting your account",
    );
    expect(requests).toMatch(/within 7 days, we email you a file/);
    expect(requests).toMatch(/within 30 days, we delete your account and all your Member App data/);
    expect(requests).toMatch(/Access you paid for isn’t refunded/);
    expect(requests).toContain(EMAIL);
  });

  it("names the processors and where they are", () => {
    const processors = sectionText(privacy, "Who processes it, and where");
    expect(processors).toMatch(/PostHog/);
    expect(processors).toMatch(/Vercel.* Singapore/);
    expect(processors).toMatch(/Supabase, Inc\. runs our database in Singapore/);
    expect(processors).toMatch(/Google also provides the Member App’s sign-in/);
  });

  it("leaves Marketplace purchases to the platforms' own privacy policies", () => {
    const buying = sectionText(privacy, "Buying on the Marketplaces");
    expect(buying).toMatch(/Shopee, Lazada and TikTok Shop/);
    expect(buying).toMatch(/under its own privacy policy/);
  });

  it("sets out the rights under RA 10173, with the NPC complaint route", () => {
    const rights = sectionText(privacy, "Your rights");
    expect(text).toMatch(/Data Privacy Act of 2012 \(Republic Act No\. 10173\)/);
    expect(rights).toMatch(/access it, correct it, object/);
    expect(rights).toMatch(/complaint with the National Privacy Commission/);
    expect(rights).toMatch(/Section 15 explains/);
  });

  it("gives the contact email as the data protection contact", () => {
    expect(sectionText(privacy, "Who we are and how to reach us")).toContain(
      `Our data protection contact is ${EMAIL}.`,
    );
  });
});

describe("the Terms of Use", () => {
  it("keeps the Website sections, then the Member App sections, then the shared ones", () => {
    expect(titles(terms)).toEqual([
      "Using the Website",
      "Product information and “as of” figures",
      "Buying on the Marketplaces",
      "Intellectual property",
      "Links to other sites",
      "The Member App and your account",
      "One Active Device",
      "Access Passes, Free Preview and grants",
      "Payments and refunds",
      "Member App content and watermarks",
      "Ending your access, and deleting your account",
      "Limitation of liability",
      "Changes to these terms",
      "Governing law and contact",
    ]);
  });

  it("covers using the Website and the Member App", () => {
    expect(sectionText(terms, "Using the Website")).toMatch(/By using the Website, you agree/);
    expect(sectionText(terms, "Using the Website")).toMatch(/our Member App/);
  });

  it("shows prices and Shopee figures as of a date, with the listing authoritative", () => {
    const products = sectionText(terms, "Product information and “as of” figures");
    expect(products).toMatch(/Prices and Shopee figures .* are shown as of a date/);
    expect(products).toMatch(/The Marketplace listing is authoritative/);
  });

  it("leaves purchases to the Marketplaces' terms", () => {
    const buying = sectionText(terms, "Buying on the Marketplaces");
    expect(buying).toMatch(/Shopee, Lazada and TikTok Shop/);
    expect(buying).toMatch(/under its terms and policies/);
  });

  it("states the IPOPHIL registration, the copyright and that reproduction isn't allowed", () => {
    const ip = sectionText(terms, "Intellectual property");
    expect(ip).toMatch(/Intellectual Property Office of the Philippines \(IPOPHIL\)/);
    expect(ip).toMatch(/protected by copyright/);
    expect(ip).toMatch(/You may not reproduce/);
  });

  it("covers the Member App account: Google sign-in, for you alone, consent and the beta", () => {
    const account = sectionText(terms, "The Member App and your account");
    expect(account).toMatch(/sign in with your Google account/);
    expect(account).toMatch(/don’t share it/);
    expect(account).toMatch(/agree to these terms and our Privacy Policy/);
    expect(account).toMatch(/Beta Testers/);
  });

  it("covers one Active Device", () => {
    const device = sectionText(terms, "One Active Device");
    expect(device).toMatch(/one device at a time/);
    expect(device).toMatch(/log each change of Active Device/);
    expect(device).toMatch(/act under section 11/);
    expect(terms.sections[10]?.title).toBe("Ending your access, and deleting your account");
  });

  it("covers Access Passes, Free Preview and Staff grants", () => {
    const access = sectionText(terms, "Access Passes, Free Preview and grants");
    expect(access).toMatch(/Free Preview/);
    expect(access).toMatch(/until its end date, in Philippine time/);
    expect(access).toMatch(/your progress is kept/);
    expect(access).toMatch(/grant you an Access Pass/);
    expect(access).toMatch(/buy an Access Pass .* as section 9 explains/);
  });

  describe("Payments and refunds (v2.1)", () => {
    const payments = () => sectionText(terms, "Payments and refunds");

    it("is section 9, at the stable anchor the Plans page links to", () => {
      const section = terms.sections.find(({ title }) => title === "Payments and refunds");
      expect(section).toMatchObject({ id: "s9", anchor: "payments-and-refunds" });
      expect(paths.legal.paymentsAndRefunds).toBe("/legal/terms#payments-and-refunds");
    });

    it("prices Plans in pesos, VAT included if registered, paid through PayMongo", () => {
      expect(payments()).toMatch(/Philippine pesos/);
      expect(payments()).toMatch(/including VAT if we are registered for VAT/);
      expect(payments()).toMatch(/through PayMongo/);
      expect(payments()).toMatch(/Plan/);
    });

    it("starts access when the payment is confirmed, adding the days to an active Access Pass", () => {
      expect(payments()).toMatch(/access starts when your payment is confirmed/);
      expect(payments()).toMatch(
        /While you have an Access Pass for that exam, the new days are added to its current end date/,
      );
    });

    it("is in the summary: each Order paid once, no automatic renewal, refunds at our discretion", () => {
      expect(terms.summary).toContain(
        "An Access Pass opens one exam’s content until its end date. Each Order is paid once, in pesos, through PayMongo: nothing renews automatically, and refunds are at our discretion.",
      );
      expect(terms.description).toMatch(/payments and refunds/);
      expect(terms.description).toMatch(/Marketplace purchases/);
    });

    it("renews nothing automatically, and never stores card details", () => {
      expect(payments()).toMatch(/Nothing renews automatically/);
      expect(payments()).toMatch(/We never store your card details/);
    });

    it("has the placeholder refund rule, word for word, for the client and the lawyer", () => {
      expect(payments()).toContain(
        "Ask Support within 7 days of payment. Refunds are at our discretion. A refund removes that Order’s days.",
      );
    });
  });

  it("covers Member App content and its watermarks", () => {
    const content = sectionText(terms, "Member App content and watermarks");
    expect(content).toMatch(/protected by copyright/);
    expect(content).toMatch(/Don’t copy, download, record, print, share or resell/);
    expect(content).toMatch(/stamped with your email address and Member ID/);
    expect(content).toMatch(/Don’t remove, hide or crop out a watermark/);
  });

  it("covers deleting the account: within 30 days, no refund for paid access", () => {
    const ending = sectionText(terms, "Ending your access, and deleting your account");
    expect(ending).toMatch(/We delete it within 30 days/);
    expect(ending).toMatch(/Access you paid for isn’t refunded/);
    expect(ending).toMatch(/if you break these terms/);
  });

  it("covers external links, changes and Philippine law, with the contact", () => {
    expect(sectionText(terms, "Links to other sites")).toMatch(/links to sites we don’t run/);
    expect(sectionText(terms, "Changes to these terms")).toMatch(/We may update these terms/);
    const law = sectionText(terms, "Governing law and contact");
    expect(law).toMatch(/laws of the Republic of the Philippines/);
    expect(law).toContain(EMAIL);
  });
});

describe("legalDocuments", () => {
  it("lists each document once, in switcher order", () => {
    expect(legalDocuments(EMAIL).map((document) => document.kind)).toEqual(["privacy", "terms"]);
  });
});

// The consent check reads the current versions from the documents, so the
// version on the page and the version Members agree to can never differ.
describe("currentLegalVersions", () => {
  it("gives each document's own version", () => {
    expect(currentLegalVersions()).toEqual({ terms: terms.version, privacy: privacy.version });
  });
});
