import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData } from "../admin/helpers";
import {
  expectNoBlockingViolations,
  LIVE,
  memberEmail,
  signInAndOnboard,
  SKIP_LIVE,
} from "./helpers";

// Account and Support in the Member App (Phase 3, ticket 18; stories 110 and
// 113): the sample tester's profile from Google, their exams, what they
// agreed to, and Sign out from Account; Support's email and common questions.
// Their Privacy Requests, with the Owner's list, are in
// e2e/admin/privacy-requests.spec.ts.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const TESTER = memberEmail("tester");

const main = (page: Page) => page.getByRole("main");
const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });

test.skip(LIVE, SKIP_LIVE);

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test("Account shows the profile, the exams and what the Member agreed to", async ({ page }) => {
  await signInAndOnboard(page, "tester");
  await memberNav(page)
    .getByRole("link", { name: /Account/ })
    .click();
  await expect(page).toHaveURL(/\/app\/account$/);

  const profile = page.getByRole("region", { name: "Profile" });
  await expect(profile.getByText("Bea Tester")).toBeVisible();
  await expect(profile.getByText(`${TESTER} · Google`)).toBeVisible();
  await expect(profile.getByText(/^Signed in on this device only · /)).toBeVisible();
  await expect(page.getByRole("region", { name: "Your exams" })).toContainText(
    "Mechanical Engineering",
  );
  await expect(
    page.getByText(/^You agreed to Terms v2\.0 and Privacy v2\.0 on \d{1,2} \w{3} \d{4}\.$/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
    "href",
    paths.legal.privacy,
  );
});

test("Sign out on Account ends the session and returns to the sign-in screen", async ({ page }) => {
  await signInAndOnboard(page, "tester");
  await page.goto(paths.memberApp.account);

  await main(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in$/);
  await page.goto(paths.memberApp.account);
  await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp%2Faccount$/);
});

test("Support gives the contact email to write to, and the common questions", async ({ page }) => {
  await signInAndOnboard(page, "tester");
  await memberNav(page)
    .getByRole("link", { name: /Support/ })
    .click();
  await expect(page).toHaveURL(/\/app\/support$/);

  await expect(page.getByRole("heading", { level: 1, name: "Need help?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Email Support" })).toHaveAttribute(
    "href",
    /^mailto:[^?]+@[^?]+\?subject=AceYourCourse%20support$/,
  );
  const questions = page.getByRole("region", { name: "Common questions" });
  const devices = questions.getByText("Why was I signed out on my other device?");
  await expect(questions.getByText(/^Only one device can use the Member App/)).toBeHidden();
  await devices.click();
  await expect(questions.getByText(/^Only one device can use the Member App/)).toBeVisible();
});

test.describe("accessibility", () => {
  for (const size of [
    { name: "a desktop", viewport: { width: 1280, height: 800 } },
    { name: "a phone", viewport: { width: 375, height: 812 } },
  ] as const) {
    test.describe(`on ${size.name} (${size.viewport.width} px)`, () => {
      test.use({ viewport: size.viewport });

      test("no serious or critical violations on Account, with the deletion warning open, and Support", async ({
        page,
      }) => {
        await signInAndOnboard(page, "tester");
        await page.goto(paths.memberApp.account);
        await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
        await expectNoBlockingViolations(page);

        await main(page).getByRole("button", { name: "Delete my account" }).click();
        await expect(main(page).getByRole("group", { name: "Delete your account?" })).toBeVisible();
        await expectNoBlockingViolations(page);

        await page.goto(paths.memberApp.support);
        await expect(page.getByRole("heading", { level: 1, name: "Need help?" })).toBeVisible();
        await expectNoBlockingViolations(page);
      });
    });
  }
});
