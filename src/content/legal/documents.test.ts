import { describe, expect, it } from "vitest";

import { legalDocuments } from "./documents";
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

const sectionText = (document: LegalDocument, id: string) => {
  const section = document.sections.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`${document.kind} has no section ${id}`);
  return [section.title, ...section.paragraphs].join("\n");
};

describe.each([privacy, terms])("the $title", (document) => {
  it("passes the content schema", () => {
    expect(legalDocumentSchema.safeParse(document).error?.issues ?? []).toEqual([]);
  });

  it("is version 1.0, effective 1 Dec 2026, and a draft for legal review", () => {
    expect(document).toMatchObject({
      version: "1.0",
      effectiveDate: "2026-12-01",
      status: "draft",
    });
  });

  it("has 8 numbered sections and a 5-point summary", () => {
    expect(document.sections.map((section) => section.id)).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "s7",
      "s8",
    ]);
    expect(document.summary).toHaveLength(5);
  });

  // Version 1.0 is Website-only. The Member App sections arrive as v2.0 at the
  // Member App launch, and the mockup's draft addresses were never real.
  it.each([
    "PayMongo",
    "Google sign-in",
    "watermark",
    "subscription",
    "Billing",
    "Member App",
    "privacy@aceyourcourse.ph",
    "support@aceyourcourse.ph",
  ])("doesn't mention %j", (term) => {
    expect(fullText(document).toLowerCase()).not.toContain(term.toLowerCase());
    expect(document.description.toLowerCase()).not.toContain(term.toLowerCase());
  });

  it("uses the contact email from the Website settings", () => {
    expect(fullText(document)).toContain(EMAIL);
    expect(fullText(byKind(document.kind, "other@example.com"))).not.toContain(EMAIL);
    expect(fullText(document)).not.toContain("aceyourcourseinc@gmail.com");
  });

  it("dates its version history from the effective date", () => {
    expect(sectionText(document, "s7") + sectionText(document, "s8")).toContain(
      "Version 1.0, effective 1 December 2026",
    );
  });
});

describe("the Privacy Policy", () => {
  const text = fullText(privacy);

  it("describes anonymous, cookieless analytics of page views and Marketplace clicks", () => {
    const collects = sectionText(privacy, "s2");
    expect(collects).toMatch(/anonymous analytics/);
    expect(collects).toMatch(/cookieless/);
    expect(collects).toMatch(/each page you view/);
    expect(collects).toMatch(/click through to one of our Marketplace stores/);
    expect(collects).toMatch(/never saved on your device/);
  });

  it("says IP addresses are discarded and no profiles are created", () => {
    expect(sectionText(privacy, "s2")).toMatch(/discards your IP address/);
    expect(sectionText(privacy, "s2")).toMatch(/no profile of you is created/);
  });

  it("says there are no accounts or payments on the Website", () => {
    expect(sectionText(privacy, "s2")).toMatch(/no accounts, no sign-in, no forms, no cart/);
    expect(sectionText(privacy, "s2")).toMatch(/no payments/);
  });

  it("discloses the announcement bar's local storage", () => {
    expect(sectionText(privacy, "s3")).toMatch(/sets no cookies/);
    expect(sectionText(privacy, "s3")).toContain("ayc.announcement.dismissed");
  });

  it("names the processors and where they are", () => {
    const processors = sectionText(privacy, "s5");
    expect(processors).toMatch(/PostHog/);
    expect(processors).toMatch(/Vercel.* Singapore/);
    expect(processors).toMatch(/Supabase.* Singapore/);
  });

  it("leaves Marketplace purchases to the platforms' own privacy policies", () => {
    expect(sectionText(privacy, "s6")).toMatch(/Shopee, Lazada and TikTok Shop/);
    expect(sectionText(privacy, "s6")).toMatch(/under its own privacy policy/);
  });

  it("sets out the rights under RA 10173, with the NPC complaint route", () => {
    expect(text).toMatch(/Data Privacy Act of 2012 \(Republic Act No\. 10173\)/);
    expect(sectionText(privacy, "s7")).toMatch(/access it, correct it, object/);
    expect(sectionText(privacy, "s7")).toMatch(/complaint with the National Privacy Commission/);
  });

  it("gives the contact email as the data protection contact", () => {
    expect(sectionText(privacy, "s1")).toContain(`Our data protection contact is ${EMAIL}.`);
  });
});

describe("the Terms of Use", () => {
  it("covers using the Website", () => {
    expect(sectionText(terms, "s1")).toMatch(/By using the Website, you agree/);
  });

  it("shows prices and Shopee figures as of a date, with the listing authoritative", () => {
    const products = sectionText(terms, "s2");
    expect(products).toMatch(/Prices and Shopee figures .* are shown as of a date/);
    expect(products).toMatch(/The Marketplace listing is authoritative/);
  });

  it("leaves purchases to the Marketplaces' terms", () => {
    expect(sectionText(terms, "s3")).toMatch(/Shopee, Lazada and TikTok Shop/);
    expect(sectionText(terms, "s3")).toMatch(/under its terms and policies/);
  });

  it("states the IPOPHIL registration, the copyright and that reproduction isn't allowed", () => {
    const ip = sectionText(terms, "s4");
    expect(ip).toMatch(/Intellectual Property Office of the Philippines \(IPOPHIL\)/);
    expect(ip).toMatch(/protected by copyright/);
    expect(ip).toMatch(/You may not reproduce/);
  });

  it("covers external links, changes and Philippine law, with the contact", () => {
    expect(sectionText(terms, "s5")).toMatch(/links to sites we don’t run/);
    expect(sectionText(terms, "s7")).toMatch(/We may update these terms/);
    expect(sectionText(terms, "s8")).toMatch(/laws of the Republic of the Philippines/);
    expect(sectionText(terms, "s8")).toContain(EMAIL);
  });
});

describe("legalDocuments", () => {
  it("lists each document once, in switcher order", () => {
    expect(legalDocuments(EMAIL).map((document) => document.kind)).toEqual(["privacy", "terms"]);
  });
});
