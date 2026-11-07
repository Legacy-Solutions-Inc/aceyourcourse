// ─────────────────────────────────────────────────────────────────────────────
// The Website's legal documents (the Privacy Policy and Terms of Use), typed and
// versioned in the repo. Each version describes only what the Website does at
// that version: v1.0 is Website-only, and the Member App sections arrive as
// v2.0 at the Member App launch. The content is checked by
// src/content/legal/schema.ts in a test.
// ─────────────────────────────────────────────────────────────────────────────

export type LegalKind = "privacy" | "terms";

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
  /** "draft" until the client's lawyer has reviewed this version. */
  status: "draft" | "final";
  /** The "In short" points. */
  summary: string[];
  sections: LegalSection[];
}
