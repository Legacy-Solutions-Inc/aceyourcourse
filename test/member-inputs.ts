import { currentLegalVersions } from "@/content/legal/documents";
import { hashDeviceToken } from "@/lib/member-app/device-token";
import { examPageDefaults, type CatalogueSeed } from "@/services/catalogue.schema";
import { claimDevice } from "@/services/member.mock";

import { withUnusedExam } from "./admin-inputs";

/**
 * An agreement to the current Terms of Use and Privacy Policy, read from the
 * documents: what a page test's Member records to get past consent, whatever
 * the versions are now.
 */
export const AGREED_TO_CURRENT = {
  termsVersion: currentLegalVersions().terms,
  privacyVersion: currentLegalVersions().privacy,
} as const;

/** The Official Exam Date the Target Exam tests give CE. */
export const CE_OFFICIAL = "2026-11-21";

/**
 * A seed edit for the Target Exam tests: CE gets an Official Exam Date (21
 * Nov 2026), every other Exam keeps none, and CHE is added with no Product,
 * so it's an Exam that isn't on the Website.
 */
export function withExamDates(seed: CatalogueSeed): void {
  withUnusedExam(seed);
  const page = seed.examPages.find((p) => p.examCode === "CE");
  if (page) page.officialExamDate = CE_OFFICIAL;
  else seed.examPages.push({ ...examPageDefaults("CE"), officialExamDate: CE_OFFICIAL });
}

/**
 * The device token the page tests' browser holds (Phase 3, ticket 04): set it
 * in the cookie jar with onThisDevice's claim, and the request is from the
 * Member's Active Device.
 */
export const TEST_DEVICE_TOKEN = "the-test-browsers-device-token";

/**
 * Makes the test browser (TEST_DEVICE_TOKEN) this Member's Active Device in
 * the sample data, as signing in to the Member App would.
 */
export async function onThisDevice(userId: string): Promise<void> {
  await claimDevice(userId, {
    tokenHash: hashDeviceToken(TEST_DEVICE_TOKEN),
    deviceLabel: "Chrome on Android",
  });
}

/** Real User-Agents for the Active Device's label: "Chrome on Android" and "Safari on iOS". */
export const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
export const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
