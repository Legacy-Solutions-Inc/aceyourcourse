import { type APIRequestContext, expect, type Page } from "@playwright/test";

import { bucketPublicUrl, CATALOGUE_BUCKET } from "../../src/lib/catalogue-bucket";
import { paths } from "../../src/paths";
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

/** Signs in with any email, through the list's "Other email" field. */
export async function signInWithEmail(page: Page, email: string, next?: string) {
  const list = await openSignInAs(page, next);
  await list.getByLabel("Other email").fill(email);
  await list.getByRole("button", { name: "Sign in", exact: true }).click();
}

/**
 * Restores the sample data, and clears every Catalogue cache tag, before a
 * test: POST /api/dev/sample-data/reset (sample mode only).
 */
export async function resetSampleData(request: APIRequestContext): Promise<void> {
  const response = await request.post(paths.admin.resetSampleData);
  expect(response.status(), "the sample data reset route").toBe(204);
}

// ── Uploads (ticket 17) ─────────────────────────────────────────────────────
// The e2e run is on the local database, so the upload seam is Supabase
// Storage: the browser PUTs each file to a signed upload URL on local
// Supabase, and the Website loads it from the bucket's public URL.

/** Every signed upload URL, for page.route. */
export const UPLOAD_URLS = "**/storage/v1/object/upload/sign/**";

/** Whether a request is the browser sending a file to its signed upload URL. */
export const isUploadPut = (request: { method(): string; url(): string }) =>
  request.method() === "PUT" && request.url().includes(`/upload/sign/${CATALOGUE_BUCKET}/`);

/** The bucket path a signed upload URL sends its file to, e.g. "products/prd-005/….png". */
export const uploadPathOf = (uploadUrl: string) =>
  decodeURIComponent(
    new URL(uploadUrl).pathname.split(`/upload/sign/${CATALOGUE_BUCKET}/`)[1] ?? "",
  );

/** Where the bucket serves the file at a path, on the Supabase the upload URL is on. */
export const publicUrlOf = (uploadUrl: string) =>
  `${bucketPublicUrl(uploadUrl)}${uploadPathOf(uploadUrl)}`;
