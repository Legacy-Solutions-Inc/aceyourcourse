import path from "node:path";

import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Exam pages & promo on sample data (ticket 09): an Editor hides a section of
// an Exam page and sees it gone from the Website; sets the CE page's search
// title and sees it in <title>; edits the Header and renames a Subject,
// seen on the Exam page, a Product page and the FAQ page; offers another
// bundle; and uploads a share image. Every refusal keeps the form.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAVED = "✓ SAVED · LIVE ON THE SITE";
const SHARE_IMAGE = path.join(import.meta.dirname, "..", "fixtures", "share-image.png");
const SQUARE_IMAGE = path.join(import.meta.dirname, "..", "fixtures", "product-photo.png");

const editor = (page: Page) => page.getByRole("complementary", { name: "Exam page editor" });
const column = (page: Page, code: string) =>
  page.getByRole("region", { name: `${code} Exam page` });
const saveState = (page: Page) => editor(page).getByRole("status");

async function openExamPages(page: Page, search = "") {
  await signInAs(page, "editor", `${paths.admin.examPages}${search}`);
  await expect(editor(page)).toBeVisible();
}

const metaContent = (page: Page, selector: string) =>
  page.locator(`head meta[${selector}]`).getAttribute("content");

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("hides Reviews on the ME page, gone from /exams/me, and shows them again", async ({
  page,
}) => {
  await openExamPages(page, "?exam=me");
  const reviews = column(page, "ME").getByRole("switch", { name: "Show Reviews on the ME page" });
  await expect(reviews).toHaveAttribute("aria-checked", "true");

  await reviews.click();
  await expect(reviews).toHaveAttribute("aria-checked", "false");
  await expect(column(page, "ME").getByText("From ME products · HIDDEN ON SITE")).toBeVisible();
  await page.goto(paths.exams.details("ME"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mechanical Engineering");
  await expect(page.getByText("From ME reviewees")).toHaveCount(0);

  await page.goto(`${paths.admin.examPages}?exam=me`);
  await column(page, "ME").getByRole("switch", { name: "Show Reviews on the ME page" }).click();
  // The switch flips at once; the list read again after the save says it's shown.
  await expect(column(page, "ME").getByText("From ME products", { exact: true })).toBeVisible();
  await page.goto(paths.exams.details("ME"));
  await expect(page.getByRole("list", { name: "From ME reviewees" })).toBeVisible();
});

test("sets the CE search title: GOOD, in <title> and og:title; a 61-character one is refused", async ({
  page,
}) => {
  await openExamPages(page, "?exam=ce&section=seo");
  const title = editor(page).getByLabel("PAGE TITLE");
  await title.fill("T".repeat(43));
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(editor(page).getByText("KEEP THE WHOLE TITLE TO 60 CHARACTERS")).toBeVisible();
  await expect(saveState(page)).toHaveText("FIX THE FIELDS MARKED IN RED");
  await expect(title).toHaveValue("T".repeat(43));

  await title.fill("CE Board Exam Reviewer");
  await expect(editor(page).getByRole("figure")).toContainText(
    "CE Board Exam Reviewer · Ace Your Course",
  );
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(
    column(page, "CE").getByRole("link", { name: /^Search & AI visibility/ }),
  ).toContainText("GOOD");

  await page.goto(paths.exams.details("CE"));
  await expect(page).toHaveTitle("CE Board Exam Reviewer · Ace Your Course");
  expect(await metaContent(page, 'property="og:title"')).toBe(
    "CE Board Exam Reviewer · Ace Your Course",
  );
});

test("edits the CE Header TEXT: the hero shows it and the blank description follows it", async ({
  page,
}) => {
  const text = "Every CE formula, in four formats. Start with the cards, then add the posters.";
  await openExamPages(page, "?exam=ce");
  await editor(page).getByLabel("TEXT", { exact: true }).fill(text);
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.exams.details("CE"));
  await expect(page.getByText(text)).toBeVisible();
  expect(await metaContent(page, 'name="description"')).toBe(text);
});

test("renames CE's MSTC Subject: on the CE page, its Products' pages and the FAQ", async ({
  page,
}) => {
  const name = "Math, Surveying & Transportation";
  await openExamPages(page, "?exam=ce&section=subjects");
  await editor(page).getByLabel("01 · MSTC").fill(name);
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.exams.details("CE"));
  await expect(page.getByRole("region", { name: "What’s covered" })).toContainText(name);
  await page.goto(paths.products.details("ce-formula-flash-cards"));
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.goto(paths.faq);
  await page
    .getByRole("button", { name: "What subjects does each exam’s reviewer cover?" })
    .click();
  await expect(page.getByRole("list", { name: "Subjects per exam" })).toContainText(`MSTC ${name}`);
});

test("offers the CE posters as the bundle, with its headline and text, while it's Live", async ({
  page,
}) => {
  await openExamPages(page, "?exam=ce&section=bundle");
  await editor(page).getByLabel("PRODUCT").selectOption({ label: "Ultimate CE Posters 2.0" });
  await editor(page).getByLabel("HEADLINE").fill("Ultimate CE Posters 2.0");
  await editor(page).getByLabel("TEXT", { exact: true }).fill("Every CE formula on your wall.");
  await editor(page).getByLabel("BUTTON LABEL").fill("See the posters");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(column(page, "CE").getByText("Ultimate CE Posters 2.0")).toBeVisible();

  await page.goto(paths.exams.details("CE"));
  const offer = page.getByRole("region", { name: /^Ultimate CE Posters 2\.0/ });
  await expect(offer).toContainText("Every CE formula on your wall.");
  await expect(offer).toContainText("See the posters");
  await expect(offer.getByRole("link")).toHaveAttribute(
    "href",
    paths.products.details("ultimate-ce-posters-2-0"),
  );
  await expect(page.getByRole("region", { name: /^CE Review Bundle 3-in-1/ })).toHaveCount(0);
});

test("uploads a 1200 × 630 share image: og:image; a square one is warned about", async ({
  page,
}) => {
  await openExamPages(page, "?exam=ce&section=seo");
  const field = editor(page).getByLabel("SHARE IMAGE · 1200 × 630");

  await field.setInputFiles(SQUARE_IMAGE);
  await expect(
    editor(page).getByText("1000 × 1000 · NOT 1200 × 630, SO IT MAY BE CROPPED"),
  ).toBeVisible();

  await field.setInputFiles(SHARE_IMAGE);
  await expect(field).toHaveAccessibleDescription("share-image.png");
  await expect(editor(page).getByText(/NOT 1200 × 630/)).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.exams.details("CE"));
  // From the bucket, filed under the Exam (ticket 17).
  const image = await metaContent(page, 'property="og:image"');
  expect(image).toMatch(
    /\/storage\/v1\/object\/public\/catalogue\/exam-pages\/CE\/share-[0-9a-f-]{36}\.png$/,
  );
  const served = await page.request.get(image ?? "");
  expect(served.headers()["content-type"]).toBe("image/png");
});

test("sets CE's Official Exam Date, and warns about a past one", async ({ page }) => {
  await openExamPages(page, "?exam=ce&section=date");
  const date = editor(page).getByLabel("OFFICIAL EXAM DATE", { exact: true });
  await date.fill("2020-04-24");
  await expect(
    editor(page).getByText("THIS DATE HAS PASSED · SET THE NEXT ONE ONCE PRC ANNOUNCES IT"),
  ).toBeVisible();

  await date.fill("2030-04-24");
  await expect(editor(page).getByText(/THIS DATE HAS PASSED/)).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(column(page, "CE").getByRole("link", { name: /^Official Exam Date/ })).toContainText(
    "24 APR 2030",
  );
});
