import * as mockImpl from "@/services/catalogue.mock";
import type { Exam, WebsiteSettings } from "@/services/catalogue.types";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue Service Seam. Every Website page and component reads Exams and
// Website settings from here, and never imports the seed. This module is a thin
// SELECTOR, built like src/services/customers.ts. Phase 1 has only the in-memory
// mock arm. Phase 2 adds the Drizzle arm (catalogue.db.ts, chosen when a
// DATABASE_URL is configured) with no page changes. See docs/adr/0003 and
// docs/adr/0006.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The seam's public contract. Each implementation is checked against it below,
 * so the mock and (from Phase 2) the database arm can never drift apart.
 */
interface CatalogueService {
  /** Every Exam with its Subjects, in seed order. */
  listExams(): Promise<Exam[]>;
  /** Case-insensitive. Null when the code is unknown or blank. */
  getExamByCode(code: string): Promise<Exam | null>;
  getWebsiteSettings(): Promise<WebsiteSettings>;
}

const impl: CatalogueService = mockImpl;

export const listExams = impl.listExams;
export const getExamByCode = impl.getExamByCode;
export const getWebsiteSettings = impl.getWebsiteSettings;
