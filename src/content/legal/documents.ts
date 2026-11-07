import { privacyPolicy } from "@/content/legal/privacy";
import { termsOfUse } from "@/content/legal/terms";
import type { LegalDocument } from "@/content/legal/types";

/**
 * Every legal document, in the order the switcher shows them, written with the
 * public contact email from the Website settings.
 */
export function legalDocuments(contactEmail: string): LegalDocument[] {
  return [privacyPolicy(contactEmail), termsOfUse(contactEmail)];
}
