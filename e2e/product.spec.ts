import { expect, type Page, test } from "@playwright/test";

// Product pages on a real browser, with the Member App switch off (the launch
// default). Expected values are from docs/mockup/aycData.js.

const CE_CARDS = "/products/ce-formula-flash-cards";
const CE_CARDS_LISTING =
  "https://shopee.ph/Civil-Engineering-Formula-Flash-Cards-(CELE-Board-Exam-School-Reviewer)-i.1276620555.24292303887";
const LAZADA_SHOP = "https://www.lazada.com.ph/shop/aceyourcourse";
const TIKTOK_SHOP = "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop";
const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";

async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block) as Record<string, unknown>);
}

test.describe("a Live Product page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CE_CARDS);
  });

  test("shows the breadcrumb, badges, title and Shopee figures", async ({ page }) => {
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/products",
    );
    await expect(breadcrumb.getByRole("link", { name: "CELE" })).toHaveAttribute(
      "href",
      "/exams/ce",
    );
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("CE Formula Flash Cards");

    const details = page.getByRole("list", { name: "Details" });
    await expect(details).toContainText("CE · CELE");
    await expect(details).toContainText("Second Edition");
    await expect(details).toContainText("Flash cards");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Civil Engineering Formula Flash Cards",
    );
    await expect(page.getByTestId("shopee-figures")).toHaveText(
      "★ 4.8 · 197 ratings · 764 sold · as of Oct 2026",
    );
  });

  test("has a gallery that works with thumbnails and the arrow keys", async ({ page }) => {
    await expect(page.getByText("1 / 8")).toBeVisible();
    await page.getByRole("button", { name: "Show photo 3 of 8" }).click();
    await expect(page.getByText("3 / 8")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("4 / 8")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show photo 4 of 8" })).toBeFocused();
    const main = page.getByTestId("gallery-main").locator("img");
    await expect(main).toHaveAttribute(
      "src",
      /_next\/image\?url=%2Fproducts%2Fce-formula-flash-cards%2F4\.webp/,
    );
  });

  test("shows the price, deal, Subjects, specs and description", async ({ page }) => {
    await expect(page.getByTestId("product-price")).toHaveText("₱1,200");
    await expect(page.getByText("Shopee: any 2 enjoy 4% off")).toBeVisible();
    for (const [code, name] of [
      ["MSTC", "Mathematics, Surveying & Transportation Engineering"],
      ["HPGE", "Hydraulics & Geotechnical Engineering"],
      ["PSAD", "Principles of Structural Analysis & Design"],
    ] as const) {
      const row = page.getByRole("listitem").filter({ hasText: name });
      await expect(row).toContainText(code);
    }
    await expect(page.getByText("Iloilo City", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "01 · What’s inside" })).toBeVisible();
    await expect(
      page.getByText(/AceYourCourse reviewers are registered with IPOPHIL/),
    ).toBeVisible();
  });

  test("buys on the Product's Shopee Listing and the other shop pages, in new tabs", async ({
    page,
  }) => {
    const shopee = page.getByRole("link", { name: "Buy on Shopee (opens in a new tab)" });
    await expect(shopee).toHaveAttribute("href", CE_CARDS_LISTING);
    await expect(shopee).toHaveAttribute("target", "_blank");
    await expect(shopee).toHaveAttribute("rel", "noopener noreferrer");
    await expect(page.getByRole("link", { name: /^Buy on Lazada/ })).toHaveAttribute(
      "href",
      LAZADA_SHOP,
    );
    await expect(page.getByRole("link", { name: /^Buy on TikTok Shop/ })).toHaveAttribute(
      "href",
      TIKTOK_SHOP,
    );
  });

  test("shows every Review and More for the CELE", async ({ page }) => {
    const reviews = page.getByRole("region", { name: "Reviews" });
    await expect(reviews.getByTestId("review-summary")).toHaveText(
      "★ 4.8 · 197 ratings on Shopee · as of Oct 2026",
    );
    await expect(reviews.getByRole("figure")).toHaveCount(5);

    const more = page.getByRole("region", { name: "More for the CELE" });
    await expect(more.getByRole("article")).toHaveCount(2);
    await expect(more.getByRole("link", { name: "Ultimate CE Posters 2.0" })).toHaveAttribute(
      "href",
      "/products/ultimate-ce-posters-2-0",
    );
  });

  test("has Product and BreadcrumbList structured data, with Offers only at the Listing and no ratings", async ({
    page,
  }) => {
    const blocks = await jsonLd(page);
    const product = blocks.find((b) => b["@type"] === "Product");
    expect(product).toMatchObject({
      name: "Civil Engineering Formula Flash Cards",
      offers: [{ "@type": "Offer", url: CE_CARDS_LISTING, price: 1200, priceCurrency: "PHP" }],
    });
    expect(blocks.find((b) => b["@type"] === "BreadcrumbList")).toBeTruthy();
    const all = JSON.stringify(blocks);
    expect(all).not.toMatch(/aggregateRating|"review/i);
    expect(all).not.toContain(LAZADA_SHOP);
  });

  test("shows nothing about the Member App while the switch is off", async ({ page }) => {
    await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
    await expect(page.getByText(/All-Access|Printed only|In app/i)).toHaveCount(0);
  });
});

test("a Product with variations shows the range until one is picked, then its price", async ({
  page,
}) => {
  await page.goto("/products/ultimate-ce-posters-2-0");
  const price = page.getByTestId("product-price");
  await expect(price).toHaveText("₱400–₱1,250");
  await expect(page.getByText("CE POSTERS 2.0:")).toHaveCount(0);
  await expect(page.getByTestId("buy-box-header")).toContainText("Printed copy · ₱400–₱1,250");
  await page.getByRole("radio", { name: "HPGE ONLY ₱470" }).click();
  await expect(price).toHaveText("₱470");
  await expect(page.getByTestId("buy-box-header")).toContainText("Printed copy · ₱470");
  await expect(page.getByText(/in stock/i)).toHaveCount(0);
});

test("a Product with no written Reviews says so", async ({ page }) => {
  await page.goto("/products/ce-review-bundle-3-in-1");
  await expect(page.getByText("No written reviews yet")).toBeVisible();
});

test.describe("a Coming Soon Product page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products/ce-solving-notebook");
  });

  test("is announced with its badge and placeholder, and never priced", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Civil Engineering Solving Notebook",
    );
    await expect(page.getByRole("list", { name: "Details" })).toContainText("Coming soon");
    await expect(page.getByTestId("gallery-main").locator("img")).toHaveAttribute(
      "src",
      "/products/coming-soon.svg",
    );
    await expect(page.locator("main")).not.toContainText("₱");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByTestId("shopee-figures")).toHaveCount(0);
  });

  test("has no buy buttons, only Follow on Shopee", async ({ page }) => {
    await expect(page.getByRole("link", { name: /^Buy on/ })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Follow on Shopee (opens in a new tab)" }),
    ).toHaveAttribute("href", SHOPEE_SHOP);
  });

  test("has no Reviews section and no Product structured data", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Reviews" })).toHaveCount(0);
    const types = (await jsonLd(page)).map((b) => b["@type"]);
    expect(types).toEqual(["BreadcrumbList"]);
  });
});

test("an unknown Product is a 404 inside the Website shell", async ({ page }) => {
  const response = await page.goto("/products/no-such-product");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
