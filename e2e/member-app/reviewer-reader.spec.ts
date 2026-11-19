import path from "node:path";

import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, signInAndOnboard, SKIP_LIVE } from "./helpers";

// Reading a Reviewer PDF on sample data (Phase 3, ticket 14; stories 101, 102
// and 105): the tester, whose CE pass is active, opens a Published Reviewer
// PDF, pages forward, zooms, leaves, and comes back to the same page and
// zoom; a page whose request drops shows "didn't load", and Try again brings
// it; a new tester with no pass finds the unlock prompt, and the page
// endpoint refuses them the page. The sample data has no Reviewer PDF with
// pages, so an Editor uploads a real 3-page PDF first, which the fake
// renderer splits, and publishes it under CE MSTC's Surveying.

// Sign-in redirects, the split and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const THREE_PAGES = path.join(
  import.meta.dirname,
  "..",
  "..",
  "test",
  "fixtures",
  "reviewer-pdfs",
  "three-pages.pdf",
);

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const surveying = (page: Page) =>
  page
    .getByRole("list", { name: "MSTC Topics" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: /Surveying$/ }) });
const pageImage = (page: Page, name: string) => page.getByRole("img", { name });
const zoom = (page: Page) => page.getByRole("group", { name: "Zoom" });
const pages = (page: Page) => page.getByRole("navigation", { name: "Pages" });

/** Waits for the page image to have arrived from the page endpoint, stamped. */
async function expectLoaded(page: Page, name: string) {
  await expect(pageImage(page, name)).toBeVisible();
  await expect
    .poll(() => pageImage(page, name).evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
}

/** An Editor uploads the 3-page PDF, places it under CE MSTC's Surveying and publishes it, in their own browser. */
async function editorPublishesReviewerPdf(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "editor", paths.admin.reviewerPdfs);
    await page.getByLabel("Choose a PDF").setInputFiles(THREE_PAGES);
    const row = page
      .getByRole("list", { name: "Reviewer PDFs" })
      .getByRole("listitem")
      .filter({ hasText: "three-pages.pdf" });
    await expect(row).toContainText("Draft · 3 pages", { timeout: 30_000 });
    await row.getByRole("link", { name: "three-pages.pdf" }).click();

    const placement = page.getByRole("region", { name: "PLACEMENT" });
    await placement.getByLabel("EXAM").selectOption("CE");
    await placement.getByLabel("SUBJECT").selectOption("MSTC");
    await placement.getByLabel("TOPIC").selectOption({ label: "Surveying" });
    await placement.getByRole("button", { name: "Save placement" }).click();
    await expect(placement.getByRole("status")).toHaveText("✓ SAVED");

    const inTheApp = page.getByRole("region", { name: "IN THE MEMBER APP" });
    await inTheApp.getByRole("button", { name: "Publish" }).click();
    await expect(inTheApp).toContainText("LIVE IN THE LIBRARY");
  } finally {
    await context.close();
  }
}

/** An Owner adds an email to the Beta Tester list in the Admin, in their own browser. */
async function ownerAddsTester(browser: Browser, email: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.betaTesters);
    const testers = page.getByRole("region", { name: "BETA TESTERS" });
    await testers.getByLabel("GOOGLE ACCOUNT EMAIL").fill(email);
    await testers.getByRole("button", { name: "Add Beta Tester" }).click();
    await expect(testers.getByRole("status")).toHaveText(/ADDED/);
  } finally {
    await context.close();
  }
}

/** Opens Surveying's Reviewer PDF from the Library's MSTC Topics. */
async function openReviewerPdf(page: Page) {
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  await surveying(page)
    .getByRole("link", { name: /^Reviewer PDF/ })
    .click();
  await expect(page).toHaveURL(/\/app\/library\/reviewer-pdf\/[0-9a-f-]{36}$/);
}

test.skip(LIVE, SKIP_LIVE);

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test("the tester pages, zooms, leaves, and reopens at the same page and zoom; a dropped page retries", async ({
  page,
  browser,
}) => {
  // A PDF to split and publish, then a Member to sign in: past 30 seconds on a cold server.
  test.slow();
  await editorPublishesReviewerPdf(browser);
  await signInAndOnboard(page, "tester", "CE");
  await openReviewerPdf(page);

  await expect(page.getByRole("heading", { level: 1, name: "Surveying" })).toBeVisible();
  await expect(page.getByText("MSTC Reviewer · Surveying")).toBeVisible();
  await expectLoaded(page, "Page 1 of 3");
  await expect(pages(page).getByText("PAGE 1 / 3")).toBeVisible();
  await expect(zoom(page).getByText("100%")).toBeVisible();

  // Each page comes from the page endpoint, stamped and kept only by this browser.
  const second = page.waitForResponse((response) => /\/pages\/2$/.test(response.url()));
  await pages(page).getByRole("button", { name: "Next →" }).click();
  const response = await second;
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, max-age=300");
  await expectLoaded(page, "Page 2 of 3");

  const saved = page.waitForResponse(
    (answer) =>
      answer.request().method() === "POST" && /\/app\/library\/reviewer-pdf\//.test(answer.url()),
  );
  await zoom(page).getByRole("button", { name: "Zoom in" }).click();
  await expect(zoom(page).getByText("125%")).toBeVisible();
  await saved;
  await expectNoBlockingViolations(page);

  // Leave for the Library, and come back.
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "LIBRARY" })
    .click();
  await expect(page).toHaveURL(/\/app\/library\?subject=MSTC$/);
  await surveying(page)
    .getByRole("link", { name: /^Reviewer PDF/ })
    .click();
  await expectLoaded(page, "Page 2 of 3");
  await expect(pages(page).getByText("PAGE 2 / 3")).toBeVisible();
  await expect(zoom(page).getByText("125%")).toBeVisible();

  // The connection drops as page 3 is asked for: it says so, and Try again brings it.
  await page.route(
    "**/app/reviewer-pdfs/*/pages/3*",
    (route) => route.abort("internetdisconnected"),
    {
      times: 1,
    },
  );
  await pages(page).getByRole("button", { name: "Next →" }).click();
  // Named: Next's route announcer is an alert too.
  const failed = page.getByRole("alert", { name: "Looks like your connection dropped" });
  await expect(failed).toContainText("PAGE 3 DIDN’T LOAD");
  await expect(
    failed.getByRole("heading", { name: "Looks like your connection dropped" }),
  ).toBeVisible();
  await expect(pages(page).getByRole("button", { name: "Next →" })).toBeDisabled();
  await failed.getByRole("button", { name: "Try again" }).click();
  await expectLoaded(page, "Page 3 of 3");
  await expect(failed).toHaveCount(0);
});

test("a new tester with no pass gets the unlock prompt, and no page", async ({ page, browser }) => {
  test.slow();
  await editorPublishesReviewerPdf(browser);
  await ownerAddsTester(browser, "stranger@example.com");
  await signInAndOnboard(page, "stranger", "CE");
  await openReviewerPdf(page);

  await expect(
    page.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Page/ })).toHaveCount(0);
  await expectNoBlockingViolations(page);

  // On a phone it's a focus screen: a back bar, and no Menu button.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole("navigation", { name: "Back" })
      .getByRole("link", { name: "Back to MSTC topics" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);

  // Asking the page endpoint by address is refused too, with no image.
  const id = page.url().split("/").at(-1) ?? "";
  const refused = await page.request.get(paths.memberApp.reviewerPage(id, 1));
  expect(refused.status()).toBe(403);
  expect(refused.headers()["content-type"]).toMatch(/^application\/json/);
  expect(await refused.json()).toEqual({ refused: "locked" });
});
