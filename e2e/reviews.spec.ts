import { expect as baseExpect, type Page, test } from "@playwright/test";

// The Reviews page on a real browser. Expected values are the seed in
// src/services/mock/catalogue.ts: 16 written Reviews of 8 Live Products, 15
// of them 5★ and one 3★ (the MedTech notebook), and 8 ratings rows. The page
// is also rendered from the seed in src/app/(website)/reviews/page.test.tsx.

// Each filter change is a server round trip: router.replace re-renders the page,
// and the URL changes only once it has. A dev server compiling other routes for
// parallel tests can take longer than the default 5 s over it.
const expect = baseExpect.configure({ timeout: 15_000 });

const WRITTEN = 16;

const count = (page: Page) => page.getByText(/^\d+ of \d+ written reviews$/);
const wall = (page: Page) => page.getByRole("region", { name: "The review wall" });
const cards = (page: Page) => wall(page).getByRole("figure");
const ratingsRow = (page: Page, name: RegExp) =>
  page.getByRole("list", { name: "Ratings by reviewer" }).getByRole("link", { name });
const starChip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Stars" }).getByRole("button", { name: new RegExp(`^${name} `) });
const productChip = (page: Page) => page.getByRole("button", { name: /, remove this filter$/ });

/**
 * Opens a Reviews URL and waits for React to hydrate it. Until then the wall's
 * filters are server-rendered HTML only, so a click or a keystroke would be lost.
 */
async function openReviews(page: Page, path = "/reviews") {
  await page.goto(path);
  await page.waitForFunction(() => {
    const search = document.querySelector('input[type="search"]');
    return search !== null && Object.keys(search).some((key) => key.startsWith("__reactProps$"));
  });
}

test.describe("the Reviews page", () => {
  test("shows the shop's figures, the ratings by reviewer and every written Review", async ({
    page,
  }) => {
    await openReviews(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "What reviewees say after using them.",
    );
    await expect(page.getByText("Shopee figures as of Oct 2026")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Ratings by reviewer" }).getByRole("link"),
    ).toHaveCount(8);
    await expect(count(page)).toHaveText(`${WRITTEN} of ${WRITTEN} written reviews`);
    await expect(cards(page)).toHaveCount(WRITTEN);
    await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("most-helpful");
  });

  test("filters the wall to a Product from its ratings row, and the chip removes it", async ({
    page,
    baseURL,
  }) => {
    await openReviews(page);

    await ratingsRow(page, /CE Formula Flash Cards/).click();

    await expect(page).toHaveURL(`${baseURL}/reviews?product=ce-formula-flash-cards#wall`);
    await expect(count(page)).toHaveText(`5 of ${WRITTEN} written reviews`);
    await expect(wall(page).getByRole("heading", { name: "The review wall" })).toBeInViewport();
    await expect(productChip(page)).toHaveAccessibleName(
      "CE Formula Flash Cards, remove this filter",
    );
    for (const card of await cards(page).all()) {
      await expect(card).toContainText("CE Formula Flash Cards");
    }

    await productChip(page).click();

    await expect(page).toHaveURL(`${baseURL}/reviews`);
    await expect(count(page)).toHaveText(`${WRITTEN} of ${WRITTEN} written reviews`);
    await expect(productChip(page)).toHaveCount(0);
  });

  test("shows only the Reviews of 3 stars or fewer, as many as the chip counts", async ({
    page,
    baseURL,
  }) => {
    await openReviews(page);
    const chip = starChip(page, "3 stars or fewer");
    await expect(chip).toHaveAccessibleName("3 stars or fewer 1 review");

    await chip.click();

    await expect(page).toHaveURL(`${baseURL}/reviews?stars=3-or-less`);
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(count(page)).toHaveText(`1 of ${WRITTEN} written reviews`);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("MedTech Essential Notebook");
    await expect(cards(page).first().getByRole("img")).toHaveAccessibleName("3 out of 5 stars");
  });

  test("sorts the most critical and the most detailed first", async ({ page, baseURL }) => {
    await openReviews(page);
    const sort = page.getByRole("combobox", { name: "Sort" });

    await sort.selectOption("Most critical");
    await expect(page).toHaveURL(`${baseURL}/reviews?sort=most-critical`);
    await expect(cards(page).first().getByRole("img")).toHaveAccessibleName("3 out of 5 stars");

    await sort.selectOption("Most detailed");
    await expect(page).toHaveURL(`${baseURL}/reviews?sort=most-detailed`);
    const lengths = await wall(page)
      .getByRole("blockquote")
      .evaluateAll((quotes) => quotes.map((quote) => quote.textContent?.length ?? 0));
    expect(lengths[0]).toBe(Math.max(...lengths));
  });

  test("rings the search box while it has keyboard focus", async ({ page }) => {
    await openReviews(page);
    const search = page.getByRole("searchbox", { name: "Search reviews" });

    await search.focus();

    // The input drops its own outline, so the box around it shows the ring.
    const ring = await search.evaluate((input) => {
      const box = input.parentElement;
      return box ? getComputedStyle(box).outlineStyle : "none";
    });
    expect(ring).toBe("solid");
  });

  test("searches the Reviews after a pause in typing", async ({ page, baseURL }) => {
    await openReviews(page);

    await page.getByRole("searchbox", { name: "Search reviews" }).fill("delivery");

    await expect(page).toHaveURL(`${baseURL}/reviews?q=delivery`);
    await expect(count(page)).toHaveText(`1 of ${WRITTEN} written reviews`);
    await expect(cards(page).first()).toContainText("fast delivery");
  });

  test("keeps a Review's line breaks", async ({ page }) => {
    await openReviews(page, "/reviews?sort=most-detailed");

    const longest = wall(page).getByRole("blockquote").first();
    await expect(longest).toContainText("Readability: The layout is clearly minimalist");
    // innerText follows the rendering, so it has a line break only if one shows.
    const lines = await longest.evaluate((quote) => (quote as HTMLElement).innerText.split("\n"));
    expect(lines.length).toBeGreaterThan(1);
  });

  test("ignores invalid filters in the URL", async ({ page }) => {
    await openReviews(page, "/reviews?product=nope&exam=zz&stars=2&sort=bogus");

    await expect(count(page)).toHaveText(`${WRITTEN} of ${WRITTEN} written reviews`);
    await expect(productChip(page)).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("most-helpful");
    await expect(starChip(page, "All")).toHaveAttribute("aria-pressed", "true");
  });

  test("shows the empty state when nothing matches, and Clear filters recovers", async ({
    page,
    baseURL,
  }) => {
    await openReviews(page, "/reviews?exam=cpa&stars=3-or-less");

    await expect(count(page)).toHaveText(`0 of ${WRITTEN} written reviews`);
    await expect(wall(page).getByText("No reviews match those filters.")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);

    await wall(page).getByRole("link", { name: "Clear filters" }).click();

    await expect(page).toHaveURL(`${baseURL}/reviews`);
    await expect(count(page)).toHaveText(`${WRITTEN} of ${WRITTEN} written reviews`);
  });

  test("clears every filter from the filter bar", async ({ page, baseURL }) => {
    await openReviews(page, "/reviews?product=ce-formula-flash-cards&q=cards&sort=highest");
    await expect(page.getByRole("searchbox", { name: "Search reviews" })).toHaveValue("cards");

    await page.getByRole("button", { name: "Clear filters" }).click();

    await expect(page).toHaveURL(`${baseURL}/reviews`);
    await expect(count(page)).toHaveText(`${WRITTEN} of ${WRITTEN} written reviews`);
    await expect(page.getByRole("searchbox", { name: "Search reviews" })).toHaveValue("");
  });

  test("invites a story by email and links to the reviewers", async ({ page }) => {
    await openReviews(page);
    const band = page.getByRole("region", { name: "Passed with our cards?" });

    await expect(band.getByRole("link", { name: /^Email us/ })).toHaveAttribute(
      "href",
      "mailto:aceyourcourseinc@gmail.com?subject=My%20board%20exam%20story",
    );
    await expect(band.getByRole("link", { name: "Browse reviewers" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  test("is titled, canonical to /reviews, and has no Review or rating structured data", async ({
    page,
    request,
    baseURL,
  }) => {
    await openReviews(page, "/reviews?stars=5");
    await expect(page).toHaveTitle(/^Reviews from board passers/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${baseURL}/reviews`,
    );

    const html = await (await request.get("/reviews")).text();
    expect(html).not.toContain("aggregateRating");
    expect(html).not.toContain("ratingValue");
    expect(html).not.toMatch(/"@type"\s*:\s*"Review"/);
  });

  test("fits a 390 px phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReviews(page, "/reviews?product=medtech-comprehensive-flash-cards");

    await expect(productChip(page)).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
