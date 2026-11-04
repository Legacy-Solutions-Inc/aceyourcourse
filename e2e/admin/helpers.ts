import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  request as playwrightRequest,
} from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { bucketPublicUrl, CATALOGUE_BUCKET } from "../../src/lib/catalogue-bucket";
import { SESSION_COOKIE } from "../../src/lib/supabase/cookie-options";
import { paths } from "../../src/paths";
import { SAMPLE_USERS, type SampleUserKey } from "../../src/services/mock/staff";
import { BASE_URL, LIVE, SERVER } from "../server";

// Shared steps for the Admin specs (CONVENTIONS §6). The sample Users
// (CONVENTIONS §5) come from the sample data itself, so the two can't drift
// apart. How they sign in follows the server under test (e2e/server.ts):
// - sample mode (by default): the development-only "Sign in as" list.
// - live mode (CI, ticket 16): each is a password User on the runner's local
//   Supabase. The helper signs in with the password grant and writes the
//   session cookie into the browser exactly as the app's server client
//   would; the Staff Guard then reads it through Supabase, as after Google.
//   The app has no test route for this.

export { LIVE, SAMPLE_USERS, type SampleUserKey };

/** A sample User's email. */
export function sampleEmail(who: SampleUserKey): string {
  const user = SAMPLE_USERS.find((candidate) => candidate.key === who);
  if (!user) throw new Error(`No sample User "${who}"`);
  return user.email;
}

/** The "Sign in as" list, opened from "Continue with Google" on the sign-in screen. Sample mode only. */
export async function openSignInAs(page: Page, next?: string) {
  if (LIVE) throw new Error("The Sign in as list exists in sample mode only.");
  await page.goto(next ? `/admin/sign-in?next=${encodeURIComponent(next)}` : "/admin/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const list = page.getByRole("region", { name: "Sign in as" });
  await expect(list).toBeVisible();
  return list;
}

/** Signs in as one of the sample Users. */
export async function signInAs(page: Page, who: SampleUserKey, next?: string) {
  if (LIVE) return signInWithEmail(page, sampleEmail(who), next);
  const list = await openSignInAs(page, next);
  await list
    .getByRole("button", { name: new RegExp(sampleEmail(who).replace(/\./g, "\\.")) })
    .click();
}

/** Signs in with any email: the list's "Other email" field, or a password User live. */
export async function signInWithEmail(page: Page, email: string, next?: string) {
  if (LIVE) {
    // As after Google: Staff go on to next from the sign-in screen; anyone
    // else meets the Guard on the Overview (an Invite activates there).
    await signInLive(page.context(), email);
    await page.goto(paths.admin.signIn(next));
    if (new URL(page.url()).pathname === paths.admin.signIn()) {
      await page.goto(paths.admin.overview);
    }
    return;
  }
  const list = await openSignInAs(page, next);
  await list.getByLabel("Other email").fill(email);
  await list.getByRole("button", { name: "Sign in", exact: true }).click();
}

/**
 * Restores the sample data, and clears every Catalogue cache tag, before a
 * test: POST /api/dev/sample-data/reset. Live, the route asks for a Staff
 * User, so the Owner's session goes with it.
 */
export async function resetSampleData(request: APIRequestContext): Promise<void> {
  if (LIVE) {
    const owner = await playwrightRequest.newContext({ baseURL: BASE_URL });
    try {
      const cookie = (await sessionCookies(sampleEmail("owner")))
        .map(({ name, value }) => `${name}=${value}`)
        .join("; ");
      const response = await owner.post(paths.admin.resetSampleData, { headers: { cookie } });
      expect(response.status(), "the sample data reset route").toBe(204);
    } finally {
      await owner.dispose();
    }
    return;
  }
  const response = await request.post(paths.admin.resetSampleData);
  expect(response.status(), "the sample data reset route").toBe(204);
}

// ── Live sign-in (ticket 16) ────────────────────────────────────────────────

/** Every e2e password User's password: they exist only on CI's throwaway local Supabase. */
export const E2E_PASSWORD = "e2e-local-only-password";

/** The runner's local Supabase with its secret key (the admin API). */
export function localSupabaseAdmin() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } = SERVER.env;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Makes `email` a confirmed password User on the local Supabase, unless it is
 * one already. The global setup gives the sample Users their names.
 */
export async function ensurePasswordUser(email: string): Promise<void> {
  const { error } = await localSupabaseAdmin().auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (error && error.code !== "email_exists") throw error;
}

/** The session cookies a password sign-in as `email` sets, as the app's server client writes them. */
async function sessionCookies(email: string): Promise<{ name: string; value: string }[]> {
  await ensurePasswordUser(email);
  const cookies: { name: string; value: string }[] = [];
  const client = createServerClient(
    SERVER.env.NEXT_PUBLIC_SUPABASE_URL,
    SERVER.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SESSION_COOKIE,
      cookies: {
        getAll: () => [],
        setAll: (set) => {
          for (const { name, value } of set) if (value) cookies.push({ name, value });
        },
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({ email, password: E2E_PASSWORD });
  if (error) throw error;
  if (cookies.length === 0) throw new Error(`Signing in as ${email} set no session cookie.`);
  return cookies;
}

/** Signs the browser context in to the local Supabase as `email`. */
async function signInLive(context: BrowserContext, email: string) {
  await context.clearCookies();
  const cookies = await sessionCookies(email);
  await context.addCookies(
    cookies.map(({ name, value }) => ({ name, value, url: BASE_URL, sameSite: "Lax" as const })),
  );
}

// ── Uploads (tickets 06 and 17) ─────────────────────────────────────────────
// Sample mode keeps uploads in memory: the browser PUTs each file to the
// development-only route /api/dev/uploads/<id>, which serves it too. Live,
// the upload seam is Supabase Storage: the browser PUTs to a signed upload
// URL on the local Supabase, and the Website loads the bucket's public URL.

const SAMPLE_UPLOADS = "/api/dev/uploads/";
const SIGNED_UPLOADS = `/upload/sign/${CATALOGUE_BUCKET}/`;

/** Every one-time upload URL, for page.route. */
export const UPLOAD_URLS = LIVE ? "**/storage/v1/object/upload/sign/**" : "**/api/dev/uploads/**";

/** Whether a request is the browser sending a file to its one-time upload URL. */
export const isUploadPut = (request: { method(): string; url(): string }) =>
  request.method() === "PUT" && request.url().includes(LIVE ? SIGNED_UPLOADS : SAMPLE_UPLOADS);

/**
 * Where an upload is filed: the bucket path live (e.g.
 * "products/prd-005/….png"), or "uploads/<id>" in memory.
 */
export const uploadPathOf = (uploadUrl: string) => {
  const { pathname } = new URL(uploadUrl);
  return LIVE
    ? decodeURIComponent(pathname.split(SIGNED_UPLOADS)[1] ?? "")
    : `uploads/${pathname.split(SAMPLE_UPLOADS)[1] ?? ""}`;
};

/**
 * Where the Website loads an upload from: the bucket's public URL on the
 * Supabase the upload URL is on, or the development route's path.
 */
export const publicUrlOf = (uploadUrl: string) =>
  LIVE ? `${bucketPublicUrl(uploadUrl)}${uploadPathOf(uploadUrl)}` : new URL(uploadUrl).pathname;
