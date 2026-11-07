import path from "node:path";

import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import {
  isUploadPut,
  LIVE,
  publicUrlOf,
  resetSampleData,
  signInAs,
  UPLOAD_URLS,
  uploadPathOf,
} from "./helpers";

// Product photos (tickets 06 and 17): an Editor uploads a photo straight to a
// one-time upload URL, makes it the cover, saves, and the Website shows it
// through next/image. On the in-memory sample data the URL is the
// development-only upload route; live (CI), it's a signed upload URL in the
// local Supabase's Storage, and the Website loads it from the bucket. Uploads
// that break, or haven't finished, never reach the save.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "product-photo.png");
const POSTERS = {
  id: "prd-005",
  title: "Ultimate Civil Engineering Posters",
  shortName: "Ultimate CE Posters 2.0",
  slug: "ultimate-ce-posters-2-0",
};
const SAVED = "✓ SAVED · LIVE ON THE SITE";

const editor = (page: Page) => page.getByRole("complementary", { name: "Product editor" });
const strip = (page: Page) =>
  editor(page).getByRole("list", { name: "PHOTOS · FIRST IS THE COVER" });
const tile = (page: Page, n: number) =>
  strip(page)
    .getByRole("listitem")
    .nth(n - 1);
const saveState = (page: Page) => editor(page).getByRole("status");
const addPhotos = (page: Page) => editor(page).getByLabel("Add photos");

async function openEditor(page: Page, id: string, who: "editor" | "owner" = "editor") {
  await signInAs(page, who, `${paths.admin.products}?product=${id}`);
  await expect(page).toHaveURL(new RegExp(`/admin/products\\?product=${id}$`));
  await expect(editor(page).getByRole("form")).toBeVisible();
}

async function save(page: Page) {
  await editor(page)
    .getByRole("button", { name: /^(Save|Add) product$/ })
    .click();
}

/** The fixture again under another name, for a second file in one choice. */
async function fixtureAs(name: string) {
  const { readFile } = await import("node:fs/promises");
  return { name, mimeType: "image/png", buffer: await readFile(FIXTURE) };
}

/** Waits for the browser's PUT of one file, giving its one-time upload URL. */
const nextUpload = (page: Page) => page.waitForRequest(isUploadPut);

/** The Website's image src for an upload: its public URL, through the image optimizer. */
const optimized = (uploadUrl: string) =>
  new RegExp(
    `^/_next/image\\?url=${encodeURIComponent(publicUrlOf(uploadUrl)).replace(/[.\\]/g, "\\$&")}&`,
  );

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

test("an uploaded photo dragged to first is the cover, live on the Product page, Products and its Exam page", async ({
  page,
}) => {
  await openEditor(page, POSTERS.id);
  await expect(editor(page).getByText("2 photos · drag to reorder")).toBeVisible();

  const put = nextUpload(page);
  await addPhotos(page).setInputFiles(FIXTURE);
  const uploadUrl = (await put).url();
  // Storage files it under the Product; in memory it's filed by its id.
  expect(uploadPathOf(uploadUrl)).toMatch(
    LIVE ? new RegExp(`^products/${POSTERS.id}/[0-9a-f-]{36}\\.png$`) : /^uploads\/[0-9a-f-]{36}$/,
  );
  await expect(tile(page, 3)).toContainText("product-photo.png");
  await expect(tile(page, 3)).toContainText("UNSAVED");
  await expect(editor(page).getByText("3 photos · drag to reorder")).toBeVisible();
  await expect(saveState(page)).toHaveText("UNSAVED CHANGES");

  await tile(page, 3).dragTo(tile(page, 1));
  await expect(tile(page, 1)).toContainText("product-photo.png");
  await expect(tile(page, 1)).toContainText("COVER");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(tile(page, 1)).not.toContainText("UNSAVED");

  await page.goto(paths.products.details(POSTERS.slug));
  const cover = page.getByTestId("gallery-main").locator("img");
  await expect(cover).toHaveAttribute("alt", `${POSTERS.title}, photo 1 of 3`);
  await expect(cover).toHaveAttribute("src", optimized(uploadUrl));
  // Served: the optimizer read the upload.
  await expect
    .poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText("1 / 3")).toBeVisible();

  for (const listing of [paths.products.list, paths.exams.details("ce")]) {
    await page.goto(listing);
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: POSTERS.shortName }) });
    await expect(card.locator("img").first()).toHaveAttribute("src", optimized(uploadUrl));
  }
});

test("Move left from the keyboard makes an upload the cover, and the upload URL takes one PUT only", async ({
  page,
  request,
}) => {
  await openEditor(page, POSTERS.id);
  const put = nextUpload(page);
  await addPhotos(page).setInputFiles(FIXTURE);
  const uploadUrl = (await put).url();
  await expect(tile(page, 3)).toContainText("UNSAVED");

  await editor(page).getByRole("button", { name: "Move left, photo 3" }).focus();
  await page.keyboard.press("Enter");
  await expect(editor(page).getByRole("button", { name: "Move left, photo 2" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tile(page, 1)).toContainText("product-photo.png");
  await expect(tile(page, 1)).toContainText("COVER");

  // One-time: the same URL refuses a second file, and the first is served.
  const again = await request.put(uploadUrl, {
    headers: { "content-type": "image/png" },
    data: (await fixtureAs("again.png")).buffer,
  });
  expect(again.ok()).toBe(false);
  const served = await request.get(publicUrlOf(uploadUrl));
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");

  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
  await page.goto(paths.products.details(POSTERS.slug));
  await expect(page.getByTestId("gallery-main").locator("img")).toHaveAttribute(
    "alt",
    `${POSTERS.title}, photo 1 of 3`,
  );
});

test("a broken upload shows Upload failed · Try again on that file only, and Try again works", async ({
  page,
}) => {
  await openEditor(page, POSTERS.id);
  let puts = 0;
  await page.route(UPLOAD_URLS, (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    puts += 1;
    return puts === 1 ? route.abort("failed") : route.continue();
  });

  await addPhotos(page).setInputFiles([await fixtureAs("front.png"), await fixtureAs("back.png")]);

  const uploads = editor(page).getByRole("list", { name: "Uploads" });
  await expect(uploads.getByRole("listitem")).toHaveCount(1);
  await expect(uploads.getByRole("listitem")).toContainText("front.pngUpload failed · Try again");
  await expect(tile(page, 4)).toContainText("back.png");
  await expect(tile(page, 4)).toContainText("UNSAVED");

  await save(page);
  await expect(saveState(page)).toHaveText("An upload failed. Try it again, or remove it.");

  await uploads.getByRole("button", { name: "Try again: front.png" }).click();
  await expect(uploads).toHaveCount(0);
  await expect(tile(page, 3)).toContainText("UNSAVED");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(editor(page).getByText("4 photos · drag to reorder")).toBeVisible();
});

test("a GIF or a file over 10 MB is refused before upload, naming the file", async ({ page }) => {
  await openEditor(page, POSTERS.id);
  let puts = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT") puts += 1;
  });

  await addPhotos(page).setInputFiles([
    { name: "spinner.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") },
    { name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(12 * 1024 * 1024) },
  ]);

  const alert = editor(page).getByRole("alert");
  await expect(alert).toContainText("“spinner.gif” isn’t a JPEG, PNG or WebP image.");
  await expect(alert).toContainText("“huge.png” is over 10 MB.");
  await expect(editor(page).getByText("2 photos · drag to reorder")).toBeVisible();
  expect(puts).toBe(0);
});

test("saving while an upload is on its way is refused: Wait for uploads to finish.", async ({
  page,
}) => {
  await openEditor(page, POSTERS.id);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(UPLOAD_URLS, async (route) => {
    if (route.request().method() === "PUT") await held;
    await route.continue();
  });

  const put = nextUpload(page);
  await addPhotos(page).setInputFiles(FIXTURE);
  await put;
  await save(page);
  await expect(saveState(page)).toHaveText("Wait for uploads to finish.");

  release();
  await expect(tile(page, 3)).toContainText("UNSAVED");
  await save(page);
  await expect(saveState(page)).toHaveText(SAVED);
});

test("removing the last photo of a Live Product is refused on save", async ({ page }) => {
  // MT Comprehensive Flash Cards: Live, with one photo.
  await openEditor(page, "prd-007");
  await editor(page).getByRole("button", { name: "Remove photo 1" }).click();
  await expect(
    editor(page).getByText("Add photos. Square images work best, at least 1000 × 1000."),
  ).toBeVisible();

  await save(page);

  await expect(saveState(page)).toHaveText("A Live Product needs at least one photo.");
});

test("a stale save gets the conflict message, and the unsaved photo stays in the strip", async ({
  page,
  browser,
}) => {
  await openEditor(page, POSTERS.id);
  const other = await secondEditor(browser, POSTERS.id);
  await other.page
    .getByRole("complementary", { name: "Product editor" })
    .getByRole("textbox", { name: "PRICE FROM", exact: true })
    .fill("450");
  await other.page.getByRole("button", { name: "Save product" }).click();
  await expect(
    other.page.getByRole("complementary", { name: "Product editor" }).getByRole("status"),
  ).toHaveText(SAVED);
  await other.close();

  await addPhotos(page).setInputFiles(FIXTURE);
  await expect(tile(page, 3)).toContainText("UNSAVED");
  await save(page);

  await expect(saveState(page)).toHaveText("NOT SAVED");
  await expect(editor(page).getByText(/saved this Product/)).toBeVisible();
  await expect(tile(page, 3)).toContainText("product-photo.png");
  await expect(tile(page, 3)).toContainText("UNSAVED");
});

test("a new Live Product can be added once it has a photo", async ({ page }) => {
  await openEditor(page, "new");
  await editor(page).getByRole("combobox", { name: "EXAM" }).selectOption({ label: "MT · MTLE" });
  for (const [name, value] of [
    ["FULL NAME", "MT Pocket Notes"],
    ["SHORT NAME · FOR CARDS", "MT Pocket Notes"],
    ["SIZE & PAPER", "A6 · 100 gsm"],
    ["PRICE FROM", "349"],
  ] as const) {
    await editor(page).getByRole("textbox", { name, exact: true }).fill(value);
  }
  await editor(page).getByRole("button", { name: "HEMA" }).click();
  await addPhotos(page).setInputFiles(FIXTURE);
  await expect(tile(page, 1)).toContainText("UNSAVED");

  await save(page);

  await expect(page).toHaveURL(/\/admin\/products\?product=prd-[0-9a-f]{8}$/);
  await expect(saveState(page)).toHaveText(SAVED);
  await page.goto(paths.products.details("mt-pocket-notes"));
  await expect(page.getByTestId("gallery-main").locator("img")).toHaveAttribute(
    "alt",
    "MT Pocket Notes, photo 1 of 1",
  );
});
