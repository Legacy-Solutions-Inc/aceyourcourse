import { PRIVACY_POLICY_VERSION, privacyPolicy } from "@/content/legal/privacy";
import { TERMS_OF_USE_VERSION, termsOfUse } from "@/content/legal/terms";
import type { LegalDocument, LegalVersions } from "@/content/legal/types";

/**
 * Every legal document, in the order the switcher shows them, written with the
 * public contact email from the Website settings.
 */
export function legalDocuments(contactEmail: string): LegalDocument[] {
  return [privacyPolicy(contactEmail), termsOfUse(contactEmail)];
}

/**
 * The current Terms of Use and Privacy Policy versions, read from the
 * documents themselves: the single source the Member App's consent check
 * compares each Member's latest agreement with (spec, Phase 3 → Consent).
 * Bumping a document's version asks every Member to agree again.
 */
export function currentLegalVersions(): LegalVersions {
  return { terms: TERMS_OF_USE_VERSION, privacy: PRIVACY_POLICY_VERSION };
}
