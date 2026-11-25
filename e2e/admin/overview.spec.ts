import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// The Overview on sample data (ticket 11): what needs Staff today, each item
// linking to its fix. Adding a missing Lazada link lowers the count on the
// next load, and each quick action opens its new form.
//
// Phase 4, ticket 11: an Owner also sees the sales tiles, the paid-sales
// chart, the sidebar's PAID TODAY card, and the payment work first in Needs
// attention, each item opening the filtered Orders list; an Editor sees none
// of it. The sample Orders (timed from the reset) give three payment items:
// Paolo's AYC-10006 Pending an hour, Maria's AYC-10002 with an invoice to
// send, and Maria's AYC-10011 paid after expiry. A live database has none of
// them: its only Orders are the payments fake's Test Orders, which never count.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const DAY = 24 * 60 * 60 * 1000;
/** The Manila date `days` from today, as YYYY-MM-DD. Manila is UTC+8 all year. */
const manilaDay = (days: number) =>
  new Date(Date.now() + 8 * 60 * 60 * 1000 + days * DAY).toISOString().slice(0, 10);

/** The Owner's payment items the sample Orders give; none on a live database. */
const PAYMENT_ITEMS = LIVE ? 0 : 3;

const needsAttention = (page: Page) => page.getByRole("list", { name: "Needs attention" });
const quickAction = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Quick actions" }).getByRole("link", { name });

async function openOverview(page: Page) {
  await signInAs(page, "owner", paths.admin.overview);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Good (morning|afternoon|evening), Angel\.$/ }),
  ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("lists the shop-page links; adding CE flash cards' Lazada link lowers the count", async ({
  page,
}) => {
  await openOverview(page);
  await expect(page.getByText(`${3 + PAYMENT_ITEMS} things need you today.`)).toBeVisible();
  const links = needsAttention(page).getByRole("link", { name: /product links use the shop page/ });
  await expect(links).toContainText("16 product links use the shop page");

  await links.click();
  await expect(page).toHaveURL(/\/admin\/products\?missing=1$/);
  await expect(page.getByRole("link", { name: "Missing product links" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await page.goto(`${paths.admin.products}?missing=1&product=prd-001`);
  const editor = page.getByRole("complementary", { name: "Product editor" });
  await editor
    .getByRole("textbox", { name: "LAZADA · USING SHOP PAGE", exact: true })
    .fill("https://www.lazada.com.ph/products/ce-formula-flash-cards-i1.html");
  await editor.getByRole("button", { name: "Save product" }).click();
  await expect(editor.getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");

  await page.goto(paths.admin.overview);
  await expect(
    needsAttention(page).getByRole("link", { name: /product links use the shop page/ }),
  ).toContainText("15 product links use the shop page");
});

test("“Fix” opens the first Exam page whose search check isn't Good", async ({ page }) => {
  await openOverview(page);
  await needsAttention(page)
    .getByRole("link", { name: /exam page needs search fixes/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/exam-pages\?exam=cpa&section=seo$/);
  await expect(
    page.getByRole("complementary", { name: "Exam page editor" }).getByLabel("PAGE TITLE"),
  ).toBeVisible();
});

test("turning the promo banner on takes it off the list", async ({ page }) => {
  await openOverview(page);
  await needsAttention(page)
    .getByRole("link", { name: /Promo banner is off/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/exam-pages\?page=promo$/);
  // The seed banner's dates are fixed (it ended 11 Nov 2026), so dates around
  // today are saved first: from yesterday to more than 3 days out, so it isn't
  // listed as ending soon either.
  const editor = page.getByRole("complementary", { name: "Page editor" });
  const form = editor.getByRole("form", { name: "Home promo banner" });
  await form.getByLabel("STARTS ON").fill(manilaDay(-1));
  await form.getByLabel("ENDS ON").fill(manilaDay(10));
  await form.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByRole("status")).toHaveText("✓ SAVED · LIVE ON HOME");

  await editor.getByRole("switch", { name: "Show banner" }).click();
  // The status line comes from the server, so the switch's save has landed.
  await expect(editor.getByText(/^Status: ON · SHOWS /)).toBeVisible();

  await page.goto(paths.admin.overview);
  await expect(page.getByText(`${2 + PAYMENT_ITEMS} things need you today.`)).toBeVisible();
  await expect(needsAttention(page).getByRole("link", { name: /Promo banner/ })).toHaveCount(0);
});

for (const [name, url, form] of [
  ["Add product", /\/admin\/products\?product=new$/, "New product"],
  ["Add Review", /\/admin\/reviews\?review=new$/, "New review"],
  ["Add FAQ", /\/admin\/reviews\?tab=faqs&faq=new$/, "New question"],
] as const) {
  test(`“+ ${name}” opens its new form`, async ({ page }) => {
    await openOverview(page);
    await quickAction(page, name).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("form", { name: form })).toBeVisible();
  });
}

test.describe("an Owner's sales (Phase 4, ticket 11)", () => {
  test.beforeEach(() => {
    test.skip(LIVE, "The sample Orders are in the in-memory sample data only.");
  });

  const tile = (page: Page, label: RegExp) =>
    page.getByRole("list", { name: "Sales figures" }).getByRole("link", { name: label });

  test("sees the sales tiles, the chart and the PAID TODAY card, each opening its screen", async ({
    page,
  }) => {
    await openOverview(page);

    const tiles = page.getByRole("list", { name: "Sales figures" }).getByRole("link");
    await expect(tiles).toHaveCount(4);
    const paidToday = tile(page, /^PAID TODAY/);
    await expect(paidToday).toHaveAttribute("href", "/admin/orders?status=paid&range=7d");
    await expect(tile(page, /^PAID · [A-Z]+/)).toHaveAttribute("href", "/admin/orders?status=paid");
    await expect(tile(page, /^ACTIVE MEMBERS/)).toHaveAttribute(
      "href",
      "/admin/users?filter=active",
    );
    await expect(tile(page, /^ACCESS ENDING · 7 DAYS/)).toBeVisible();

    // The sidebar's card says the same money as the tile, and opens Orders.
    const card = page.getByRole("complementary").getByRole("link", { name: /^PAID TODAY/ });
    const amount = (await paidToday.textContent())?.match(/^PAID TODAY(−?₱[\d,]+)/)?.[1] ?? "";
    expect(amount).toMatch(/^−?₱[\d,]+$/);
    await expect(card).toContainText(amount);
    await expect(card).toContainText(/\d+ orders? · 1 pending$/);

    const chart = page.getByRole("region", { name: "Paid sales" });
    const days = chart.getByRole("table", { name: "Net paid by day" }).getByRole("row");
    await expect(chart.getByText(/^NET PAID · LAST 14 DAYS · /)).toBeVisible();
    await expect(days).toHaveCount(15);
    await expect(days.last()).toContainText(", today");
    await chart.getByRole("button", { name: "30 DAYS" }).click();
    await expect(chart.getByRole("button", { name: "30 DAYS" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(chart.getByText(/^NET PAID · LAST 30 DAYS · /)).toBeVisible();
    await expect(days).toHaveCount(31);

    await card.click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test("sees today's refunds taken off today's figure", async ({ page }) => {
    // Bea's and Lou's Orders were paid 48 and 38 minutes before the reset and
    // refunded 30 and 20 minutes before it; Maria's late one was paid 22 hours
    // before. Near Manila midnight they fall on other days.
    const hour = new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCHours();
    test.skip(hour < 1 || hour >= 22, "Today's sample payments straddle Manila midnight now.");
    await openOverview(page);

    await expect(tile(page, /^PAID TODAY/)).toHaveText(
      "PAID TODAY₱999+₱500 vs yesterday₱799 refunded",
    );
    await expect(
      page.getByRole("complementary").getByRole("link", { name: /^PAID TODAY/ }),
    ).toContainText("₱9992 orders · 1 pending");
  });

  test("opens the payments pending, the invoice requests to send and the Orders paid after expiry", async ({
    page,
  }) => {
    await openOverview(page);
    const rows = needsAttention(page).getByRole("link");
    await expect(rows.nth(0)).toContainText("1 payment pendingOldest is 1 hour old.");
    await expect(rows.nth(1)).toContainText("1 invoice request to send");
    await expect(rows.nth(2)).toContainText("1 Order paid after expiry");

    const orders = page
      .getByRole("region", { name: "Orders list" })
      .getByRole("table")
      .getByRole("link", { name: /^AYC-\d+$/ });
    for (const [row, url, references] of [
      [0, /\/admin\/orders\?status=pending$/, ["AYC-10006"]],
      [1, /\/admin\/orders\?range=all&invoice=requested$/, ["AYC-10002"]],
      [2, /\/admin\/orders\?status=paid&range=7d&late=1$/, ["AYC-10011"]],
    ] as const) {
      await page.goto(paths.admin.overview);
      await rows.nth(row).click();
      await expect(page).toHaveURL(url);
      await expect(orders).toHaveText([...references]);
    }
    await expect(page.getByRole("checkbox", { name: "Paid after expiry" })).toBeChecked();
  });
});

test("an Editor sees no sales tiles, chart, PAID TODAY card or payment items", async ({ page }) => {
  await signInAs(page, "editor", paths.admin.overview);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("3 things need you today.")).toBeVisible();

  await expect(page.getByRole("list", { name: "Sales figures" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Paid sales" })).toHaveCount(0);
  await expect(page.getByText("PAID TODAY")).toHaveCount(0);
  await expect(needsAttention(page).getByRole("link", { name: /payment|invoice/i })).toHaveCount(0);
  await expect(page.getByText(/₱/)).toHaveCount(0);
});

test("a signed-out visit is sent to sign-in, coming back to the Overview", async ({ page }) => {
  await page.goto(paths.admin.overview);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});
