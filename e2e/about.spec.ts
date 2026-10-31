import { expect, type Page, test } from "@playwright/test";

// The About page on a real browser, from the seed in
// src/services/mock/catalogue.ts: 8 Live Products (and 7 Coming Soon) across
// 5 Exams, and the shop's figures (4.8 from 874 ratings, 3.7K followers, as of
// 29 Oct 2026). Edited-seed cases are in src/app/(website)/about/page.test.tsx.

const stats = (page: Page) =>
  page.getByRole("list", { name: "AceYourCourse in numbers" }).getByRole("listitem");
const cta = (page: Page) =>
  page.getByRole("region", { name: "Your turn. Find the reviewer for your board." });

test.describe("the About page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about");
  });

  test("opens with the brand line and stats computed from the catalogue", async ({ page }) => {
    await expect(page).toHaveTitle(/^About · made by board passers in Iloilo/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Built by board passers. Designed for dreamers.",
    );
    await expect(stats(page)).toHaveText([
      /^8\s*reviewers$/i,
      /^5\s*board exams$/i,
      /^4\.8★\s*874 shop ratings$/i,
      /^3\.7K\s*Shopee followers$/i,
    ]);
    await expect(page.getByText("Shop figures from Shopee as of Oct 2026")).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(/29 reviewers|11 board exams/i);
  });

  test("jumps to the story, whose timeline lists the catalogue's Exams", async ({ page }) => {
    await page.getByRole("link", { name: "Read our story" }).click();
    await expect(page).toHaveURL(/\/about#story$/);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "We passed. Then we made what we wished we had.",
      }),
    ).toBeInViewport();
    const story = page.getByRole("region", {
      name: "We passed. Then we made what we wished we had.",
    });
    await expect(story).toHaveAttribute("id", "story");
    await expect(story).toContainText(
      "We now make reviewers for Civil Engineering, Mechanical Engineering, Electrical Engineering, Medical Technology, and Accountancy.",
    );
  });

  test("moves through the mission tabs with the arrow keys", async ({ page }) => {
    const first = page.getByRole("tab", { name: "Board-focused, nothing extra" });
    await expect(first).toHaveAttribute("aria-selected", "true");
    await first.focus();

    await page.keyboard.press("ArrowDown");
    const second = page.getByRole("tab", { name: "Updated to the trend" });
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText(
      "Our CE flash cards are already on their second edition.",
    );

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("tabpanel")).toContainText("CE posters from ₱400");
  });

  test("shows where keyboard focus is on the mission panel", async ({ page }) => {
    await page.getByRole("tab", { name: "Board-focused, nothing extra" }).focus();
    await page.keyboard.press("Tab");
    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeFocused();
    await expect(panel).toHaveCSS("outline-style", "solid");
  });

  test("links to each official store's shop page, in a new tab", async ({ page }) => {
    const stores = page.getByRole("list", { name: "Our official stores" }).getByRole("link");
    await expect(stores).toHaveCount(3);
    await expect(stores.nth(0)).toHaveAttribute("href", "https://shopee.ph/aceyourcourse");
    await expect(stores.nth(1)).toHaveAttribute(
      "href",
      "https://www.lazada.com.ph/shop/aceyourcourse",
    );
    await expect(stores.nth(2)).toHaveAttribute(
      "href",
      "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop",
    );
    for (const store of await stores.all()) {
      await expect(store).toHaveAttribute("target", "_blank");
    }
  });

  test("rings the store buttons in cream on keyboard focus, as the band is blue", async ({
    page,
  }) => {
    const stores = page.getByRole("list", { name: "Our official stores" }).getByRole("link");
    for (const store of await stores.all()) {
      await store.focus();
      await expect(store).toHaveCSS("outline-style", "solid");
      // --ayc-cream, #f6f1e7.
      await expect(store).toHaveCSS("outline-color", "rgb(246, 241, 231)");
    }
  });

  test("ends with a tile for every Exam, CPA included, and All reviewers", async ({ page }) => {
    const tiles = cta(page).getByRole("link");
    await expect(tiles).toHaveText([
      /^CE\s*Civil Engineering\s*Reviewers/,
      /^ME\s*Mechanical Engineering\s*Reviewers/,
      /^EE\s*Electrical Engineering\s*Reviewers/,
      /^MT\s*Medical Technology\s*Reviewers/,
      /^CPA\s*Accountancy\s*Reviewers/,
      /All reviewers/,
    ]);
    await expect(cta(page).getByRole("link", { name: "All reviewers" })).toHaveAttribute(
      "href",
      "/products",
    );

    await cta(page).getByRole("link", { name: /^CPA/ }).click();
    await expect(page).toHaveURL(/\/exams\/cpa$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Accountancy");
  });

  test("serves every photo self-hosted and optimised, with alt text", async ({ page }) => {
    const photos = page.getByRole("main").locator("img");
    await expect(photos).toHaveCount(4);
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await expect(photo).toHaveAttribute("alt", /\S/);
      await expect(photo).toHaveAttribute("src", /^\/_next\/image\?url=%2Fabout%2F[a-z-]+\.webp&/);
      await expect
        .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test("never links into the Member App", async ({ page }) => {
    const hrefs = await page
      .getByRole("main")
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((href) => href.startsWith("/app"))).toEqual([]);
  });
});
