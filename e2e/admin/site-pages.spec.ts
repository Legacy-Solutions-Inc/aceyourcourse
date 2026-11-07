import path from "node:path";

import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// Pages & promo's Site pages on sample data (ticket 20): an Editor sets the
// Products page's search title and sees it in <title>, then clears it and
// sees today's back; uploads the FAQ page's share image and sees it as
// og:image. The screen's older addresses still open what they did.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAVED = "✓ SAVED · LIVE ON THE SITE";
const SHARE_IMAGE = path.join(import.meta.dirname, "..", "fixtures", "share-image.png");
const PRODUCTS_TITLE = "All reviewers · flash cards, notebooks & posters · Ace Your Course";

const pagesNav = (page: Page) => page.getByRole("navigation", { name: "Pages" });
const editor = (page: Page) => page.getByRole("complementary", { name: "Site page editor" });
const column = (page: Page, label: string) =>
  page.getByRole("region", { name: `${label} Site page` });
const saveState = (page: Page) => editor(page).getByRole("status");

// Not `head meta[...]`: metadata that resolves after the page's first flush
// (a database read, live) is streamed into <body> and stays there. Share
// crawlers get it in <head>; a browser has it in the document either way.
const metaContent = (page: Page, selector: string) =>
  page.locator(`meta[${selector}]`).getAttribute("content");

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("sets the Products page's search title from Pages & promo, then clears it", async ({
  page,
}) => {
  await signInAs(page, "editor");
  await page.getByRole("link", { name: /Pages & promo$/ }).click();
  await pagesNav(page)
    .getByRole("link", { name: /^Site pages/ })
    .click();
  await expect(column(page, "HOME")).toBeVisible();
  await column(page, "HOME").getByRole("link", { name: "PRODUCTS" }).click();
  await expect(page).toHaveURL(/\?page=site&site=products$/);
  await expect(editor(page)).toContainText("SEARCH & AI VISIBILITY · SITE PAGES · PRODUCTS");

  const title = editor(page).getByLabel("PAGE TITLE");
  await title.fill("Every board exam reviewer");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.products.list);
  await expect(page).toHaveTitle("Every board exam reviewer · Ace Your Course");
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Every board exam reviewer · Ace Your Course",
  );
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", /\/products$/);

  await page.goto(`${paths.admin.examPages}?page=site&site=products`);
  await editor(page).getByLabel("PAGE TITLE").fill("");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);
  await page.goto(paths.products.list);
  await expect(page).toHaveTitle(PRODUCTS_TITLE);
});

test("uploads the FAQ page's 1200 × 630 share image: its og:image", async ({ page }) => {
  await signInAs(page, "editor", `${paths.admin.examPages}?page=site&site=faq`);
  const field = editor(page).getByLabel("SHARE IMAGE · 1200 × 630");
  await field.setInputFiles(SHARE_IMAGE);
  await expect(field).toHaveAccessibleDescription("share-image.png");
  await expect(editor(page).getByText(/NOT 1200 × 630/)).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.faq);
  // Live, from the bucket, filed under the Site page; on the sample data,
  // from the development-only upload route.
  const image = await metaContent(page, 'property="og:image"');
  expect(image).toMatch(
    LIVE
      ? /\/storage\/v1\/object\/public\/catalogue\/site-pages\/faq\/share-[0-9a-f-]{36}\.png$/
      : /\/api\/dev\/uploads\/[0-9a-f-]+$/,
  );
  const served = await page.request.get(image ?? "");
  expect(served.headers()["content-type"]).toBe("image/png");
  // Home keeps the site's share image.
  await page.goto(paths.home);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image/,
  );
});

test("opens Home for a page that isn't a Site page, and every older address as before", async ({
  page,
}) => {
  await signInAs(page, "editor", `${paths.admin.examPages}?page=site&site=legal`);
  await expect(column(page, "HOME")).toBeVisible();

  await page.goto(`${paths.admin.examPages}?exam=ce&section=header`);
  await expect(
    page.getByRole("complementary", { name: "Exam page editor" }).getByRole("heading"),
  ).toHaveText("EDIT · HEADER · CE");
  for (const [search, heading] of [
    ["?page=promo", "HOME PROMO BANNER"],
    ["?page=announcement", "ANNOUNCEMENT BAR"],
  ]) {
    await page.goto(`${paths.admin.examPages}${search}`);
    await expect(
      page.getByRole("complementary", { name: "Page editor" }).getByRole("heading", {
        name: heading,
      }),
    ).toBeVisible();
  }
});
