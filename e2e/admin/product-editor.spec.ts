import {
  type Browser,
  expect as baseExpect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import { formatAsOfDate } from "../../src/lib/admin/time";
import { manilaDate } from "../../src/lib/manila-time";
import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The Product editor on sample data (ticket 05): an Editor changes a Product
// and sees it on the Website at once, adds a Coming Soon Product, and deletes
// one with its Reviews after typing DELETE. Every refusal keeps the form.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const CARDS = {
  id: "prd-001",
  shortName: "CE Formula Flash Cards",
  slug: "ce-formula-flash-cards",
};
const POSTERS = {
  id: "prd-005",
  shortName: "Ultimate CE Posters 2.0",
  slug: "ultimate-ce-posters-2-0",
};
const SAVED = "✓ SAVED · LIVE ON THE SITE";

const editor = (page: Page) => page.getByRole("complementary", { name: "Product editor" });
const field = (page: Page, name: string) =>
  editor(page).getByRole("textbox", { name, exact: true });
const saveState = (page: Page) => editor(page).getByRole("status");

async function openEditor(page: Page, id: string, who: "editor" | "owner" = "editor") {
  await signInAs(page, who, `${paths.admin.products}?product=${id}`);
  await expect(page).toHaveURL(new RegExp(`/admin/products\\?product=${id}$`));
  await expect(editor(page).getByRole("form")).toBeVisible();
}

async function save(page: Page) {
  await editor(page).getByRole("button", { name: "Save product" }).click();
}

/** A second Staff User, signed in in a browser of their own. */
async function secondEditor(browser: Browser, id: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openEditor(page, id, "owner");
  return { page, close: () => context.close() };
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("a new price is live on the Product page, Products, its Exam page and Home", async ({
  page,
}) => {
  await openEditor(page, CARDS.id);
  await expect(editor(page).getByRole("combobox", { name: "EXAM" })).toHaveText(/CE · CELE/);

  await field(page, "PRICE FROM").fill("₱1,250");
  await expect(saveState(page)).toHaveText("UNSAVED CHANGES");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(field(page, "PRICE FROM")).toHaveValue("1,250");
  // The list beside the editor shows it too.
  await expect(
    page.getByRole("region", { name: "Products" }).getByRole("row").nth(1),
  ).toContainText("₱1,250");

  const popup = page.waitForEvent("popup");
  await editor(page)
    .getByRole("link", { name: /View page ↗/ })
    .click();
  const productPage = await popup;
  await expect(productPage).toHaveURL(new RegExp(`/products/${CARDS.slug}$`));
  await expect(productPage.getByRole("main").getByText("₱1,250").first()).toBeVisible();
  await productPage.close();

  const card = (scope: Locator) =>
    scope
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: CARDS.shortName }) });
  await page.goto(paths.products.list);
  await expect(card(page.getByRole("main")).first()).toContainText("₱1,250");
  await page.goto(paths.exams.details("CE"));
  await expect(card(page.getByRole("main")).first()).toContainText("₱1,250");
  await page.goto(paths.home);
  const bestSellers = page.getByRole("region", { name: "Best sellers" });
  await expect(bestSellers.getByRole("listitem").first()).toContainText("₱1,250");
});

test("variations save in order, one added and one removed, and the Product page's picker shows them", async ({
  page,
}) => {
  await openEditor(page, POSTERS.id);
  // The Marketplace's "CE POSTERS 2.0:" prefix isn't shown in the Admin.
  await expect(field(page, "Variation 3 name")).toHaveValue("HPGE ONLY");

  await editor(page).getByRole("button", { name: "Remove variation HPGE ONLY" }).click();
  await editor(page).getByRole("button", { name: "+ Add variation" }).click();
  await field(page, "Variation 4 name").fill("MSTC + HPGE");
  await field(page, "Variation 4 price").fill("850");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.products.details(POSTERS.slug));
  const picker = page.getByRole("radiogroup", { name: "Variation" });
  await expect(picker.getByRole("radio")).toHaveCount(4);
  await expect(picker.getByRole("radio").nth(3)).toHaveAccessibleName("MSTC + HPGE ₱850");
  await expect(picker.getByRole("radio", { name: /^HPGE ONLY/ })).toHaveCount(0);
});

test("the Shopee figures are dated today in Manila, and units sold re-rank Home's best sellers", async ({
  page,
}) => {
  await openEditor(page, POSTERS.id);
  await expect(
    editor(page).getByText(
      "Copy these from the Shopee listing. Best sellers on Home are ranked by units sold.",
    ),
  ).toBeVisible();

  await field(page, "RATING").fill("4.9");
  await field(page, "NO. OF RATINGS").fill("120");
  await field(page, "UNITS SOLD").fill("800");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
  await page.reload();
  await expect(
    editor(page).getByText(`AS OF ${formatAsOfDate(manilaDate(new Date()))}`),
  ).toBeVisible();

  await page.goto(paths.home);
  const bestSellers = page.getByRole("region", { name: "Best sellers" });
  await expect(bestSellers.getByRole("listitem").first().getByRole("heading")).toHaveText(
    POSTERS.shortName,
  );
});

test("a new Coming Soon Product saves with no price, at a fixed address, in the Website's Coming Soon list", async ({
  page,
}) => {
  await openEditor(page, "new");
  await expect(
    editor(page).getByText("Add photos. Square images work best, at least 1000 × 1000."),
  ).toBeVisible();

  await editor(page).getByRole("combobox", { name: "EXAM" }).selectOption({ label: "MT · MTLE" });
  await field(page, "FULL NAME").fill("MT Notebook");
  await field(page, "SHORT NAME · FOR CARDS").fill("MT Notebook");
  await field(page, "SIZE & PAPER").fill("A5 · 100 gsm");
  await editor(page).getByRole("button", { name: "HEMA" }).click();

  // Live needs a photo (product-photos.spec.ts adds one).
  await field(page, "PRICE FROM").fill("699");
  await editor(page).getByRole("button", { name: "Add product" }).click();
  await expect(saveState(page)).toHaveText("A Live Product needs at least one photo.");

  await editor(page).getByRole("switch", { name: "Coming Soon" }).click();
  await expect(field(page, "PRICE FROM")).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Add product" }).click();

  await expect(page).toHaveURL(/\/admin\/products\?product=prd-[0-9a-f]{8}$/);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(
    editor(page).getByText("PAGE ADDRESS · aceyourcourse.ph/products/mt-notebook"),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Products" })).toContainText("MT Notebook");

  // The address stays when the name changes.
  await field(page, "FULL NAME").fill("MT Big Notebook");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
  await page.reload();
  await expect(
    editor(page).getByText("PAGE ADDRESS · aceyourcourse.ph/products/mt-notebook"),
  ).toBeVisible();

  await page.goto(paths.products.list);
  const comingSoon = page.getByRole("region", { name: "Coming soon" });
  await expect(comingSoon).toContainText("MT Notebook");
});

test("every rule is refused on its field, and the form keeps the edits", async ({ page }) => {
  await openEditor(page, CARDS.id);

  await field(page, "FULL NAME").fill("");
  await field(page, "PRICE FROM").fill("");
  await save(page);
  await expect(saveState(page)).toHaveText("ADD A NAME AND PRICE TO SAVE");
  await expect(field(page, "FULL NAME")).toHaveAccessibleDescription("ADD A NAME");

  await field(page, "FULL NAME").fill("CE Formula Flash Cards");
  await field(page, "PRICE FROM").fill("12.345");
  await field(page, "PRICE UP TO · OPTIONAL").fill("-5");
  await field(page, "LAZADA · USING SHOP PAGE").fill("https://shopee.ph/cards-i.1.2");
  await field(page, "RATING").fill("4.7");
  await field(page, "NO. OF RATINGS").fill("");
  await field(page, "PAGE TITLE").fill("x".repeat(61));
  await expect(editor(page).getByText("61 / 60", { exact: false })).toBeVisible();
  await save(page);

  await expect(saveState(page)).toHaveText("FIX THE FIELDS MARKED IN RED");
  await expect(field(page, "PRICE FROM")).toHaveAccessibleDescription(
    "USE AT MOST 2 DECIMALS, LIKE 1,250.50",
  );
  await expect(field(page, "PRICE UP TO · OPTIONAL")).toHaveAccessibleDescription(
    "A PRICE CAN’T BE BELOW ₱0",
  );
  await expect(field(page, "LAZADA · PRODUCT LINK")).toHaveAccessibleDescription(
    "SHOULD BE A LAZADA.COM.PH LINK",
  );
  await expect(field(page, "NO. OF RATINGS")).toHaveAccessibleDescription(
    "Fill in all three Shopee figures, or none.",
  );
  await expect(field(page, "PAGE TITLE")).toHaveAccessibleDescription(
    "KEEP IT TO 60 CHARACTERS 61 / 60 characters",
  );
  await expect(field(page, "PRICE FROM")).toHaveValue("12.345");

  await field(page, "PRICE FROM").fill("abc");
  await save(page);
  await expect(field(page, "PRICE FROM")).toHaveAccessibleDescription(
    "ENTER A PRICE IN PESOS, LIKE 1,250",
  );

  // Nothing was saved.
  await page.goto(paths.products.details(CARDS.slug));
  await expect(page.getByRole("main").getByText("₱1,200").first()).toBeVisible();
});

test("changing the Exam drops the Subjects that aren't on it", async ({ page }) => {
  await openEditor(page, CARDS.id);
  const subjects = editor(page).getByRole("group", { name: "SUBJECTS COVERED" });
  await expect(subjects.getByRole("button", { pressed: true })).toHaveText([
    "MSTC",
    "HPGE",
    "PSAD",
  ]);

  await editor(page).getByRole("combobox", { name: "EXAM" }).selectOption({ label: "ME · MELE" });

  await expect(subjects.getByRole("button")).toHaveText(["PIP", "MATH", "MD"]);
  await expect(subjects.getByRole("button", { pressed: true })).toHaveCount(0);
  await save(page);
  await expect(subjects).toHaveAccessibleDescription("CHOOSE AT LEAST ONE SUBJECT");
});

test("a Product with Reviews can't be made Coming Soon", async ({ page }) => {
  await openEditor(page, CARDS.id);

  await editor(page).getByRole("switch", { name: "Coming Soon" }).click();
  await expect(editor(page).getByRole("region", { name: "PRICE & VARIATIONS" })).toHaveCount(0);
  await save(page);

  await expect(saveState(page)).toHaveText(
    "Coming Soon Products can’t have Reviews. Delete or move its 5 Reviews first.",
  );
});

test("a stale save gets the conflict message and keeps the form", async ({ page, browser }) => {
  await openEditor(page, CARDS.id);
  const other = await secondEditor(browser, CARDS.id);

  await field(other.page, "PRICE FROM").fill("1,300");
  await save(other.page);
  await expect(saveState(other.page)).toHaveText(SAVED);
  await other.close();

  await field(page, "PRICE FROM").fill("1,250");
  await save(page);
  const notice = editor(page).getByRole("alert");
  await expect(notice).toContainText("SOMEONE SAVED FIRST");
  await expect(notice).toContainText(
    /Angel Rose L\. Lepaña saved this Product at .+\. Copy your changes, then reload to see theirs\./,
  );
  await expect(field(page, "PRICE FROM")).toHaveValue("1,250");
});

test("deleting needs DELETE typed exactly, counts what goes, and the page then answers 404", async ({
  page,
}) => {
  await openEditor(page, POSTERS.id);

  await editor(page).getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Delete “${POSTERS.shortName}”?` });
  await expect(dialog).toContainText(
    "3 Reviews and 2 photos are deleted with it. 1 FAQ quote from its Reviews is removed. Store listings on Shopee, Lazada, and TikTok Shop are not affected.",
  );
  const confirm = dialog.getByRole("button", { name: "Delete product" });
  const typed = dialog.getByRole("textbox", { name: "TYPE DELETE TO CONFIRM" });
  await expect(confirm).toBeDisabled();
  await typed.fill("delete");
  await expect(confirm).toBeDisabled();
  await typed.fill("DELETE");
  await confirm.click();

  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(editor(page)).toContainText("Select a product");
  await expect(page.getByRole("region", { name: "Products" })).not.toContainText(POSTERS.shortName);

  const response = await page.goto(paths.products.details(POSTERS.slug));
  expect(response?.status()).toBe(404);
  await page.goto(paths.faq);
  await expect(page.getByRole("main")).not.toContainText("Glossy type yung paper");
  await expect(page.getByRole("main")).toContainText("What are the posters like?");
});

test("saving or deleting a Product deleted elsewhere says it's gone", async ({ page, browser }) => {
  await openEditor(page, POSTERS.id);
  const other = await secondEditor(browser, POSTERS.id);
  await editor(other.page).getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = other.page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "TYPE DELETE TO CONFIRM" }).fill("DELETE");
  await dialog.getByRole("button", { name: "Delete product" }).click();
  await expect(other.page).toHaveURL(/\/admin\/products$/);
  await other.close();

  await field(page, "EDITION").fill("3.0");
  await save(page);
  await expect(saveState(page)).toHaveText("NOT SAVED · IT’S NO LONGER THERE. RELOAD THE PAGE");
  await expect(field(page, "EDITION")).toHaveValue("3.0");

  await editor(page).getByRole("button", { name: "Delete", exact: true }).click();
  const mine = page.getByRole("dialog");
  await mine.getByRole("textbox", { name: "TYPE DELETE TO CONFIRM" }).fill("DELETE");
  await mine.getByRole("button", { name: "Delete product" }).click();
  await expect(mine.getByRole("alert")).toHaveText("IT’S ALREADY BEEN DELETED · RELOAD THE PAGE");
});

test("every switch on Products is a target at least 24 × 24 px (WCAG 2.2)", async ({ page }) => {
  await openEditor(page, POSTERS.id);
  const switches = page.getByRole("switch");
  // Two per row in the list, and four in the editor.
  await expect(switches).toHaveCount(15 * 2 + 4);

  const sizes = await switches.evaluateAll((elements) =>
    elements.map((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    }),
  );
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(24);
    expect(size.height).toBeGreaterThanOrEqual(24);
  }
});
