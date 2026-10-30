import { describe, expect, it } from "vitest";

import { legalDocumentSchema } from "./schema";
import type { LegalDocument } from "./types";

function testDocument(overrides: Partial<LegalDocument> = {}): LegalDocument {
  return {
    kind: "privacy",
    title: "Privacy Policy",
    description: "How the Website handles data.",
    version: "1.0",
    effectiveDate: "2026-12-01",
    status: "draft",
    summary: ["One.", "Two.", "Three."],
    sections: [
      { id: "s1", title: "Who we are", paragraphs: ["We make reviewers."] },
      { id: "s2", title: "What we collect", paragraphs: ["Page views.", "Marketplace clicks."] },
    ],
    ...overrides,
  };
}

/** The validation issues for a document, as "path: message" lines. */
function issuesOf(document: unknown): string[] {
  const result = legalDocumentSchema.safeParse(document);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

const sections = (...ids: string[]) =>
  ids.map((id) => ({ id, title: `Section ${id}`, paragraphs: ["Text."] }));

describe("legalDocumentSchema", () => {
  it("accepts a valid document", () => {
    expect(issuesOf(testDocument())).toEqual([]);
    expect(issuesOf(testDocument({ kind: "terms", status: "final", version: "12.3" }))).toEqual([]);
  });

  it.each(["1", "v1.0", "1.0.0", "1.", ""])("rejects the version %j", (version) => {
    expect(issuesOf(testDocument({ version }))).toEqual(["version: must be a version like 1.0"]);
  });

  it.each(["2026-13-40", "2026-02-30", "2026-12-1", "1 Dec 2026", ""])(
    "rejects the effective date %j",
    (effectiveDate) => {
      expect(issuesOf(testDocument({ effectiveDate }))).toEqual([
        "effectiveDate: must be a real date written YYYY-MM-DD",
      ]);
    },
  );

  it("accepts a leap day only in a leap year", () => {
    expect(issuesOf(testDocument({ effectiveDate: "2028-02-29" }))).toEqual([]);
    expect(issuesOf(testDocument({ effectiveDate: "2027-02-29" }))).toHaveLength(1);
  });

  it("requires a version, an effective date and a status", () => {
    const { version: _v, effectiveDate: _e, status: _s, ...rest } = testDocument();
    expect(issuesOf(rest)).toEqual([
      "version: Required",
      "effectiveDate: Required",
      "status: Required",
    ]);
  });

  it("rejects an unknown kind or status", () => {
    expect(issuesOf({ ...testDocument(), kind: "cookies" })).toHaveLength(1);
    expect(issuesOf({ ...testDocument(), status: "approved" })).toHaveLength(1);
  });

  it("needs 3 to 6 summary points", () => {
    expect(issuesOf(testDocument({ summary: [] }))).toEqual(["summary: must have 3 to 6 points"]);
    expect(issuesOf(testDocument({ summary: ["One.", "Two."] }))).toEqual([
      "summary: must have 3 to 6 points",
    ]);
    expect(issuesOf(testDocument({ summary: Array.from({ length: 7 }, () => "Point.") }))).toEqual([
      "summary: must have 3 to 6 points",
    ]);
    expect(issuesOf(testDocument({ summary: ["One.", " ", "Three."] }))).toEqual([
      "summary.1: must not be blank",
    ]);
  });

  it("needs at least one section", () => {
    expect(issuesOf(testDocument({ sections: [] }))).toEqual([
      "sections: must have at least one section",
    ]);
  });

  it("rejects duplicate section ids", () => {
    expect(issuesOf(testDocument({ sections: sections("s1", "s1") }))).toEqual([
      'sections.1.id: section 2 must have the id "s2"',
    ]);
  });

  it("rejects a section id that isn't s1, s2, …", () => {
    expect(issuesOf(testDocument({ sections: sections("intro") }))).toEqual([
      'sections.0.id: section 1 must have the id "s1"',
    ]);
  });

  it("rejects sections numbered out of order", () => {
    expect(issuesOf(testDocument({ sections: sections("s2", "s1") }))).toEqual([
      'sections.0.id: section 1 must have the id "s1"',
      'sections.1.id: section 2 must have the id "s2"',
    ]);
  });

  it("rejects a section with no text", () => {
    expect(
      issuesOf(testDocument({ sections: [{ id: "s1", title: "Who we are", paragraphs: [] }] })),
    ).toEqual(["sections.0.paragraphs: must have at least one paragraph"]);
    expect(
      issuesOf(testDocument({ sections: [{ id: "s1", title: " ", paragraphs: ["Text."] }] })),
    ).toEqual(["sections.0.title: must not be blank"]);
  });

  it("keeps the meta description within 160 characters", () => {
    expect(issuesOf(testDocument({ description: "x".repeat(160) }))).toEqual([]);
    expect(issuesOf(testDocument({ description: "x".repeat(161) }))).toEqual([
      "description: must be at most 160 characters",
    ]);
  });
});
