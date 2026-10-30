import { expect, type Page, test } from "@playwright/test";

// Exam pages on a real browser, with the Member App switch off (the launch
// default). Expected values are from the seed (src/services/mock/catalogue.ts):
// CE has 3 Live Products and 1 Coming Soon, ME has 1 Live and 2 Coming Soon.

const CE = "/exams/ce";
const ME = "/exams/me";

const productList = (page: Page, code: string) =>
  page.getByRole("list", { name: `Every ${code} reviewer` });
const productNames = (page: Page, code: string) =>
  productList(page, code).getByRole("heading", { level: 3 });
const chip = (page: Page, name: RegExp) =>
  page.getByRole("group", { name: "Filter by format" }).getByRole("button", { name });
const compareTable = (page: Page) => page.getByRole("table", { name: "Which one should I get?" });

/** A hero stat's value by its label. */
const stat = (page: Page, term: string) =>
  page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: term }) })
    .locator("dd");

async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block) as Record<string, unknown>);
}

test.describe("the CE page", () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(CE);
    expect(response?.status()).toBe(200);
  });

  test("is titled for board searches, with its canonical URL and BreadcrumbList", async ({
    page,
  }) => {
    await expect(page).toHaveTitle("CELE Reviewer · Civil Engineering · Ace Your Course");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/exams\/ce$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^Three subjects, four formats\./,
    );

    const breadcrumb = (await jsonLd(page)).find((data) => data["@type"] === "BreadcrumbList");
    expect(breadcrumb).toMatchObject({
      itemListElement: [
        { position: 1, name: "Home" },
        { position: 2, name: "Civil Engineering", item: expect.stringMatching(/\/exams\/ce$/) },
      ],
    });
  });

  test("shows the Exam with stats computed from its Live Products", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Civil Engineering");
    await expect(page.getByText("Civil Engineering Licensure Exam")).toBeVisible();
    await expect(stat(page, "Reviewers")).toHaveText("3");
    await expect(stat(page, "Units sold")).toHaveText("952");
    await expect(stat(page, "Avg rating")).toHaveText("4.8");
    await expect(stat(page, "From")).toHaveText("₱400");

    await expect(
      page.getByRole("region", { name: "What’s covered" }).getByRole("listitem"),
    ).toHaveCount(3);

    await page.getByRole("link", { name: "See 3 reviewers" }).click();
    await expect(page).toHaveURL(/\/exams\/ce#reviewers$/);
    await expect(page.getByRole("heading", { name: "Every CE reviewer" })).toBeInViewport();
  });

  test("lists the Products best selling first, then Coming Soon, and filters by format in place", async ({
    page,
  }) => {
    await expect(productNames(page, "CE")).toHaveText([
      "CE Formula Flash Cards",
      "Ultimate CE Posters 2.0",
      "CE Review Bundle 3-in-1",
      "CE Solving Notebook",
    ]);
    const cards = productList(page, "CE").getByRole("listitem");
    await expect(cards.first()).toContainText("#1 in CE");
    await expect(page.getByText("#1 in CE")).toHaveCount(1);
    await expect(cards.last()).toContainText("Coming soon");
    await expect(cards.last()).not.toContainText("₱");

    await expect(chip(page, /^All/)).toHaveAttribute("aria-pressed", "true");
    await chip(page, /^Posters/).click();
    await expect(chip(page, /^Posters/)).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, /^All/)).toHaveAttribute("aria-pressed", "false");
    await expect(productNames(page, "CE")).toHaveText(["Ultimate CE Posters 2.0"]);
    await expect(page).toHaveURL(CE);

    await chip(page, /^All/).click();
    await expect(productNames(page, "CE")).toHaveCount(4);
  });

  test("compares the Live Products and flips a sample card", async ({ page }) => {
    await expect(compareTable(page).getByRole("row")).toHaveCount(4);
    await expect(compareTable(page)).not.toContainText("CE Solving Notebook");

    const flip = page.getByRole("button", { name: "Flip card" });
    await expect(flip).toHaveAttribute("aria-pressed", "false");
    await flip.click();
    await expect(flip).toHaveAttribute("aria-pressed", "true");
    await flip.press("Enter");
    await expect(flip).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Next card" }).click();
    await expect(page.getByText("2 / 3")).toBeVisible();

    await expect(page.getByRole("link", { name: "Get the printed set" })).toHaveAttribute(
      "href",
      "/products/ce-formula-flash-cards",
    );
  });

  test("offers the CE bundle at its catalogue price", async ({ page }) => {
    const banner = page.getByRole("region", { name: /CE Review Bundle 3-in-1/ });
    await expect(banner).toContainText("₱3,499");
    await banner.getByRole("link").click();
    await expect(page).toHaveURL("/products/ce-review-bundle-3-in-1");
  });

  test("scrolls 7 CE Reviews in a marquee that pauses on hover", async ({ page }) => {
    const marquee = page.getByRole("region", { name: "Reviews from CE reviewees" });
    const track = marquee.locator(".animate-marquee");
    // The first copy is read; the second only completes the loop.
    await expect(marquee.locator("[data-marquee-copy]").first().getByRole("figure")).toHaveCount(7);
    await expect(track).toHaveCSS("animation-play-state", "running");
    // The cards are moving, so hover the still region over them.
    await marquee.hover();
    await expect(track).toHaveCSS("animation-play-state", "paused");
  });

  test("keeps every marquee card short, cutting a long Review to five lines", async ({ page }) => {
    const cards = page
      .getByRole("region", { name: "Reviews from CE reviewees" })
      .getByRole("figure");
    await expect(cards).toHaveCount(7);
    // Uncut, the 852-character Review makes an 863 px card; the mockup caps them near 300 px.
    for (const card of await cards.all()) {
      expect((await card.boundingBox())?.height).toBeLessThanOrEqual(340);
      await expect(card.getByRole("link", { name: "View product" })).toBeVisible();
    }
    // The cut is visual: the whole Review is still read out.
    await expect(
      cards.getByRole("blockquote").filter({ hasText: "#BoardExamPreparation" }),
    ).toHaveCount(1);
  });

  test("ends with the store band's shop buttons", async ({ page }) => {
    const band = page.getByRole("region", {
      name: "Get your CE reviewer from our official stores.",
    });
    await expect(band.getByRole("link", { name: /^Buy on Shopee/ })).toHaveAttribute(
      "href",
      "https://shopee.ph/aceyourcourse",
    );
    await expect(band.getByRole("link")).toHaveCount(3);
  });

  test("links nowhere in the Member App while the switch is off", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Civil Engineering");
    await expect(page.getByRole("link", { name: "Review CE in the app" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /app plans/ })).toHaveCount(0);
    await expect(compareTable(page).getByRole("columnheader", { name: "In the app" })).toHaveCount(
      0,
    );
    await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
  });
});

test("the switcher changes the URL, and Back returns to the previous Exam", async ({ page }) => {
  await page.goto(CE);
  const switcher = page.getByRole("navigation", { name: "Switch exam" });
  await expect(switcher.getByRole("link", { name: "CE" })).toHaveAttribute("aria-current", "page");

  await switcher.getByRole("link", { name: "ME" }).click();
  await expect(page).toHaveURL(ME);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mechanical Engineering");
  await expect(switcher.getByRole("link", { name: "ME" })).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(page).toHaveURL(CE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Civil Engineering");
});

test("with reduced motion, the Reviews stand still in a single row", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(CE);
  const marquee = page.getByRole("region", { name: "Reviews from CE reviewees" });
  await expect(marquee.locator("[data-marquee-copy]")).toHaveCount(1);
  await expect(marquee.locator(".animate-marquee")).toHaveCount(0);
});

test("an Exam with one Live Product has no comparison table or chips, and badges its Coming Soon", async ({
  page,
}) => {
  await page.goto(ME);
  await expect(productNames(page, "ME")).toHaveText([
    "ME Formula Flash Cards",
    "ME Notebook",
    "ME Posters",
  ]);
  const cards = productList(page, "ME").getByRole("listitem");
  for (const index of [1, 2]) {
    await expect(cards.nth(index)).toContainText("Coming soon");
    await expect(cards.nth(index)).not.toContainText("₱");
  }
  await expect(compareTable(page)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Filter by format" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /CE Review Bundle/ })).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "From ME reviewees" }).getByRole("listitem"),
  ).toHaveCount(3);
});

test("fits a phone screen with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(CE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Civil Engineering");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("/exams/CE permanently redirects to /exams/ce", async ({ page, request }) => {
  const response = await request.get("/exams/CE", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toBe(CE);

  await page.goto("/exams/CE");
  await expect(page).toHaveURL(CE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Civil Engineering");
});

test("/exams/zz is a 404 inside the Website shell", async ({ page }) => {
  const response = await page.goto("/exams/zz");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
