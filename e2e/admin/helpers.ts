import { type APIRequestContext, expect, type Page } from "@playwright/test";

import { SAMPLE_USERS, type SampleUserKey } from "../../src/services/mock/staff";

// Shared steps for the Admin specs (CONVENTIONS §6). Stage A signs in through
// the development-only "Sign in as" list of sample Users (CONVENTIONS §5),
// taken from the sample data itself so the two can't drift apart.

export { SAMPLE_USERS, type SampleUserKey };

/** A sample User's email. */
export function sampleEmail(who: SampleUserKey): string {
  const user = SAMPLE_USERS.find((candidate) => candidate.key === who);
  if (!user) throw new Error(`No sample User "${who}"`);
  return user.email;
}

/** The "Sign in as" list, opened from "Continue with Google" on the sign-in screen. */
export async function openSignInAs(page: Page, next?: string) {
  await page.goto(next ? `/admin/sign-in?next=${encodeURIComponent(next)}` : "/admin/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const list = page.getByRole("region", { name: "Sign in as" });
  await expect(list).toBeVisible();
  return list;
}

/** Signs in as one of the sample Users. */
export async function signInAs(page: Page, who: SampleUserKey, next?: string) {
  const list = await openSignInAs(page, next);
  await list
    .getByRole("button", { name: new RegExp(sampleEmail(who).replace(/\./g, "\\.")) })
    .click();
}

/**
 * Restores the sample data before a test. The reset route
 * (POST /api/dev/sample-data/reset) arrives in ticket 02, so until then this
 * does nothing, and ticket 01's specs are written to pass on data they have
 * already changed (an activated Invite stays activated).
 */
export async function resetSampleData(_request: APIRequestContext): Promise<void> {}
