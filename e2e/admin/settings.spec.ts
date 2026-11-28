import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { LIVE, resetSampleData, sampleEmail, signInAs } from "./helpers";

// Settings on sample data (ticket 02): an Owner edits the contact email, the
// store and social links and the trust figures, and each save is live on the
// Website at once. Plus the conflict check between two Owners, Reset, and an
// Editor refused. The business details for Payment Acknowledgements (Phase 4,
// ticket 06) save the same way; billing.spec.ts shows them on one. Staff
// Activity (Phase 4, ticket 15) lists the Owner's save, read-only, and refuses
// an Editor.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SEED_EMAIL = "aceyourcourseinc@gmail.com";
const NEW_EMAIL = "hello@aceyourcourse.ph";
const SEED_LAZADA = "https://www.lazada.com.ph/shop/aceyourcourse";

const MANILA_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Today in Manila, as the Admin writes it: "1 NOV 2026". */
function todayInManila() {
  const parts = Object.fromEntries(
    MANILA_DATE.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

/**
 * The days a save made from `before` until now can be dated in Manila, as a
 * pattern: today, or both days when the save crossed Manila midnight.
 */
function savedOn(before: string) {
  const days = new Set([before, todayInManila()]);
  // Letters, digits and spaces only, so nothing needs escaping.
  return [...days].join("|");
}

const part = (page: Page, name: string) => page.getByRole("form", { name });
const contactPart = (page: Page) => part(page, "CONTACT EMAIL");
const linksPart = (page: Page) => part(page, "STORE & SOCIAL LINKS");
const figuresPart = (page: Page) => part(page, "TRUST FIGURES");
const businessPart = (page: Page) => part(page, "BUSINESS DETAILS");
const footer = (page: Page) => page.getByRole("contentinfo");

async function openSettings(page: Page) {
  await signInAs(page, "owner", paths.admin.settings);
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(contactPart(page).getByRole("status")).toHaveText("UP TO DATE");
}

async function saveContactEmail(page: Page, email: string) {
  await contactPart(page).getByLabel("EMAIL ADDRESS").fill(email);
  await contactPart(page).getByRole("button", { name: "Save" }).click();
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("an Owner's new contact email is live in the Website footer and on the FAQ page", async ({
  page,
}) => {
  await openSettings(page);
  await expect(page.getByText("NOT CHANGED IN THE ADMIN YET")).toBeVisible();

  const email = contactPart(page).getByLabel("EMAIL ADDRESS");
  await email.fill(NEW_EMAIL);
  await expect(contactPart(page).getByRole("status")).toHaveText("UNSAVED CHANGES");
  const before = todayInManila();
  await contactPart(page).getByRole("button", { name: "Save" }).click();

  await expect(contactPart(page).getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");
  await expect(
    page.getByText(new RegExp(`^LAST CHANGED (${savedOn(before)}) BY ANGEL ROSE L\\. LEPAÑA$`)),
  ).toBeVisible();

  await page.goto(paths.home);
  await expect(footer(page).getByRole("link", { name: NEW_EMAIL })).toHaveAttribute(
    "href",
    `mailto:${NEW_EMAIL}`,
  );
  await expect(footer(page).getByRole("link", { name: SEED_EMAIL })).toHaveCount(0);

  await page.goto(paths.faq);
  await expect(page.getByRole("main").getByText(NEW_EMAIL).first()).toBeVisible();
});

test("a new Lazada shop link updates every Lazada button; clearing it hides them, and clearing Instagram hides it", async ({
  page,
}) => {
  const lazadaShop = "https://www.lazada.com.ph/shop/aceyourcourse-ph";
  await openSettings(page);
  const links = linksPart(page);

  await links.getByLabel("LAZADA").fill(lazadaShop);
  await links.getByRole("button", { name: "Save links" }).click();
  await expect(links.getByRole("status")).toHaveText("✓ SAVED · EVERY STORE BUTTON UPDATED");

  // No Product has a Lazada Listing of its own, so each button opens the shop page.
  await page.goto(paths.products.details("ce-formula-flash-cards"));
  await expect(
    page.getByRole("main").getByRole("link", { name: "Buy on Lazada (opens in a new tab)" }),
  ).toHaveAttribute("href", lazadaShop);
  await expect(
    footer(page)
      .getByRole("list", { name: "Marketplaces" })
      .getByRole("link", { name: /Lazada/ }),
  ).toHaveAttribute("href", lazadaShop);

  await page.goto(paths.admin.settings);
  await linksPart(page).getByLabel("LAZADA").fill("");
  await linksPart(page).getByLabel("INSTAGRAM").fill("");
  await linksPart(page).getByRole("button", { name: "Save links" }).click();
  await expect(linksPart(page).getByRole("status")).toHaveText(
    "✓ SAVED · EVERY STORE BUTTON UPDATED",
  );

  await page.goto(paths.products.details("ce-formula-flash-cards"));
  await expect(page.getByRole("link", { name: /Buy on Shopee/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Lazada/ })).toHaveCount(0);
  await expect(footer(page).getByRole("link", { name: /Instagram/ })).toHaveCount(0);
  await expect(footer(page).getByRole("link", { name: /Facebook/ })).toHaveCount(1);
});

test("saving the trust figures dates them today in Manila, and the Website's trust lines show them", async ({
  page,
}) => {
  await openSettings(page);
  const figures = figuresPart(page);
  await expect(figures.getByText("AS OF 29 OCT 2026 · SAVING SETS IT TO TODAY")).toBeVisible();

  await figures.getByLabel("RATING", { exact: true }).fill("4.9");
  await figures.getByLabel("NO. OF RATINGS").fill("900");
  await figures.getByLabel("FOLLOWERS").fill("3.8K");
  const before = todayInManila();
  await figures.getByRole("button", { name: "Save figures" }).click();

  await expect(figures.getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");
  await expect(
    figures.getByText(new RegExp(`^AS OF (${savedOn(before)}) · SAVING SETS IT TO TODAY$`)),
  ).toBeVisible();

  await page.goto(paths.reviews);
  await expect(footer(page)).toContainText("4.9 · 900 ratings");
  await expect(footer(page).getByRole("link", { name: /Shopee · 3\.8K followers/ })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("3.8K");
});

test("refuses what isn't valid with the mockup's messages, keeping the form's values and the Website as it was", async ({
  page,
}) => {
  await openSettings(page);

  await saveContactEmail(page, "not-an-email");
  await expect(contactPart(page).getByText("ENTER A VALID EMAIL ADDRESS")).toBeVisible();
  await expect(contactPart(page).getByLabel("EMAIL ADDRESS")).toHaveValue("not-an-email");
  await expect(contactPart(page).getByRole("status")).toHaveText("FIX THE EMAIL ADDRESS FIRST");

  const links = linksPart(page);
  await links.getByLabel("SHOPEE").fill(SEED_LAZADA);
  await links.getByLabel("TIKTOK PROFILE").fill("https://www.tiktok.com/aceyourcourse");
  await links.getByRole("button", { name: "Save links" }).click();
  await expect(links.getByText("SHOULD BE A SHOPEE.PH LINK")).toBeVisible();
  await expect(links.getByText("SHOULD LOOK LIKE TIKTOK.COM/@NAME")).toBeVisible();
  await expect(links.getByLabel("SHOPEE")).toHaveValue(SEED_LAZADA);

  const figures = figuresPart(page);
  await figures.getByLabel("RATING", { exact: true }).fill("4.85");
  await figures.getByLabel("NO. OF RATINGS").fill("-1");
  await figures.getByLabel("FOLLOWERS").fill("");
  await figures.getByRole("button", { name: "Save figures" }).click();
  await expect(
    figures.getByText("ENTER A RATING FROM 0 TO 5, WITH ONE DECIMAL AT MOST"),
  ).toBeVisible();
  await expect(figures.getByText("ENTER A WHOLE NUMBER, 0 OR MORE")).toBeVisible();
  await expect(
    figures.getByText("ENTER THE FOLLOWERS AS SHOPEE SHOWS THEM, LIKE 3.7K"),
  ).toBeVisible();

  await page.goto(paths.home);
  await expect(footer(page).getByRole("link", { name: SEED_EMAIL })).toBeVisible();
  await expect(footer(page)).toContainText("4.8 · 874 ratings");
});

test("when two Owners edit, the second save is refused, naming the first, and keeps its values", async ({
  browser,
}) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  await openSettings(first);
  await openSettings(second);

  await saveContactEmail(first, NEW_EMAIL);
  await expect(contactPart(first).getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");

  await saveContactEmail(second, "second@aceyourcourse.ph");
  await expect(contactPart(second).getByRole("alert")).toHaveText(
    /Angel Rose L\. Lepaña saved these settings at \d{1,2}:\d{2} [AP]M\. Copy your changes, then reload to see theirs\./,
  );
  await expect(contactPart(second).getByRole("status")).toHaveText("NOT SAVED");
  await expect(contactPart(second).getByLabel("EMAIL ADDRESS")).toHaveValue(
    "second@aceyourcourse.ph",
  );

  // The first save stands, on the Website and on reload.
  await second.getByRole("button", { name: "Reload" }).click();
  await expect(contactPart(second).getByLabel("EMAIL ADDRESS")).toHaveValue(NEW_EMAIL);
  await first.context().close();
  await second.context().close();
});

test("the header's Reset starts the sample data again, and the Website shows the seed", async ({
  page,
}) => {
  test.skip(LIVE, "The header's Reset exists on the sample data only.");
  await openSettings(page);
  await saveContactEmail(page, NEW_EMAIL);
  await expect(contactPart(page).getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");

  await page.getByRole("banner").getByRole("button", { name: "Reset" }).click();

  await expect(contactPart(page).getByLabel("EMAIL ADDRESS")).toHaveValue(SEED_EMAIL);
  await expect(page.getByText("NOT CHANGED IN THE ADMIN YET")).toBeVisible();
  await page.goto(paths.home);
  await expect(footer(page).getByRole("link", { name: SEED_EMAIL })).toBeVisible();
});

test("POST /api/dev/sample-data/reset starts the sample data again, and the Website shows the seed", async ({
  page,
  request,
}) => {
  await openSettings(page);
  await saveContactEmail(page, NEW_EMAIL);
  await expect(contactPart(page).getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");
  await page.goto(paths.home);
  await expect(footer(page).getByRole("link", { name: NEW_EMAIL })).toBeVisible();

  await resetSampleData(request);

  await page.reload();
  await expect(footer(page).getByRole("link", { name: SEED_EMAIL })).toBeVisible();
});

test("an Owner saves the business details, the TIN kept with dashes; a TIN in the wrong shape is refused", async ({
  page,
}) => {
  await openSettings(page);
  const business = businessPart(page);
  await expect(business.getByLabel("BUSINESS NAME")).toHaveValue("Ace Your Course");

  await business.getByLabel("ADDRESS").fill("Iloilo City, Iloilo");
  await business.getByLabel("TIN (OPTIONAL)").fill("12345");
  await business.getByRole("button", { name: "Save details" }).click();
  await expect(
    business.getByText("ENTER 9 DIGITS, LIKE 123-456-789, WITH A 3- OR 5-DIGIT BRANCH CODE IF ANY"),
  ).toBeVisible();

  await business.getByLabel("TIN (OPTIONAL)").fill("123456789");
  await business.getByRole("radio", { name: "Yes" }).check();
  await business.getByRole("button", { name: "Save details" }).click();
  await expect(business.getByRole("status")).toHaveText("✓ SAVED · ON EVERY ACKNOWLEDGEMENT");
  await expect(business.getByLabel("TIN (OPTIONAL)")).toHaveValue("123-456-789");

  await page.reload();
  await expect(businessPart(page).getByLabel("ADDRESS")).toHaveValue("Iloilo City, Iloilo");
  await expect(businessPart(page).getByRole("radio", { name: "Yes" })).toBeChecked();
});

test("an Editor is refused Settings with the owners-only 403 screen", async ({ page }) => {
  await signInAs(page, "editor");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(paths.admin.settings);
  await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
});

// Staff Activity (Phase 4, ticket 15): read-only, under Settings, Owners only.
const activityList = (page: Page) => page.getByRole("list", { name: "Staff Activity" });
const activityItems = (page: Page) => activityList(page).locator(":scope > li");

test("an Owner's save is at the top of Staff Activity under their name, and the list filters by them", async ({
  page,
}) => {
  await openSettings(page);
  const before = todayInManila();
  await saveContactEmail(page, NEW_EMAIL);
  await expect(contactPart(page).getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");

  await page.getByRole("link", { name: "Open Staff Activity" }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/activity$/);
  await expect(page.getByRole("heading", { level: 2, name: "STAFF ACTIVITY" })).toBeVisible();
  const top = activityItems(page).first();
  await expect(top).toContainText("Angel Rose L. Lepaña");
  await expect(top).toContainText(sampleEmail("owner"));
  await expect(top).toContainText("Settings");
  await expect(top.getByRole("list", { name: "What changed" })).toContainText(
    "Changed: contactEmail",
  );
  // Dated today in Manila, as the Admin writes a time: "26 Nov 2026, 1:30 am".
  await expect(top.locator("time")).toHaveText(
    new RegExp(`^(${savedOn(before)}),\\s\\d{1,2}:\\d{2}\\s[ap]m$`, "i"),
  );
  await top.getByText("Before and after").click();
  await expect(top.getByText(NEW_EMAIL)).toBeVisible();

  await page
    .getByRole("combobox", { name: "Staff member" })
    .selectOption({ label: `Angel Rose L. Lepaña · ${sampleEmail("owner")}` });
  await expect(page).toHaveURL(/actor=angel%40aceyourcourse\.ph$/);
  await expect(activityItems(page)).not.toHaveCount(0);
  for (const item of await activityItems(page).all()) {
    await expect(item).toContainText("Angel Rose L. Lepaña");
  }

  await page.getByRole("combobox", { name: "Area" }).selectOption({ label: "Settings" });
  await expect(page).toHaveURL(/actor=angel%40aceyourcourse\.ph&area=settings$/);
  await expect(activityItems(page).first()).toContainText("Changed: contactEmail");
});

test("a filter nothing matches shows No activity, with a way back to all of it", async ({
  page,
}) => {
  await signInAs(page, "owner", `${paths.admin.staffActivity}?actor=nobody%40example.com`);
  await expect(page.getByText("No activity")).toBeVisible();
  await page.getByRole("link", { name: "Show all activity" }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/activity$/);
});

test("an Editor is refused Staff Activity with the owners-only 403 screen", async ({ page }) => {
  await signInAs(page, "editor");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(paths.admin.staffActivity);
  await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
});
