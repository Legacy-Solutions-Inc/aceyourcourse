import { z } from "zod";

import type { LegalDocument, LegalKind } from "@/content/legal/types";

// Validation for the legal documents. The content is fixed in code, so a test
// runs every document through this schema: a bad edit fails CI instead of
// publishing a broken or unnumbered policy.

const LEGAL_KINDS = ["privacy", "terms"] as const satisfies readonly LegalKind[];

const nonBlank = z.string().trim().min(1, "must not be blank");

/** "2026-12-01", and a real calendar day ("2026-02-30" isn't). */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const sectionSchema = z.object({
  id: z.string(),
  title: nonBlank,
  paragraphs: z.array(nonBlank).min(1, "must have at least one paragraph"),
});

export const legalDocumentSchema: z.ZodType<LegalDocument> = z.object({
  kind: z.enum(LEGAL_KINDS),
  title: nonBlank,
  description: nonBlank.max(160, "must be at most 160 characters"),
  version: z.string().regex(/^\d+\.\d+$/, "must be a version like 1.0"),
  effectiveDate: z.string().refine(isIsoDate, "must be a real date written YYYY-MM-DD"),
  status: z.enum(["draft", "final"]),
  summary: z.array(nonBlank).min(3, "must have 3 to 6 points").max(6, "must have 3 to 6 points"),
  sections: z
    .array(sectionSchema)
    .min(1, "must have at least one section")
    // The page numbers each section by its position and links to it by id, so
    // the ids run s1, s2, … in order. That also keeps them unique.
    .superRefine((sections, ctx) => {
      sections.forEach((section, index) => {
        const expected = `s${index + 1}`;
        if (section.id !== expected) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "id"],
            message: `section ${index + 1} must have the id "${expected}"`,
          });
        }
      });
    }),
});
