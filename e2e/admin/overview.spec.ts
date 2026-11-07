import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The Overview on sample data (ticket 11): what needs Staff today, each item
// linking to its fix. Adding a missing Lazada link lowers the count on the
// next load, and each quick action opens its new form.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

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
  await expect(page.getByText("3 things need you today.")).toBeVisible();
  const links = needsAttention(page).getByRole("link", { name: /product links use the shop page/ });
  await expect(links).toContainText("16 product links use the shop page");
  for (const phase4 of [/paid today/i, /paid sales/i, /recent orders/i, /active members/i]) {
    await expect(page.getByText(phase4)).toHaveCount(0);
  }

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
  const show = page.getByRole("switch", { name: "Show banner" });
  await show.click();
  await expect(show).toHaveAttribute("aria-checked", "true");

  await page.goto(paths.admin.overview);
  await expect(page.getByText("2 things need you today.")).toBeVisible();
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

test("a signed-out visit is sent to sign-in, coming back to the Overview", async ({ page }) => {
  await page.goto(paths.admin.overview);
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
});
