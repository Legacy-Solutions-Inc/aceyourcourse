import { serverEnv } from "@/env.server";
import { validateCatalogueSeed } from "@/services/catalogue.schema";
import type { Exam, WebsiteSettings } from "@/services/catalogue.types";
import { CATALOGUE_SEED } from "@/services/mock/catalogue";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory implementation of the Catalogue seam, and the Phase 1 default. It
// reads the typed seed, validated once at load so a bad edit fails loudly. The
// Member App switch comes from MEMBER_APP_LIVE, not the seed. See
// docs/adr/0003-mock-first-service-seam.md.
// ─────────────────────────────────────────────────────────────────────────────

const validation = validateCatalogueSeed(CATALOGUE_SEED);
if (!validation.success) {
  throw new Error(`Invalid catalogue seed — ${validation.errors.join("; ")}`);
}
const seed = validation.data;

// Callers get copies, so nothing a page does can change the seed for the next
// request (a database read returns fresh rows the same way).
const copy = <T>(value: T): T => structuredClone(value);

export async function listExams(): Promise<Exam[]> {
  return copy(seed.exams);
}

export async function getExamByCode(code: string): Promise<Exam | null> {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  const exam = seed.exams.find((e) => e.code === wanted);
  return exam ? copy(exam) : null;
}

export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  return { ...copy(seed.settings), memberAppLive: serverEnv.MEMBER_APP_LIVE === "true" };
}
