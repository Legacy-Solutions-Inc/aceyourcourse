import type { LegalVersions } from "@/content/legal/types";
import type { AgreedVersions } from "@/services/member.types";

/**
 * What the consent check answers: "ok" lets the Member through. Anything else
 * shows the consent screen, worded for why: never agreed, or which document
 * changed since they last did.
 */
export type ConsentStatus =
  "ok" | "first-time" | "terms-changed" | "privacy-changed" | "both-changed";

/**
 * Pure: the consent version check (spec, Phase 3 → Consent; stories 82, 83,
 * 133e). The current versions come from the legal documents
 * (src/content/legal/), and `latest` is the Member's latest agreement, or
 * null when they have never agreed. Versions are compared exactly, so any
 * change asks again, whichever way the number moved.
 */
export function consentStatus(
  current: LegalVersions,
  latest: AgreedVersions | null,
): ConsentStatus {
  if (!latest) return "first-time";
  const termsChanged = latest.termsVersion !== current.terms;
  const privacyChanged = latest.privacyVersion !== current.privacy;
  if (termsChanged && privacyChanged) return "both-changed";
  if (termsChanged) return "terms-changed";
  if (privacyChanged) return "privacy-changed";
  return "ok";
}
