// ─────────────────────────────────────────────────────────────────────────────
// The legal documents (the Privacy Policy and Terms of Use), typed and
// versioned in the repo, shown on the Website and agreed to in the Member App.
// Each version describes only what Ace Your Course does at that version: v1.0
// was Website-only, and v2.0 adds the Member App sections. The current
// versions are what the Member App's consent screen asks Members to agree to
// (documents.ts). The content is checked by src/content/legal/schema.ts in a
// test.
// ─────────────────────────────────────────────────────────────────────────────

export type LegalKind = "privacy" | "terms";

/** The current Terms of Use and Privacy Policy versions, such as "2.0": what Members agree to. */
export interface LegalVersions {
  terms: string;
  privacy: string;
}

export interface LegalSection {
  /** The anchor: "s1" for the first section, "s2" for the second, and so on. */
  id: string;
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  kind: LegalKind;
  title: string;
  /** The page's meta description. */
  description: string;
  /** "1.0", "2.0" and so on. */
  version: string;
  /** ISO date (YYYY-MM-DD) the version takes effect. */
  effectiveDate: string;
  /**
   * The draft flag: "draft" until the client's lawyer has reviewed this
   * version, shown on the page as "Draft, pending legal review".
   */
  status: "draft" | "final";
  /** The "In short" points. */
  summary: string[];
  sections: LegalSection[];
}
