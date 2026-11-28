import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { manilaDate } from "../../src/lib/manila-time";
import { paths } from "../../src/paths";
import { sampleCourseId } from "../../src/services/mock/courses";
import { SAMPLE_MEMBERS, type SampleMemberKey } from "../../src/services/mock/members";
import { E2E_PASSWORD, ensurePasswordUser, waitForHydration } from "../admin/helpers";
import { LIVE } from "../server";

// Shared steps for the Member App specs (Phase 3). The sample Members come
// from the sample data itself, so the two can't drift apart. How they sign in
// follows the server under test (e2e/server.ts):
// - sample mode (by default): the development-only "Sign in as" list stands
//   in for Google.
// - live mode (CI's local Supabase): each is a password User there (the
//   global setup and ensurePasswordUser), and signs in with the password box
//   under "Continue with Google", which `pnpm dev` offers live (tickets 19
//   and 20). Its action takes Google's path after sign-in: the beta gate,
//   claiming this device, then `next`. So the specs run unchanged on the
//   database, Supabase Auth and Storage. When the password box is removed,
//   this needs another way in, such as the Admin helpers' session cookie
//   followed by "Use the Member App on this device".

export { LIVE, SAMPLE_MEMBERS, type SampleMemberKey };

/** For a test that needs something only the sample data has. */
export const SKIP_LIVE = "This needs the sample data's development-only tools.";

/** A sample Member's email. */
export function memberEmail(who: SampleMemberKey): string {
  const member = SAMPLE_MEMBERS.find((candidate) => candidate.key === who);
  if (!member) throw new Error(`No sample Member "${who}"`);
  return member.email;
}

/** The "Sign in as" list, opened from "Continue with Google" on the Member App's sign-in screen. */
export async function openSignInAs(page: Page, next?: string) {
  if (LIVE) throw new Error("The Sign in as list exists in sample mode only.");
  await page.goto(paths.memberApp.signIn(next));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const list = page.getByRole("region", { name: "Sign in as" });
  await expect(list).toBeVisible();
  return list;
}

/** Signs in to the Member App as one of the sample Members. */
export async function signInAsMember(page: Page, who: SampleMemberKey, next?: string) {
  if (LIVE) return signInWithPassword(page, memberEmail(who), next);
  const list = await openSignInAs(page, next);
  await list
    .getByRole("button", { name: new RegExp(memberEmail(who).replace(/[.\\]/g, "\\$&")) })
    .click();
}

/** Signs in to the Member App with any email: the list's "Other email" field, or a password User live. */
export async function signInWithEmail(page: Page, email: string, next?: string) {
  if (LIVE) return signInWithPassword(page, email, next);
  const list = await openSignInAs(page, next);
  await list.getByLabel("Other email").fill(email);
  await list.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** The password box on the Member App's sign-in screen, which `pnpm dev` offers live. */
export const passwordBox = (page: Page) => page.getByRole("region", { name: "Development only" });

/** Live: signs in with the password box as `email`, made a password User first. */
async function signInWithPassword(page: Page, email: string, next?: string) {
  await ensurePasswordUser(email);
  await page.goto(paths.memberApp.signIn(next));
  // The sign-in screen arrives by a fresh page load: typing before hydration is lost.
  await waitForHydration(page);
  const box = passwordBox(page);
  await box.getByLabel("Email").fill(email);
  await box.getByLabel("Password").fill(E2E_PASSWORD);
  await box.getByRole("button", { name: "Sign in", exact: true }).click();
  // Longer than the default: the redirect can be the first Member App route a run compiles.
  await expect(page).not.toHaveURL(/\/app\/sign-in(\?|$)/, { timeout: 20_000 });
}

/**
 * On a device another one replaced ("Session ended"): signs in again, making
 * this device the Active Device, and goes on to where it was going. On the
 * sample data that's the screen's "Sign in on this device" ("Sign in as"
 * behind it). Live, that button goes to Google, which CI's local Supabase
 * doesn't have, so the device signs out and back in with the password box:
 * the same claim at sign-in.
 */
export async function signInAgainOnThisDevice(page: Page, who: SampleMemberKey) {
  if (!LIVE) {
    await page.getByRole("button", { name: "Sign in on this device" }).click();
    return;
  }
  const next = new URL(page.url()).searchParams.get("next") ?? undefined;
  await page.context().clearCookies();
  await signInWithPassword(page, memberEmail(who), next);
}

/** The consent screen's two boxes and its button. */
export function consentScreen(page: Page) {
  return {
    terms: page.getByRole("checkbox", { name: /I agree to the Terms of Use/ }),
    privacy: page.getByRole("checkbox", { name: /I’ve read the Privacy Policy/ }),
    agree: page.getByRole("button", { name: "Agree and continue" }),
  };
}

/** On the consent screen: ticks both boxes and agrees, going on to where the Member was going. */
export async function agreeToConsent(page: Page) {
  const consent = consentScreen(page);
  // Longer than the default: on a dev server the consent screen can be the
  // first Member App route a run compiles, inside the sign-in's redirect.
  await expect(page).toHaveURL(/\/app\/consent(\?|$)/, { timeout: 20_000 });
  await consent.terms.check();
  await consent.privacy.check();
  await consent.agree.click();
  await expect(page).not.toHaveURL(/\/app\/consent(\?|$)/);
}

/** Signs in as a sample Member who hasn't agreed yet, and agrees on the consent screen. */
export async function signInAndAgree(page: Page, who: SampleMemberKey, next?: string) {
  await signInAsMember(page, who, next);
  await agreeToConsent(page);
}

/** The Asia/Manila calendar date `days` from today, as YYYY-MM-DD: an Exam Date that many days away. */
export function daysFromToday(days: number): string {
  return manilaDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

/** Onboarding's heading on Home: what a Member with no Target Exam yet sees. */
export const onboardingHeading = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name: `Hi, ${name}. Let’s set you up.` });

/** The Exam pills and the date in onboarding and the add form. */
export function examForm(page: Page) {
  return {
    /** A pill: its radio button is visually hidden, so it's picked by its label. */
    pick: (code: string) => page.locator("label", { hasText: new RegExp(`^${code}\\b`) }).click(),
    pill: (code: string) => page.getByRole("radio", { name: new RegExp(`^${code} · `) }),
    date: page.getByLabel("Exam date", { exact: true }),
  };
}

/** In onboarding: picks an Exam, sets its date `days` from today, and starts the countdown. */
export async function startCountdown(page: Page, examCode = "ME", days = 30) {
  const form = examForm(page);
  await form.pick(examCode);
  await form.date.fill(daysFromToday(days));
  await page.getByRole("button", { name: "Start my countdown" }).click();
  // Longer than the default: the action then renders Home's dashboard, which
  // a loaded dev server has been seen to take over 15 s for (sample and live).
  await expect(page.getByRole("region", { name: /board exam countdown/ })).toBeVisible({
    timeout: 30_000,
  });
}

/** Signs in as a sample Member new to the Member App, agrees, and onboards with one Target Exam. */
export async function signInAndOnboard(page: Page, who: SampleMemberKey, examCode = "ME") {
  await signInAndAgree(page, who);
  await startCountdown(page, examCode);
}

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/** No serious or critical axe issues, and the page doesn't scroll sideways. */
export async function expectNoBlockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ""));
  const summary = blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);

  const sideways = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    return scrolling ? scrolling.scrollWidth - window.innerWidth : 0;
  });
  expect(sideways, "how far the page scrolls sideways, in px").toBeLessThanOrEqual(0);
}

/**
 * Buys the sample PSAD Masterclass (₱1,499) from CE's Plans page with the
 * payments fake: Pay with QR Ph, then "Simulate paid" (Phase 5, tickets 06
 * and 07). The fake's payment is a Test Order. Gives the Order's reference.
 */
export async function buyPsadMasterclass(page: Page): Promise<string> {
  await page.goto(paths.memberApp.plansForCourse("CE", sampleCourseId("PSAD Masterclass")));
  await page.getByRole("button", { name: "Pay ₱1,499 with PayMongo" }).click();
  await expect(page).toHaveURL(/\/app\/plans\/orders\/AYC-\d{5,}$/, { timeout: 15_000 });
  const reference = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(page.getByText("✓ PAYMENT CONFIRMED")).toBeVisible({ timeout: 15_000 });
  return reference;
}
