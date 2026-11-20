import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { manilaDate } from "../../src/lib/manila-time";
import { paths } from "../../src/paths";
import { SAMPLE_MEMBERS, type SampleMemberKey } from "../../src/services/mock/members";
import { LIVE } from "../server";

// Shared steps for the Member App specs (Phase 3). They run on the in-memory
// sample data, where the development-only "Sign in as" list stands in for
// Google: the sample Members come from the sample data itself, so the two
// can't drift apart. A live run (CI's local Supabase) has no such list, so
// these specs skip there; the callback, the gate and the seams are tested
// live at their own seams.

export { LIVE, SAMPLE_MEMBERS, type SampleMemberKey };

export const SKIP_LIVE = "The Member App specs sign in with “Sign in as”, on sample data only.";

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
  const list = await openSignInAs(page, next);
  await list
    .getByRole("button", { name: new RegExp(memberEmail(who).replace(/[.\\]/g, "\\$&")) })
    .click();
}

/** Signs in to the Member App with any email, through the list's "Other email" field. */
export async function signInWithEmail(page: Page, email: string, next?: string) {
  const list = await openSignInAs(page, next);
  await list.getByLabel("Other email").fill(email);
  await list.getByRole("button", { name: "Sign in", exact: true }).click();
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
  await expect(page.getByRole("region", { name: /board exam countdown/ })).toBeVisible();
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
