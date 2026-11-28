import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, SKIP_LIVE, signInAndOnboard } from "./helpers";

// Buying a Course with the payments fake on sample data (Phase 5, ticket 06;
// stories 169, 173, 180): Bea Tester, a CE All-Access Member, finds the
// separately sold "PSAD Masterclass" locked on Courses, follows "Unlock for
// ₱1,499" to CE's Plans page, opened at the Course in its One-time
// purchases, Pays with QR Ph, clicks "Simulate paid" and is told she owns
// it for good. Courses then shows it OWNED, its Lesson plays, the Plans page
// says "Owned · Watch", and her Order shows the Course's name in Billing and
// in the Admin's Orders list. Live mode has no payments client here.

const expect = baseExpect.configure({ timeout: 15_000 });

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const card = (page: Page, title: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { level: 3, name: title }) });

/** The Owner opens the Orders list with Test Orders shown, in their own browser context; gives what a row says. */
async function ownerSeesOrder(browser: Browser, reference: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.orders);
    // The fake's payments are Test Orders, shown only with "Include test orders".
    await page.getByRole("checkbox", { name: "Include test orders" }).check();
    await expect(page).toHaveURL(/tests=1/);
    const row = page
      .getByRole("region", { name: "Orders list" })
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: reference, exact: true }) });
    await expect(row).toContainText("PSAD Masterclass · Video course");
    await expect(row).toContainText("PAID");
  } finally {
    await context.close();
  }
}

test.beforeEach(async ({ request }) => {
  test.skip(LIVE, SKIP_LIVE);
  await resetSampleData(request);
});

test("Bea buys the PSAD Masterclass from Courses, owns it for good, and watches a Lesson", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await signInAndOnboard(page, "tester", "CE");
  await memberNav(page)
    .getByRole("link", { name: /Courses/ })
    .click();

  // Locked for her Access Pass: "Unlock for ₱1,499" opens CE's Plans at the Course.
  const psad = card(page, "PSAD Masterclass");
  await expect(psad.getByText(/LOCKED/)).toBeVisible();
  await psad.getByRole("link", { name: "Unlock for ₱1,499" }).click();
  await expect(page).toHaveURL(/\/app\/plans\?exam=CE&course=/);
  const oneTime = page.getByRole("radiogroup", { name: "ONE-TIME PURCHASE" });
  await expect(oneTime.getByRole("radio", { name: /^PSAD Masterclass/ })).toBeChecked();
  const summary = page.getByRole("region", { name: "ORDER SUMMARY" });
  await expect(summary).toContainText("PSAD Masterclass · Video course");
  await expect(summary).toContainText("ONE-TIME · NO EXPIRY");
  await expectNoBlockingViolations(page);

  // Pay with QR Ph (picked first), then the fake's Simulate paid.
  await page.getByRole("button", { name: "Pay ₱1,499 with PayMongo" }).click();
  await expect(page).toHaveURL(/\/app\/plans\/orders\/AYC-\d{5,}$/);
  const reference = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await expect(page.getByText(/PSAD MASTERCLASS · VIDEO COURSE · ₱1,499/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(page.getByText("✓ PAYMENT CONFIRMED")).toBeVisible();
  await expect(page.getByText("You own it for good. It never expires.")).toBeVisible();
  await expectNoBlockingViolations(page);

  // Courses: OWNED, and its first Lesson plays.
  await memberNav(page)
    .getByRole("link", { name: /Courses/ })
    .click();
  const owned = card(page, "PSAD Masterclass");
  await expect(owned.getByText(/OWNED/)).toBeVisible();
  await owned.getByRole("link", { name: "Start course" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Beams in flexure" })).toBeVisible();
  const video = page.getByRole("figure", { name: "Sample video: Beams in flexure" });
  await video.getByRole("button", { name: "Play" }).click();
  await expect(video.getByRole("button", { name: "Pause" })).toBeVisible();

  // Plans now says she owns it, with no way to pay again.
  await page.goto(paths.memberApp.plansFor("CE"));
  await expect(page.getByRole("link", { name: "Owned · Watch" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^PSAD Masterclass/ })).toHaveCount(0);

  // Billing's history and the Admin's Orders list name the Course.
  await page.goto(paths.memberApp.billing);
  const orders = page.getByRole("list", { name: "Orders" });
  await expect(orders).toContainText("PSAD Masterclass · Video course");
  await expect(orders).toContainText(reference);
  await ownerSeesOrder(browser, reference);
});
