import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The Home promo banner and the announcement bar on sample data (ticket 10):
// an Editor turns the banner on with dates around today and sees it on
// Home, sees future dates wait, and turns it off now after the
// confirmation; then edits, reorders, adds and removes the announcement's
// messages, and a Visitor who dismissed the bar sees it again. The dates are
// worked out from today in Manila, so the spec doesn't age.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The Manila date `days` from today, as YYYY-MM-DD. Manila is UTC+8 all year. */
const manilaDay = (days: number) =>
  new Date(Date.now() + 8 * 60 * 60 * 1000 + days * DAY).toISOString().slice(0, 10);
/** "2026-11-09" → "9 Nov", as the confirmation says it; the status line says "9 NOV". */
const dayMonth = (date: string) => {
  const [, month = 1, day = 1] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
};
/** The days a banner runs, as the status line says them: "9–11 NOV" or "30 NOV–2 DEC". */
function shows(start: string, end: string) {
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    return `${dayMonth(start)} ${start.slice(0, 4)}–${dayMonth(end)} ${end.slice(0, 4)}`;
  }
  const from =
    start.slice(5, 7) === end.slice(5, 7) ? String(Number(start.slice(8))) : dayMonth(start);
  return `${from}–${dayMonth(end)}`.toUpperCase();
}

const PAYDAY = "Payday sale · 5% off every reviewer";

const editor = (page: Page) => page.getByRole("complementary", { name: "Page editor" });
const bannerForm = (page: Page) => editor(page).getByRole("form", { name: "Home promo banner" });
const saveState = (page: Page) => editor(page).getByRole("status");
const homeStrip = (page: Page) => page.getByRole("complementary", { name: "Sale" });
const message = (page: Page, n: number) =>
  editor(page).getByRole("group", { name: `MESSAGE ${n}` });
const dismiss = (page: Page) => page.getByRole("button", { name: "Dismiss announcement" });
/** The announcement bar's message, shown while the bar is. */
const barMessage = (page: Page, text: string) =>
  page.getByRole("link", { name: text, exact: true });

async function openPromo(page: Page, which: "promo" | "announcement") {
  await signInAs(page, "editor", `${paths.admin.examPages}?page=${which}`);
  await expect(editor(page)).toBeVisible();
}

/** Fills the banner's fields and saves them. */
async function saveBanner(page: Page, fields: { startDate: string; endDate: string }) {
  const form = bannerForm(page);
  await form.getByLabel("BANNER TEXT").fill(PAYDAY);
  await form.getByLabel("BUTTON LABEL").fill("Shop now");
  await form.getByLabel("LINK", { exact: true }).fill("/products?format=posters");
  await form.getByLabel("STARTS ON").fill(fields.startDate);
  await form.getByLabel("ENDS ON").fill(fields.endDate);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText("✓ SAVED · LIVE ON HOME");
}

test.beforeEach(async ({ request, page }) => {
  await resetSampleData(request);
  // The bar keeps to its first message, so the spec can read it.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("an Editor turns the banner on around today, sees it on Home, then turns it off now", async ({
  page,
}) => {
  const [start, end] = [manilaDay(-1), manilaDay(1)];
  await openPromo(page, "promo");
  await expect(editor(page).getByText("Status: OFF", { exact: true })).toBeVisible();
  await saveBanner(page, { startDate: start, endDate: end });
  await editor(page).getByRole("switch", { name: "Show banner" }).click();

  await expect(
    editor(page).getByText(`ON · SHOWS ${shows(start, end).toUpperCase()}`),
  ).toBeVisible();

  await page.goto(paths.home);
  await expect(homeStrip(page)).toContainText(PAYDAY);
  await expect(homeStrip(page).getByRole("link", { name: "Shop now" })).toHaveAttribute(
    "href",
    "/products?format=posters",
  );

  await page.goto(`${paths.admin.examPages}?page=promo`);
  await editor(page).getByRole("button", { name: "Turn off banner now" }).click();
  const dialog = page.getByRole("dialog", { name: `Turn off the “${PAYDAY}” banner now?` });
  await expect(dialog).toContainText(
    `It disappears from Home right away instead of on ${dayMonth(end)}.`,
  );
  await dialog.getByRole("button", { name: "Turn off banner" }).click();

  await expect(page.getByText("✓ TURNED OFF · THE BANNER IS OFF HOME")).toBeVisible();
  await expect(editor(page).getByText("Status: OFF", { exact: true })).toBeVisible();
  await expect(editor(page).getByRole("switch", { name: "Show banner" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.goto(paths.home);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(homeStrip(page)).toHaveCount(0);
});

test("future dates say SCHEDULED, and Home shows no strip until the start day", async ({
  page,
}) => {
  const start = manilaDay(5);
  await openPromo(page, "promo");
  await saveBanner(page, { startDate: start, endDate: manilaDay(7) });
  await editor(page).getByRole("switch", { name: "Show banner" }).click();

  await expect(
    editor(page).getByText(`SCHEDULED · STARTS ${dayMonth(start).toUpperCase()}`),
  ).toBeVisible();
  await expect(editor(page).getByRole("button", { name: "Turn off banner now" })).toHaveCount(0);
  await page.goto(paths.home);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(homeStrip(page)).toHaveCount(0);
});

test("a banner past its end date says ENDED and is off Home, with nobody turning it off", async ({
  page,
}) => {
  const end = manilaDay(-1);
  await openPromo(page, "promo");
  await saveBanner(page, { startDate: manilaDay(-3), endDate: end });
  await editor(page).getByRole("switch", { name: "Show banner" }).click();

  await expect(
    editor(page).getByText(`ENDED · TURNED OFF BY ITSELF ${dayMonth(end).toUpperCase()}`),
  ).toBeVisible();
  await page.goto(paths.home);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(homeStrip(page)).toHaveCount(0);
});

test("an end date before the start and an http link are refused, and the form keeps them", async ({
  page,
}) => {
  await openPromo(page, "promo");
  const form = bannerForm(page);
  await form.getByLabel("LINK", { exact: true }).fill("http://x");
  await form.getByLabel("STARTS ON").fill(manilaDay(3));
  await form.getByLabel("ENDS ON").fill(manilaDay(2));
  await form.getByRole("button", { name: "Save" }).click();

  await expect(saveState(page)).toHaveText("FIX THE FIELDS MARKED IN RED");
  await expect(form.getByText("The end date can’t be before the start date.")).toBeVisible();
  await expect(form.getByText("ENTER AN HTTPS LINK OR A PATH STARTING WITH /")).toBeVisible();
  await expect(form.getByLabel("LINK", { exact: true })).toHaveValue("http://x");
});

test("a Visitor who dismissed the bar sees it again once an Editor edits a message", async ({
  page,
}) => {
  await page.goto(paths.home);
  await expect(barMessage(page, "Physical copies on Shopee, Lazada & TikTok Shop")).toBeVisible();
  await dismiss(page).click();
  await expect(dismiss(page)).toBeHidden();

  await openPromo(page, "announcement");
  await message(page, 1).getByLabel("TEXT").fill("Printed copies on Shopee, Lazada & TikTok Shop");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText("✓ SAVED · LIVE ON EVERY PAGE");

  for (const path of [paths.home, paths.faq]) {
    await page.goto(path);
    await expect(barMessage(page, "Printed copies on Shopee, Lazada & TikTok Shop")).toBeVisible();
  }
});

test("saving with no change keeps the bar dismissed", async ({ page }) => {
  await page.goto(paths.home);
  await dismiss(page).click();
  await expect(dismiss(page)).toBeHidden();

  await openPromo(page, "announcement");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText("✓ SAVED · LIVE ON EVERY PAGE");

  await page.goto(paths.home);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(dismiss(page)).toBeHidden();
});

test("▲▼ reorders the messages, + Add message adds a third, and Remove takes one away", async ({
  page,
}) => {
  await openPromo(page, "announcement");
  // The seed has three messages: Remove the app's, then add one back.
  await message(page, 2).getByRole("button", { name: "Remove message 2" }).click();
  await expect(editor(page).getByText("2 OF 3 MESSAGES")).toBeVisible();
  await editor(page).getByRole("button", { name: "+ Add message" }).click();
  await message(page, 3).getByLabel("TEXT").fill("New: CE flash cards 2.0");
  await message(page, 3).getByLabel("LINK", { exact: true }).fill("/products");
  await expect(editor(page).getByRole("button", { name: "+ Add message" })).toBeDisabled();
  await message(page, 3).getByRole("button", { name: "Move message 3 up" }).click();
  await message(page, 2).getByRole("button", { name: "Move message 2 up" }).click();
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText("✓ SAVED · LIVE ON EVERY PAGE");

  await page.goto(paths.home);
  await expect(barMessage(page, "New: CE flash cards 2.0")).toBeVisible();

  // Removing down to one is the floor: the last can't go.
  await page.goto(`${paths.admin.examPages}?page=announcement`);
  await message(page, 3).getByRole("button", { name: "Remove message 3" }).click();
  await message(page, 2).getByRole("button", { name: "Remove message 2" }).click();
  await expect(message(page, 1).getByRole("button", { name: "Remove message 1" })).toBeDisabled();
});
