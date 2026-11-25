import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { passEndDate } from "../../src/lib/member-app/access";
import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, SKIP_LIVE, signInAndOnboard } from "./helpers";

// Buying with the payments fake on sample data (Phase 4, ticket 03; stories
// 135–140): a Member with no CE access picks CE 3 months and GCash, Pays,
// waits on Confirming payment, clicks "Simulate paid", sees the Paid screen
// with the date their access ends, and opens CE content that was locked.
// Another picks Card and clicks "Simulate failed", and sees the card-declined
// copy with the way back to Plans. Live mode has no payments client here.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const DAY = 24 * 60 * 60 * 1000;
const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const LOCKED_QUIZ = "Quiz, locked: unlock with CE All-Access";

/** An Owner adds an email to the Beta Tester list in the Admin, in their own browser context. */
async function ownerAddsTester(browser: Browser, email: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.betaTesters);
    const testers = page.getByRole("region", { name: "BETA TESTERS" });
    await testers.getByLabel("GOOGLE ACCOUNT EMAIL").fill(email);
    await testers.getByRole("button", { name: "Add Beta Tester" }).click();
    await expect(testers.getByRole("status")).toHaveText(/ADDED/);
  } finally {
    await context.close();
  }
}

/**
 * Opens Plans on CE, picks a period and a method by their labels, as a Member
 * clicks them (each radio sits under its label), and Pays: off to Confirming
 * payment.
 */
async function payForCe(page: Page, period: string, method: string, price: string) {
  await page.goto(paths.memberApp.plansFor("CE"));
  const plans = page.getByRole("radiogroup", { name: /ALL-ACCESS/ });
  const methods = page.getByRole("radiogroup", { name: "PAY WITH" });
  // The row's price is the plainest part of its label to click.
  await plans.getByText(price, { exact: true }).click();
  await expect(plans.getByRole("radio", { name: new RegExp(`^${period}`) })).toBeChecked();
  await methods.getByText(method, { exact: true }).click();
  await expect(methods.getByRole("radio", { name: method, exact: true })).toBeChecked();
  await page.getByRole("button", { name: `Pay ${price} with PayMongo` }).click();
  await expect(page).toHaveURL(/\/app\/plans\/orders\/AYC-\d{5,}$/);
}

test.beforeEach(async ({ request }) => {
  test.skip(LIVE, SKIP_LIVE);
  await resetSampleData(request);
});

test("a Member buys CE 3 months with GCash, and opens locked CE content", async ({
  page,
  browser,
}) => {
  await ownerAddsTester(browser, "stranger@example.com");
  await signInAndOnboard(page, "stranger", "CE");
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  const lockedQuiz = page.getByRole("link", { name: LOCKED_QUIZ }).first();
  const quizHref = await lockedQuiz.getAttribute("href");
  expect(quizHref).toMatch(/^\/app\/library\/quiz\//);

  await payForCe(page, "3 months", "GCash", "₱1,299");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Waiting for PayMongo to confirm your GCash payment",
    }),
  ).toBeVisible();
  await expect(page.getByText(/CE ALL-ACCESS · 3 MONTHS · ₱1,299/)).toBeVisible();
  await expectNoBlockingViolations(page);

  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(page.getByText("✓ PAYMENT CONFIRMED")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "You’re in. Kaya mo ’to." }),
  ).toBeVisible();
  // 90 days from now, as a Manila date (the server paid it a moment ago).
  const until = passEndDate(new Date(Date.now() + 90 * DAY).toISOString());
  await expect(page.getByText(`It’s active until ${until}.`, { exact: false })).toBeVisible();
  await expectNoBlockingViolations(page);

  await page.getByRole("link", { name: "Start reviewing" }).click();
  await expect(page).toHaveURL(/\/app\/library$/);
  await expect(page.getByRole("link", { name: LOCKED_QUIZ })).toHaveCount(0);
  await page.goto(quizHref ?? "");
  await expect(page.getByRole("heading", { name: "Unlock with CE All-Access" })).toHaveCount(0);
});

test("a Card payment that fails shows the card-declined copy and the way back", async ({
  page,
}) => {
  await signInAndOnboard(page, "tester", "CE");

  await payForCe(page, "1 month", "Card", "₱499");
  await page.getByRole("button", { name: "Simulate failed" }).click();

  await expect(page.getByText("PAYMENT DIDN’T GO THROUGH")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Your card was declined" }),
  ).toBeVisible();
  await expect(
    page.getByText("You weren’t charged. Try again, or pay with QR Ph, GCash, or Maya instead."),
  ).toBeVisible();
  await expectNoBlockingViolations(page);

  await page.getByRole("link", { name: "Try another method" }).click();
  await expect(page).toHaveURL(/\/app\/plans\?exam=CE$/);
});
