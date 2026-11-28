import { describe, expect, it } from "vitest";

import { currentLegalVersions } from "@/content/legal/documents";

import { consentStatus } from "./consent";

// The consent version check (spec, Phase 3 → Consent; stories 82, 83, 133e):
// the current Terms and Privacy versions against the Member's latest
// agreement. Any difference asks again, whichever way the version moved.
const CURRENT = { terms: "2.0", privacy: "2.0" };

describe("consentStatus", () => {
  it("is ok when the latest agreement has both current versions", () => {
    expect(consentStatus(CURRENT, { termsVersion: "2.0", privacyVersion: "2.0" })).toBe("ok");
  });

  it("is first-time when the Member has never agreed", () => {
    expect(consentStatus(CURRENT, null)).toBe("first-time");
  });

  it("is terms-changed when only the Terms version differs", () => {
    expect(consentStatus(CURRENT, { termsVersion: "1.0", privacyVersion: "2.0" })).toBe(
      "terms-changed",
    );
  });

  it("is privacy-changed when only the Privacy version differs", () => {
    expect(consentStatus(CURRENT, { termsVersion: "2.0", privacyVersion: "1.0" })).toBe(
      "privacy-changed",
    );
  });

  it("is both-changed when both versions differ", () => {
    expect(consentStatus(CURRENT, { termsVersion: "1.0", privacyVersion: "1.0" })).toBe(
      "both-changed",
    );
  });

  it("asks again when a version went back, not only forward", () => {
    expect(consentStatus(CURRENT, { termsVersion: "2.1", privacyVersion: "2.0" })).toBe(
      "terms-changed",
    );
  });

  it("compares versions exactly, so 2.0 and 2.00 aren't the same version", () => {
    expect(consentStatus(CURRENT, { termsVersion: "2.0", privacyVersion: "2.00" })).toBe(
      "privacy-changed",
    );
  });
});

describe("consentStatus with other current versions", () => {
  it("asks everyone who agreed to 2.0 again once the Terms are 2.1", () => {
    const bumped = { terms: "2.1", privacy: "2.0" };
    expect(consentStatus(bumped, { termsVersion: "2.0", privacyVersion: "2.0" })).toBe(
      "terms-changed",
    );
    expect(consentStatus(bumped, { termsVersion: "2.1", privacyVersion: "2.0" })).toBe("ok");
  });
});

// Legal v2.2 (Phase 5, ticket 06): the Terms add Courses sold separately,
// so every Member who agreed to v2.1 is asked once more, and only once. The
// Privacy Policy stays at v2.1 (Legal v2.1: Phase 4, ticket 13).
describe("consentStatus with the current documents (Legal v2.2)", () => {
  const current = currentLegalVersions();

  it("has the Terms at 2.2 and the Privacy Policy at 2.1", () => {
    expect(current).toEqual({ terms: "2.2", privacy: "2.1" });
  });

  it("asks a Member who agreed to v2.1 to agree again, to the Terms", () => {
    expect(consentStatus(current, { termsVersion: "2.1", privacyVersion: "2.1" })).toBe(
      "terms-changed",
    );
  });

  it("asks a Member who agreed to v2.0 to agree again, to both", () => {
    expect(consentStatus(current, { termsVersion: "2.0", privacyVersion: "2.0" })).toBe(
      "both-changed",
    );
  });

  it("doesn't ask a Member who agreed to v2.2 again", () => {
    expect(consentStatus(current, { termsVersion: "2.2", privacyVersion: "2.1" })).toBe("ok");
  });
});
