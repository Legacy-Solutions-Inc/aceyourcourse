import { expect as baseExpect, type Page, test } from "@playwright/test";

// The Products page on a real browser, with the Member App switch off (the
// launch default). Expected values are the seed in src/services/mock/catalogue.ts:
// 8 Live Products across 5 Exams, and 7 Coming Soon. The switch-on page is
// covered by src/app/(website)/products/page.test.tsx.

// Each filter change is a server round trip: router.replace re-renders the page,
// and the URL changes only once it has. A dev server compiling other routes for
// parallel tests can take longer than the default 5 s over it.
const expect = baseExpect.configure({ timeout: 15_000 });

const LIVE = 8;
const CE_CARDS_LISTING =
  "https://shopee.ph/Civil-Engineering-Formula-Flash-Cards-(CELE-Board-Exam-School-Reviewer)-i.1276620555.24292303887";
const LAZADA_SHOP = "https://www.lazada.com.ph/shop/aceyourcourse";

const grid = (page: Page) => page.getByRole("list", { name: "All reviewers" });
const gridNames = (page: Page) => grid(page).getByRole("heading", { level: 3 });
const count = (page: Page) => page.getByText(/^\d+ of \d+ reviewers$/);
const comingSoon = (page: Page) => page.getByRole("list", { name: "Coming soon" });
const examChip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Exam" }).getByRole("button", { name: new RegExp(`^${name} `) });
const formatChip = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Format" })
    .getByRole("button", { name: new RegExp(`^${name} `) });
/**
 * Opens a Products URL and waits for React to hydrate it. Until then the
 * filter bar and the picker are server-rendered HTML only, so a click or a
 * keystroke would be lost.
 */
async function openProducts(page: Page, path = "/products") {
  await page.goto(path);
  await page.waitForFunction(() => {
    const slider = document.querySelector('input[type="range"]');
    return slider !== null && Object.keys(slider).some((key) => key.startsWith("__reactProps$"));
  });
}
const card = (page: Page, name: string) =>
  grid(page)
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name }) });

test.describe("the Products page", () => {
  test("lists every Live Product, best selling first", async ({ page }) => {
    await openProducts(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Find the reviewer that fits how you study.",
    );
    await expect(page.getByText("All reviewers · 5 board exams")).toBeVisible();
    await expect(count(page)).toHaveText(`${LIVE} of ${LIVE} reviewers`);
    await expect(gridNames(page)).toHaveCount(LIVE);
    await expect(gridNames(page).first()).toHaveText("CE Formula Flash Cards");
  });

  test("puts each filter in the URL, and a reload keeps the view", async ({ page, baseURL }) => {
    await openProducts(page);

    await examChip(page, "CE").click();
    await expect(page).toHaveURL(`${baseURL}/products?exam=ce`);
    await expect(count(page)).toHaveText(`3 of ${LIVE} reviewers`);
    await expect(grid(page).getByRole("article")).toHaveCount(3);

    await formatChip(page, "Posters").click();
    await expect(page).toHaveURL(`${baseURL}/products?exam=ce&format=posters`);
    await expect(gridNames(page)).toHaveText(["Ultimate CE Posters 2.0"]);

    await page.reload();
    await expect(examChip(page, "CE")).toHaveAttribute("aria-pressed", "true");
    await expect(formatChip(page, "Posters")).toHaveAttribute("aria-pressed", "true");
    await expect(gridNames(page)).toHaveText(["Ultimate CE Posters 2.0"]);
    await expect(count(page)).toHaveText(`1 of ${LIVE} reviewers`);
  });

  test("sorts by price", async ({ page, baseURL }) => {
    await openProducts(page);

    await page.getByRole("combobox", { name: "Sort" }).selectOption("Price: low to high");

    await expect(page).toHaveURL(`${baseURL}/products?sort=price-asc`);
    await expect(gridNames(page).first()).toHaveText("Ultimate CE Posters 2.0");
  });

  test("searches by Subject after a pause in typing", async ({ page, baseURL }) => {
    await openProducts(page);

    await page.getByRole("searchbox", { name: "Search reviewers" }).fill("MSTC");

    await expect(page).toHaveURL(`${baseURL}/products?q=MSTC`);
    await expect(gridNames(page)).toHaveText([
      "CE Formula Flash Cards",
      "Ultimate CE Posters 2.0",
      "CE Review Bundle 3-in-1",
    ]);
  });

  test("filters by max price", async ({ page, baseURL }) => {
    await openProducts(page);
    const slider = page.getByRole("slider", { name: "Max price" });
    await expect(slider).toHaveAttribute("aria-valuetext", "Any price");

    await slider.fill("500");

    await expect(page).toHaveURL(`${baseURL}/products?max=500`);
    await expect(slider).toHaveAttribute("aria-valuetext", "₱500");
    await expect(gridNames(page)).toHaveText(["Ultimate CE Posters 2.0"]);
  });

  test("clears every filter", async ({ page, baseURL }) => {
    await openProducts(page, "/products?exam=ce&q=cards&sort=top-rated");
    await expect(page.getByRole("searchbox", { name: "Search reviewers" })).toHaveValue("cards");

    await page.getByRole("button", { name: "Clear filters" }).click();

    await expect(page).toHaveURL(`${baseURL}/products`);
    await expect(count(page)).toHaveText(`${LIVE} of ${LIVE} reviewers`);
    await expect(page.getByRole("searchbox", { name: "Search reviewers" })).toHaveValue("");
  });

  test("recommends a reviewer, then shows the rest for that Exam", async ({ page, baseURL }) => {
    await openProducts(page);
    await page.getByRole("link", { name: "Help me choose" }).click();
    await expect(page).toHaveURL(`${baseURL}/products#picker`);

    await page
      .getByRole("group", { name: "1. Which board are you taking?" })
      .getByRole("button", { name: "CE" })
      .click();
    await page
      .getByRole("group", { name: "2. How do you like to study?" })
      .getByRole("button", { name: /^On my wall/ })
      .click();

    const result = page.getByRole("status").filter({ hasText: "Start with this" });
    await expect(result).toContainText("Ultimate CE Posters 2.0");
    await expect(result).toContainText(
      "Posters keep every formula in view while you solve. Where there are no posters for your board, flash cards are the closest fit.",
    );
    await expect(result.getByRole("link", { name: "View reviewer" })).toHaveAttribute(
      "href",
      "/products/ultimate-ce-posters-2-0",
    );

    await result.getByRole("button", { name: "See all CE reviewers" }).click();
    await expect(page).toHaveURL(`${baseURL}/products?exam=ce`);
    await expect(count(page)).toHaveText(`3 of ${LIVE} reviewers`);
    await expect(page.getByRole("heading", { level: 2, name: "All reviewers" })).toBeInViewport();
  });

  test("lists the Coming Soon Products in their own row, with no prices", async ({ page }) => {
    await openProducts(page);

    const row = comingSoon(page);
    await expect(row.getByRole("article")).toHaveCount(7);
    await expect(row.getByText("Coming soon")).toHaveCount(7);
    await expect(row).not.toContainText("₱");
    await expect(grid(page)).not.toContainText("CE Solving Notebook");
  });

  test("sends each store button to the Listing, or else the shop page", async ({ page }) => {
    await openProducts(page);

    const ceCards = card(page, "CE Formula Flash Cards");
    await expect(ceCards.getByRole("link", { name: /^Buy on Shopee/ })).toHaveAttribute(
      "href",
      CE_CARDS_LISTING,
    );
    await expect(ceCards.getByRole("link", { name: /^Buy on Lazada/ })).toHaveAttribute(
      "href",
      LAZADA_SHOP,
    );
  });

  test("falls back to the defaults for invalid parameters", async ({ page }) => {
    await openProducts(page, "/products?exam=zzz&format=box&max=abc&sort=bogus&q=");

    await expect(count(page)).toHaveText(`${LIVE} of ${LIVE} reviewers`);
    await expect(gridNames(page).first()).toHaveText("CE Formula Flash Cards");
    await expect(examChip(page, "All")).toHaveAttribute("aria-pressed", "true");
  });

  test('reads a max above the top price as "Any", and ignores app=1', async ({ page }) => {
    await openProducts(page, "/products?max=99999&app=1");

    await expect(count(page)).toHaveText(`${LIVE} of ${LIVE} reviewers`);
    await expect(page.getByRole("slider", { name: "Max price" })).toHaveAttribute(
      "aria-valuetext",
      "Any price",
    );
  });

  test("shows the empty state when nothing matches, and Clear filters recovers", async ({
    page,
    baseURL,
  }) => {
    await openProducts(page, "/products?exam=cpa&format=posters");

    await expect(page.getByText("No reviewers match those filters.")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Browse Shopee/ })).toHaveAttribute(
      "href",
      "https://shopee.ph/aceyourcourse",
    );
    // CPA has no Coming Soon Products, so the row is hidden.
    await expect(comingSoon(page)).toHaveCount(0);

    await page.getByRole("link", { name: "Clear filters" }).click();

    await expect(page).toHaveURL(`${baseURL}/products`);
    await expect(count(page)).toHaveText(`${LIVE} of ${LIVE} reviewers`);
  });

  test("disables a chip with no Products instead of hiding it", async ({ page }) => {
    await openProducts(page, "/products?exam=ce");

    await expect(formatChip(page, "Notebook")).toBeDisabled();
    await expect(formatChip(page, "Notebook")).toHaveAccessibleName("Notebook 0 reviewers");
  });

  test("never mentions, links to or filters by the Member App while it's off", async ({ page }) => {
    await openProducts(page);

    await expect(page.getByRole("button", { name: "Also in app" })).toHaveCount(0);
    await expect(
      page
        .getByRole("group", { name: "2. How do you like to study?" })
        .getByRole("button", { name: /^App/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Two ways to study it/ })).toHaveCount(0);
    await expect(page.getByText(/also in the app/i)).toHaveCount(0);
    await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
  });
});
