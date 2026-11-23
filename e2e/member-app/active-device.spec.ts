import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import {
  agreeToConsent,
  expectNoBlockingViolations,
  signInAgainOnThisDevice,
  signInAndOnboard,
  signInAsMember,
  startCountdown,
} from "./helpers";

// The Active Device on sample data (Phase 3, ticket 04; stories 107–109,
// 133f; ADR 0011): each Member uses the Member App on one device at a time.
// Every browser context is a device. Signing in ("Sign in as" on the sample
// data, the password box live) claims the device, as Google sign-in does, so
// a second context signing in as the same Member replaces the first. Signing
// in to the Admin claims nothing.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const welcome = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name: `Welcome, ${name}` });
const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const sessionEnded = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "You were signed in on another device" });
const useThisDevice = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Use the Member App on this device?" });

/** Another device: its own browser context, optionally with its own User-Agent. */
async function anotherDevice(browser: Browser, userAgent?: string) {
  const context = await browser.newContext(userAgent ? { userAgent } : {});
  return { context, page: await context.newPage() };
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("one Active Device per Member", () => {
  test("signing in on device B sends device A to “Session ended”; A signs back in, and B is then replaced", async ({
    page,
    browser,
  }) => {
    await signInAndOnboard(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();

    const phone = await anotherDevice(browser, ANDROID_CHROME);
    try {
      await signInAsMember(phone.page, "tester");
      await expect(welcome(phone.page, "Bea")).toBeVisible();

      // Device A's next request lands on "Session ended", outside the shell.
      await memberNav(page)
        .getByRole("link", { name: /Library/ })
        .click();
      await expect(page).toHaveURL(/\/app\/device\?next=%2Fapp%2Flibrary$/);
      await expect(sessionEnded(page)).toBeVisible();
      await expect(page.getByText("SESSION ENDED", { exact: true })).toBeVisible();
      await expect(page.getByText(/^NEW DEVICE · Chrome on Android · Today, /)).toBeVisible();
      await expect(page.getByRole("navigation")).toHaveCount(0);
      await expect(page).toHaveTitle(/^Session ended · /);
      await expectNoBlockingViolations(page);

      // Every Member App address sends it back here until it signs in again.
      await page.goto(paths.memberApp.account);
      await expect(page).toHaveURL(/\/app\/device\?next=%2Fapp%2Faccount$/);
      await expect(sessionEnded(page)).toBeVisible();

      await signInAgainOnThisDevice(page, "tester");
      await expect(page).toHaveURL(/\/app\/account$/);
      await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();

      // Now device B is the one replaced.
      await phone.page.reload();
      await expect(phone.page).toHaveURL(/\/app\/device\?next=%2Fapp$/);
      await expect(sessionEnded(phone.page)).toBeVisible();
    } finally {
      await phone.context.close();
    }
  });

  test("signing out leaves the other device replaced, and signing in again claims this one", async ({
    page,
    browser,
  }) => {
    await signInAndOnboard(page, "tester");
    const phone = await anotherDevice(browser, ANDROID_CHROME);
    try {
      await signInAsMember(phone.page, "tester");
      await expect(welcome(phone.page, "Bea")).toBeVisible();
      await phone.page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
      await expect(phone.page).toHaveURL(/\/app\/sign-in$/);
    } finally {
      await phone.context.close();
    }

    // Signing out on the phone gave nothing back to device A.
    await page.reload();
    await expect(sessionEnded(page)).toBeVisible();

    await signInAgainOnThisDevice(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();
  });
});

test.describe("a session that never claimed this device", () => {
  test("signed in through the Admin, the Owner is asked to use the Member App here; the Admin itself never replaces the device", async ({
    page,
    browser,
  }) => {
    // Device A: the Owner uses the Member App.
    await signInAsMember(page, "owner");
    await agreeToConsent(page);
    await startCountdown(page);
    await expect(welcome(page, "Angel")).toBeVisible();

    // Device B: the Owner signs in to the Admin and uses it.
    const desk = await anotherDevice(browser);
    try {
      await signInToAdmin(desk.page, "owner", paths.admin.users);
      await expect(desk.page).toHaveURL(/\/admin\/users$/);

      // Using the Admin on another device didn't replace device A.
      await page.reload();
      await expect(welcome(page, "Angel")).toBeVisible();

      // The same session in the Member App: one tap, naming the device it replaces.
      await desk.page.goto(paths.memberApp.library);
      await expect(desk.page).toHaveURL(/\/app\/device\?next=%2Fapp%2Flibrary$/);
      await expect(useThisDevice(desk.page)).toBeVisible();
      await expect(desk.page.getByText(/^ACTIVE NOW · .+ · Today, /)).toBeVisible();
      await expect(desk.page).toHaveTitle(/^Use this device · /);
      await expectNoBlockingViolations(desk.page);

      await desk.page.getByRole("button", { name: "Use the Member App on this device" }).click();
      await expect(desk.page).toHaveURL(/\/app\/library$/);
      await expect(
        desk.page.getByRole("heading", { level: 1, name: "Subjects and topics" }),
      ).toBeVisible();

      // Confirming replaced device A.
      await page.reload();
      await expect(sessionEnded(page)).toBeVisible();

      // The Admin keeps working on both devices.
      await desk.page.goto(paths.admin.users);
      await expect(desk.page).toHaveURL(/\/admin\/users$/);
    } finally {
      await desk.context.close();
    }
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("“Session ended” has no serious accessibility issues and doesn't scroll sideways", async ({
    page,
    browser,
  }) => {
    await signInAndOnboard(page, "tester");
    const laptop = await anotherDevice(browser);
    try {
      await signInAsMember(laptop.page, "tester");
      await expect(welcome(laptop.page, "Bea")).toBeVisible();
    } finally {
      await laptop.context.close();
    }

    await page.reload();
    await expect(sessionEnded(page)).toBeVisible();
    await expectNoBlockingViolations(page);
  });
});
