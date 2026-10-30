import { expect as baseExpect, type Page, test } from "@playwright/test";

// Home on a real browser, with the Member App switch off (the launch default).
// Expected values are the seed in src/services/mock/catalogue.ts: 8 Live
// Products across 5 Exams, 7 Coming Soon, and the shop's 4.8 from 874 ratings
// as of 29 Oct 2026. The switch-on Home is covered by
// src/app/(website)/page.test.tsx.

// A dev server compiling other routes for parallel tests can take longer than
// the default 5 s to hydrate a page or load media.
const expect = baseExpect.configure({ timeout: 15_000 });

const PROMO = "/media/ayc-promo-720p.mp4";
const CE_CARDS_LISTING =
  "https://shopee.ph/Civil-Engineering-Formula-Flash-Cards-(CELE-Board-Exam-School-Reviewer)-i.1276620555.24292303887";

/**
 * Opens Home and waits for React to hydrate it. Until then the hero video,
 * "Try a card" and the carousel are server-rendered HTML only.
 */
async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const flip = document.querySelector('button[aria-label="Flip card"]');
    return flip !== null && Object.keys(flip).some((key) => key.startsWith("__reactProps$"));
  });
}

const hero = (page: Page) => page.locator("section").filter({ has: page.locator("h1") });
const flipCard = (page: Page) => page.getByRole("button", { name: "Flip card" });
const bestSellers = (page: Page) => page.getByRole("list", { name: "Best sellers" });

test.describe("Home on a 1280 px screen", () => {
  test("plays the promo as a muted, looping background behind the hero", async ({ page }) => {
    await openHome(page);
    const video = hero(page).locator("video");

    await expect(video).toHaveAttribute("aria-hidden", "true");
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentSrc))
      .toMatch(/\/media\/ayc-promo-720p\.mp4$/);
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.muted))
      .toBe(true);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(true);
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(false);
    await expect(video).not.toHaveAttribute("controls");
    await expect(page.getByRole("button", { name: "Play video" })).toHaveCount(0);

    // It can be paused, as moving content longer than 5 s must be.
    await page.getByRole("button", { name: "Pause background video" }).click();
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(true);
    await page.getByRole("button", { name: "Play background video" }).click();
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(false);
  });

  test("shows the hero, then every section down to Best sellers", async ({ page }) => {
    await openHome(page);

    await expect(page).toHaveTitle("Board exam reviewers made by passers · Ace Your Course");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\/[^/]+\/?$/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Remember every formula on board day." }),
    ).toBeVisible();
    await expect(hero(page).getByText("4.8 from 874 ratings")).toBeVisible();
    await expect(hero(page).getByText("as of Oct 2026")).toBeVisible();
    await expect(page.getByRole("region", { name: "Try a card · tap to flip" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Why reviewees choose us" })).toContainText(
      "CE · ME · EE · MT · CPA",
    );
    await expect(page.getByRole("heading", { name: "Four steps to your reviewer" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^CE/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab")).toHaveCount(5);
    await expect(bestSellers(page).getByRole("listitem")).toHaveCount(6);
  });

  test("turns Try a card over by itself, and by keyboard, dots and Next card", async ({ page }) => {
    await openHome(page);
    await expect(flipCard(page)).toHaveAttribute("aria-pressed", "false");
    // It turns over after 3.2 s with no interaction.
    await expect(flipCard(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("img", { name: /Major head loss, Darcy-Weisbach/ })).toBeVisible();

    await flipCard(page).focus();
    await page.keyboard.press("Enter");
    await expect(flipCard(page)).toHaveAttribute("aria-pressed", "false");

    const region = page.getByRole("region", { name: "Try a card · tap to flip" });
    await page.getByRole("button", { name: "Show the EE card" }).click();
    await expect(region.getByText("Wave motion", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next card" }).click();
    await expect(region.getByText("Major head loss", { exact: true })).toBeVisible();
  });

  test("moves to ME with ArrowRight in Find your exam, listing the ME Products", async ({
    page,
  }) => {
    await openHome(page);
    const ce = page.getByRole("tab", { name: /^CE/ });
    await ce.focus();
    await page.keyboard.press("ArrowRight");

    const me = page.getByRole("tab", { name: /^ME/ });
    await expect(me).toBeFocused();
    await expect(me).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("heading", { name: "Mechanical Engineering" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "All ME reviewers" })).toHaveAttribute(
      "href",
      "/exams/me",
    );

    await panel.getByRole("link", { name: "ME Formula Flash Cards" }).click();
    await expect(page).toHaveURL(/\/products\/me-formula-flash-cards$/);
  });

  test("shows a Subject's full name on hover, which the pointer can move onto", async ({
    page,
  }) => {
    await openHome(page);
    const tooltip = page.locator("[data-subject-tooltip]");
    await page.getByRole("button", { name: /^HPGE · / }).hover();
    await expect(tooltip).toHaveText("Hydraulics & Geotechnical Engineering");

    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });

  test("ranks the best sellers, with ← disabled at the start and → scrolling", async ({ page }) => {
    await openHome(page);
    const first = bestSellers(page).getByRole("listitem").first();
    await expect(first.getByText("#1", { exact: true })).toBeVisible();
    await expect(first.getByRole("heading")).toHaveText("CE Formula Flash Cards");
    await expect(first.locator("[data-sold-bar]")).toHaveAttribute("style", "width:100%");
    await expect(bestSellers(page).getByRole("heading")).toHaveText([
      "CE Formula Flash Cards",
      "ME Formula Flash Cards",
      "CPA Flash Cards",
      "EE Flash Cards",
      "Ultimate CE Posters 2.0",
      "MedTech Essential Notebook",
    ]);

    const previous = page.getByRole("button", { name: "Previous best sellers" });
    const next = page.getByRole("button", { name: "Next best sellers" });
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    await next.click();
    await expect
      .poll(() => bestSellers(page).evaluate((list) => list.scrollLeft))
      .toBeGreaterThan(0);
    await expect(previous).toBeEnabled();
  });

  test("leads from Home to an Exam page, a Product page and its Shopee Listing", async ({
    page,
  }) => {
    await openHome(page);
    await page.getByRole("tabpanel").getByRole("link", { name: "All CE reviewers" }).click();
    await expect(page).toHaveURL(/\/exams\/ce$/);

    await page
      .getByRole("list", { name: "Every CE reviewer" })
      .getByRole("link", { name: "CE Formula Flash Cards" })
      .click();
    await expect(page).toHaveURL(/\/products\/ce-formula-flash-cards$/);
    await expect(
      page.getByRole("link", { name: "Buy on Shopee (opens in a new tab)" }),
    ).toHaveAttribute("href", CE_CARDS_LISTING);
  });

  test("never mentions or links to the app, and never shows a Coming Soon Product", async ({
    page,
  }) => {
    await openHome(page);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Try the app free" })).toHaveCount(0);
    await expect(main).not.toContainText(/\bapp\b/i);
    await expect(main).not.toContainText(/coming soon/i);
    await expect(main.getByText("CE Solving Notebook")).toHaveCount(0);
  });
});

test.describe("Home on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("downloads no video until the Visitor taps Play video", async ({ page }) => {
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(PROMO)) videoRequests.push(request.url());
    });

    await openHome(page);
    await expect(page.getByRole("button", { name: "Play video" })).toBeVisible();
    await page.waitForLoadState("load");
    expect(videoRequests).toEqual([]);
    await expect(page.locator("video")).toHaveCount(0);

    const requested = page.waitForRequest((request) => request.url().includes(PROMO));
    await page.getByRole("button", { name: "Play video" }).click();
    await requested;

    const player = page.getByLabel("Ace Your Course promo video");
    await expect(player).toHaveAttribute("controls");
    await expect(player).toBeFocused();
    await expect
      .poll(() => player.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(false);
  });

  test("keeps a Subject's full name on screen", async ({ page }) => {
    await openHome(page);
    await page.getByRole("tab", { name: /^CPA/ }).click();
    // Tapping a chip focuses it, which shows its full name.
    await page.getByRole("button", { name: /^MS · / }).click();
    await expect(page.locator("[data-subject-tooltip]")).toHaveText("Management Services");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});

test.describe("Home for a Visitor who prefers reduced motion", () => {
  test("plays no background video and leaves Try a card still", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await openHome(page);
    await expect(page.getByRole("button", { name: "Play video" })).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);

    // 10 s is three or more 3.2 s turns, so a card that turned by itself
    // can't still be on the first card's front. Read once: the clock keeps
    // running, and a retrying assertion could wait for a turning card to come
    // round to the front again.
    await page.clock.runFor(10_000);
    const shown = {
      flipped: await flipCard(page).getAttribute("aria-pressed"),
      ceCard: await page
        .getByRole("button", { name: "Show the CE card" })
        .getAttribute("aria-pressed"),
    };
    expect(shown).toEqual({ flipped: "false", ceCard: "true" });
    await expect(page.locator("video")).toHaveCount(0);
  });
});
