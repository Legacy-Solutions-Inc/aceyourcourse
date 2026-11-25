import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, SKIP_LIVE, signInAndOnboard } from "./helpers";

// Billing and the Payment Acknowledgement on sample data with the payments
// fake (Phase 4, ticket 06; stories 143, 144, 151u): a Member buys CE 3
// months ("Simulate paid"), opens Billing, sees their CE pass and the Paid
// Order, opens its Payment Acknowledgement and prints it. An Owner's business
// details, VAT-registered, then show on it. The Member requests the official
// invoice (ticket 08) and sees "Invoice requested"; an Owner filters Invoice
// requested, opens the Order and marks it sent, and the Member then sees
// "Invoice sent · check your email". Live mode has no payments client here.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });

/** Buys CE 3 months with GCash and the fake's "Simulate paid"; gives the Order's reference. */
async function buyCeThreeMonths(page: Page) {
  await page.goto(paths.memberApp.plansFor("CE"));
  const plans = page.getByRole("radiogroup", { name: /ALL-ACCESS/ });
  await plans.getByText("₱1,299", { exact: true }).click();
  await expect(plans.getByRole("radio", { name: /^3 months/ })).toBeChecked();
  await page.getByRole("button", { name: "Pay ₱1,299 with PayMongo" }).click();
  await expect(page).toHaveURL(/\/app\/plans\/orders\/AYC-\d{5,}$/);
  const reference = page.url().split("/").at(-1) ?? "";
  await page.getByRole("button", { name: "Simulate paid" }).click();
  await expect(page.getByText("✓ PAYMENT CONFIRMED")).toBeVisible();
  return reference;
}

/**
 * An Owner, in their own browser context, finds the Order under Invoice
 * requested (with the Test Orders) and marks it sent.
 */
async function ownerMarksInvoiceSent(browser: Browser, reference: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.orders);
    await page.getByRole("checkbox", { name: "Invoice requested" }).check();
    await expect(page).toHaveURL(/invoice=requested/);
    // The fake's payment is a Test Order, shown only with "Include test orders".
    await page.getByRole("checkbox", { name: "Include test orders" }).check();
    await expect(page).toHaveURL(/tests=1/);
    const list = page.getByRole("region", { name: "Orders list" });
    await list.getByRole("link", { name: reference, exact: true }).click();
    const request = page.getByRole("region", { name: "INVOICE REQUEST" });
    await expect(request).toContainText("Sample Builders Inc.");
    await expect(request).toContainText("12 Sample St, Jaro, Iloilo City");
    await expect(request).toContainText("123-456-789");
    await request.getByRole("button", { name: "Mark invoice sent" }).click();
    await expect(request.getByText(/^✓ SENT /)).toBeVisible();
  } finally {
    await context.close();
  }
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

test("a Member requests the official invoice; once an Owner marks it sent, Billing says so", async ({
  page,
  browser,
}) => {
  // Onboarding, a payment, the request, then an Owner's own sign-in: a long walk on a dev server.
  test.slow();
  await signInAndOnboard(page, "tester", "CE");
  const reference = await buyCeThreeMonths(page);

  await page.goto(paths.memberApp.acknowledgement(reference));
  const section = page.getByRole("region", { name: "Request official invoice" });
  await expect(section.getByRole("textbox", { name: "Name on the invoice" })).toHaveValue(
    "Bea Tester",
  );
  await section.getByRole("textbox", { name: "Name on the invoice" }).fill("Sample Builders Inc.");
  // A whitespace-only address passes the browser's check; the server refuses it.
  await section.getByRole("textbox", { name: "Address" }).fill("   ");
  await section.getByRole("button", { name: "Request invoice" }).click();
  await expect(section.getByText("Enter the address to put on the invoice.")).toBeVisible();

  await section.getByRole("textbox", { name: "Address" }).fill("12 Sample St, Jaro, Iloilo City");
  await section.getByRole("textbox", { name: "TIN (optional, for businesses)" }).fill("123456789");
  await section.getByRole("button", { name: "Request invoice" }).click();
  await expect(section.getByText("Invoice requested")).toBeVisible();
  await expect(section.getByRole("textbox")).toHaveCount(0);
  await expectNoBlockingViolations(page);

  await page.goto(paths.memberApp.billing);
  const order = page.getByRole("list", { name: "Orders" }).getByRole("listitem").first();
  await expect(order).toContainText("Invoice requested");
  await expect(order.getByText("Request official invoice")).toHaveCount(0);

  await ownerMarksInvoiceSent(browser, reference);

  await page.reload();
  await expect(order).toContainText("Invoice sent · check your email");
});

test("Billing's Paid Order opens the invoice form in place", async ({ page }) => {
  await signInAndOnboard(page, "tester", "CE");
  const reference = await buyCeThreeMonths(page);

  await page.goto(paths.memberApp.billing);
  const order = page.getByRole("list", { name: "Orders" }).getByRole("listitem").first();
  await order.getByText("Request official invoice").click();
  const form = order.getByRole("form", { name: `Request official invoice for ${reference}` });
  await form.getByRole("textbox", { name: "Address" }).fill("Jaro, Iloilo City");
  await form.getByRole("button", { name: "Request invoice" }).click();
  await expect(order).toContainText("Invoice requested");
  await expectNoBlockingViolations(page);
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
