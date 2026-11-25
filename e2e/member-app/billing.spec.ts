import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, SKIP_LIVE, signInAndOnboard } from "./helpers";

// Billing and the Payment Acknowledgement on sample data with the payments
// fake (Phase 4, ticket 06; stories 143, 144, 151u): a Member buys CE 3
// months ("Simulate paid"), opens Billing, sees their CE pass and the Paid
// Order, opens its Payment Acknowledgement and prints it. An Owner's business
// details, VAT-registered, then show on it. Live mode has no payments client
// here.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });

/** Buys CE 3 months with GCash and the fake's "Simulate paid". */
async function buyCeThreeMonths(page: Page) {
  await page.goto(paths.memberApp.plansFor("CE"));
  const plans = page.getByRole("radiogroup", { name: /ALL-ACCESS/ });
  await plans.getByText("₱1,299", { exact: true }).click();
  await expect(plans.getByRole("radio", { name: /^3 months/ })).toBeChecked();
  await page.getByRole("button", { name: "Pay ₱1,299 with PayMongo" }).click();
  await expect(page).toHaveURL(/\/app\/plans\/orders\/AYC-\d{5,}$/);
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(page.getByText("✓ PAYMENT CONFIRMED")).toBeVisible();
}

/** An Owner saves the business details, VAT-registered, in their own browser context. */
async function ownerSavesBusinessDetails(browser: Browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.settings);
    const business = page.getByRole("form", { name: "BUSINESS DETAILS" });
    await business.getByLabel("BUSINESS NAME").fill("Ace Your Course Review Center");
    await business.getByLabel("ADDRESS").fill("Iloilo City, Iloilo");
    await business.getByLabel("TIN (OPTIONAL)").fill("123456789000");
    await business.getByRole("radio", { name: "Yes" }).check();
    await business.getByRole("button", { name: "Save details" }).click();
    await expect(business.getByRole("status")).toHaveText("✓ SAVED · ON EVERY ACKNOWLEDGEMENT");
  } finally {
    await context.close();
  }
}

test.beforeEach(async ({ request }) => {
  test.skip(LIVE, SKIP_LIVE);
  await resetSampleData(request);
});

test("a Member who bought CE 3 months sees it in Billing, opens the Acknowledgement and prints it", async ({
  page,
}) => {
  await signInAndOnboard(page, "tester", "CE");
  await buyCeThreeMonths(page);

  await memberNav(page)
    .getByRole("link", { name: /Billing/ })
    .click();
  await expect(page).toHaveURL(/\/app\/billing$/);
  await expect(page.getByRole("heading", { level: 1, name: "Plans and purchases" })).toBeVisible();
  const access = page.getByRole("region", { name: "Access" });
  await expect(access.getByRole("heading", { name: "CE All-Access" })).toBeVisible();
  await expect(access.getByText("ACTIVE")).toBeVisible();
  const order = page.getByRole("list", { name: "Orders" }).getByRole("listitem").first();
  await expect(order).toContainText("CE All-Access · 3 months");
  await expect(order).toContainText("PAID");
  await expect(order).toContainText("TEST");
  await expectNoBlockingViolations(page);

  await order.getByRole("link", { name: /^Payment Acknowledgement for AYC-/ }).click();
  await expect(page).toHaveURL(/\/app\/billing\/AYC-\d{5,}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Payment Acknowledgement" }),
  ).toBeVisible();
  await expect(page.getByText("This is not an official invoice")).toBeVisible();
  const document = page.getByRole("article", { name: /^Payment Acknowledgement AYC-/ });
  await expect(document.getByText("Ace Your Course", { exact: true })).toBeVisible();
  await expect(document.getByText("TEST PAYMENT · NO REAL MONEY")).toBeVisible();
  await expect(document.getByText("Prices include VAT")).toHaveCount(0);
  await expectNoBlockingViolations(page);

  await page.evaluate(() => {
    const counted = window as unknown as { printed: number };
    counted.printed = 0;
    window.print = () => {
      counted.printed += 1;
    };
  });
  await page.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
});

test("an Owner's business details, VAT-registered, show on the Member's Acknowledgement", async ({
  page,
  browser,
}) => {
  await ownerSavesBusinessDetails(browser);
  await signInAndOnboard(page, "tester", "CE");
  await buyCeThreeMonths(page);

  await page.goto(paths.memberApp.billing);
  await page
    .getByRole("list", { name: "Orders" })
    .getByRole("link", { name: /^Payment Acknowledgement for AYC-/ })
    .click();

  const document = page.getByRole("article", { name: /^Payment Acknowledgement AYC-/ });
  await expect(document.getByText("Ace Your Course Review Center")).toBeVisible();
  await expect(document.getByText("Iloilo City, Iloilo")).toBeVisible();
  await expect(document.getByText("TIN 123-456-789-000")).toBeVisible();
  await expect(document.getByText("Prices include VAT")).toBeVisible();
});

test("an Order that isn't Paid has no Acknowledgement, and its address answers not found", async ({
  page,
}) => {
  await signInAndOnboard(page, "tester", "CE");
  await page.goto(paths.memberApp.plansFor("CE"));
  await page.getByRole("button", { name: /^Pay .* with PayMongo$/ }).click();
  await expect(page).toHaveURL(/\/app\/plans\/orders\/AYC-\d{5,}$/);
  const reference = page.url().split("/").at(-1) ?? "";

  await page.goto(paths.memberApp.billing);
  const order = page.getByRole("list", { name: "Orders" }).getByRole("listitem").first();
  await expect(order).toContainText("PENDING");
  await expect(order.getByRole("link")).toHaveCount(0);

  const response = await page.goto(paths.memberApp.acknowledgement(reference));
  expect(response?.status()).toBe(404);
});
