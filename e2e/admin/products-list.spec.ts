import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The Products list on sample data (ticket 04): an Editor filters by Exam,
// search and Missing product links, all kept in the URL, and the inline Site
// and App toggles save at once and change the Website.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const CARDS = "CE Formula Flash Cards";
const CARDS_SLUG = "ce-formula-flash-cards";

const products = (page: Page) => page.getByRole("region", { name: "Products" });
const examChip = (page: Page, exam: string) =>
  products(page).getByRole("group", { name: "Exam" }).getByRole("link", { name: exam });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search products" });
const count = (page: Page, n: number) =>
  expect(products(page).getByRole("columnheader", { name: `PRODUCT · ${n}` })).toBeVisible();
/** The list's row for a Product, found by its short name. */
const row = (page: Page, shortName: string) =>
  products(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: new RegExp(`^${shortName}`) }) });
const siteSwitch = (page: Page, shortName: string) =>
  page.getByRole("switch", { name: `Show ${shortName} on the website` });

async function openProducts(page: Page, search = "") {
  await signInAs(page, "editor", `${paths.admin.products}${search}`);
  await expect(page).toHaveURL(/\/admin\/products/);
  await expect(products(page)).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("lists every Product, best sellers first, with prices, badges and the legend", async ({
  page,
}) => {
  await openProducts(page);

  await count(page, 15);
  const first = products(page).getByRole("row").nth(1);
  await expect(first).toContainText(CARDS);
  await expect(first).toContainText("FLASH CARDS · 764 SOLD");
  await expect(first).toContainText("₱1,200");
  await expect(row(page, "Ultimate CE Posters 2.0")).toContainText("₱400+");
  await expect(row(page, "CE Solving Notebook")).toContainText("COMING SOON");
  await expect(row(page, CARDS).getByText("Lazada: opens the shop page")).toBeAttached();
  await expect(row(page, CARDS)).toContainText("1/3");
  await expect(products(page).getByRole("row").last()).toContainText("MedTech Essentials Posters");
  await expect(
    page.getByText("GREEN = PRODUCT LINK · AMBER = OPENS THE SHOP PAGE", { exact: false }),
  ).toBeVisible();
});

test("filters by Exam and search, and a reload keeps the filters", async ({ page }) => {
  await openProducts(page);

  await examChip(page, "CE").click();
  await expect(page).toHaveURL(/\?exam=ce$/);
  await count(page, 4);

  await search(page).fill("poster");
  await expect(page).toHaveURL(/\?q=poster&exam=ce$/);
  await count(page, 1);
  await expect(row(page, "Ultimate CE Posters 2.0")).toBeVisible();

  await page.reload();
  await expect(search(page)).toHaveValue("poster");
  await expect(examChip(page, "CE")).toHaveAttribute("aria-current", "true");
  await count(page, 1);
});

test("CE with Missing product links shows only CE's Live Products, each with an amber badge", async ({
  page,
}) => {
  await openProducts(page, "?exam=ce");

  await products(page).getByRole("link", { name: "Missing product links" }).click();
  await expect(page).toHaveURL(/\?exam=ce&missing=1$/);
  await count(page, 3);
  for (const name of [CARDS, "Ultimate CE Posters 2.0", "CE Review Bundle 3-in-1"]) {
    await expect(
      row(page, name)
        .getByText(/: opens the shop page$/)
        .first(),
    ).toBeAttached();
  }
  await expect(row(page, "CE Solving Notebook")).toHaveCount(0);
});

test("no match says so, and Clear filters shows every Product again", async ({ page }) => {
  await openProducts(page, "?exam=cpa&q=poster");

  await expect(products(page).getByText("No products match.")).toBeVisible();
  await products(page).getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await count(page, 15);
  await expect(search(page)).toHaveValue("");
});

test("an unknown Exam in the URL is ignored, and the list shows ALL", async ({ page }) => {
  await openProducts(page, "?exam=xx");

  await count(page, 15);
  await expect(examChip(page, "ALL")).toHaveAttribute("aria-current", "true");
});

test("clicking a row selects it, and + Add product selects a new one", async ({ page }) => {
  await openProducts(page);

  await row(page, CARDS).getByRole("link").click();
  await expect(page).toHaveURL(/\?product=prd-001$/);
  await expect(page.getByText(`EDIT · ${CARDS.toUpperCase()}`)).toBeVisible();

  await page.getByRole("banner").getByRole("link", { name: "+ Add product" }).click();
  await expect(page).toHaveURL(/\?product=new$/);
  await expect(page.getByText("NEW PRODUCT")).toBeVisible();
});

test("turning Site off hides a Product from the Website, and its page answers 404; on brings it back", async ({
  page,
}) => {
  await openProducts(page);

  await siteSwitch(page, CARDS).click();
  await expect(siteSwitch(page, CARDS)).toHaveAttribute("aria-checked", "false");
  await expect(row(page, CARDS).getByText("Hidden from the website")).toBeAttached();
  // Saved, not just flipped: a fresh read still has it off.
  await page.reload();
  await expect(siteSwitch(page, CARDS)).toHaveAttribute("aria-checked", "false");

  const hidden = await page.goto(paths.products.details(CARDS_SLUG));
  expect(hidden?.status()).toBe(404);
  await page.goto(paths.products.list);
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(CARDS) })).toHaveCount(
    0,
  );
  await page.goto(paths.exams.details("ce"));
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(CARDS) })).toHaveCount(
    0,
  );
  await page.goto(paths.home);
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(CARDS) })).toHaveCount(
    0,
  );

  await page.goto(paths.admin.products);
  await siteSwitch(page, CARDS).click();
  await expect(siteSwitch(page, CARDS)).toHaveAttribute("aria-checked", "true");
  await expect(row(page, CARDS).getByText("Hidden from the website")).toHaveCount(0);

  const shown = await page.goto(paths.products.details(CARDS_SLUG));
  expect(shown?.status()).toBe(200);
  await page.goto(paths.home);
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(CARDS) })
      .first(),
  ).toBeVisible();
});

test("turning App on saves, and with the Member App switch off the Website shows no app badge", async ({
  page,
}) => {
  const posters = "Ultimate CE Posters 2.0";
  const appSwitch = page.getByRole("switch", { name: `${posters} available in app` });
  await openProducts(page);

  await expect(appSwitch).toHaveAttribute("aria-checked", "false");
  await appSwitch.click();
  await expect(appSwitch).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(appSwitch).toHaveAttribute("aria-checked", "true");

  // No app badge on the cards, no "Also in app" filter, no app band on its page.
  await page.goto(paths.products.list);
  await expect(page.getByRole("main").getByRole("link", { name: posters })).toBeVisible();
  await expect(page.getByText(/^in app$|also in app/i)).toHaveCount(0);
  await page.goto(paths.products.details("ultimate-ce-posters-2-0"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/also available in the app|not available in the app/i)).toHaveCount(
    0,
  );
});
