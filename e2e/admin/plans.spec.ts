import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { LIVE, SKIP_LIVE, signInAndOnboard } from "../member-app/helpers";
import { resetSampleData, signInAs } from "./helpers";

// Plans & prices on sample data (Phase 4, ticket 01; stories 145, 146, 151p
// and 151r): an Owner opens the SALES group's Plans & prices, adds a 365-day
// CE Plan while its preview shows the per-month figure, then ticks Best
// value on it, and CE's 90-day Plan loses its tag. Switching a Plan off keeps
// it listed, marked off. An Editor sees no SALES group, and the screen
// refuses them. Selling a Course (Phase 5, ticket 06): an Owner switches the
// "HPGE Crash Course" in its Course settings, each way confirmed with how
// many Members it affects, then sets ₱1,299 in One-time purchases and turns
// it on sale, and it shows on CE's Plans page; an Editor sees the choice
// read-only.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const list = (page: Page) => page.getByRole("region", { name: "Plans" });
/** A Plan's row in the list, by its name and period as its link reads. */
const row = (page: Page, name: RegExp) =>
  list(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name }) });

const CE_YEAR = /CE All-Access\s*12 months/;
const CE_QUARTER = /CE All-Access\s*3 months/;

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("an Owner", () => {
  test("adds a 365-day CE Plan, previewed with its per-month figure, then makes it Best value", async ({
    page,
  }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);
    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: /Plans & prices/ })
      .click();
    await expect(page).toHaveURL(/\/admin\/plans$/);
    await expect(row(page, CE_QUARTER).getByText("BEST VALUE")).toBeVisible();

    await page.getByRole("link", { name: "+ New plan" }).click();
    const editor = page.getByRole("form", { name: "New plan" });
    await expect(editor.getByLabel("EXAM")).toHaveValue("CE");
    await editor.getByLabel("ACCESS PERIOD").selectOption({ label: "12 months · 365 days" });
    await editor.getByLabel("PRICE · WHOLE PESOS").fill("3,999");
    await editor.getByRole("switch", { name: "On sale" }).click();

    const preview = editor.getByRole("region", { name: "PREVIEW · MEMBER PLANS PAGE" });
    await expect(preview.getByText("CE · 12 MONTHS")).toBeVisible();
    await expect(preview.getByText("₱3,999")).toBeVisible();
    await expect(preview.getByText("₱333 / month")).toBeVisible();

    await editor.getByRole("button", { name: "Add plan" }).click();
    const saved = page.getByRole("form", { name: "Edit plan" });
    await expect(saved.getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE PLANS PAGE");
    await expect(page).toHaveURL(/\/admin\/plans\?plan=[0-9a-f-]{36}$/);
    await expect(row(page, CE_YEAR)).toContainText("₱3,999");

    await saved.getByRole("switch", { name: "Mark as best value" }).click();
    await saved.getByRole("button", { name: "Save" }).click();
    await expect(saved.getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE PLANS PAGE");
    await expect(row(page, CE_YEAR).getByText("BEST VALUE")).toBeVisible();
    await expect(row(page, CE_QUARTER).getByText("BEST VALUE")).toHaveCount(0);
  });

  test("switches a Plan off, and it stays listed, marked off", async ({ page }) => {
    await signInAs(page, "owner", `${paths.admin.plans}?exam=me`);
    await expect(page).toHaveURL(/\/admin\/plans\?exam=me$/);
    const me = row(page, /ME All-Access\s*1 month/);

    await me.getByRole("switch", { name: "On sale: ME All-Access · 1 month" }).click();
    await expect(me.getByText("NOT ON SALE")).toBeVisible();

    await page.reload();
    await expect(me.getByRole("switch")).not.toBeChecked();
    await expect(me.getByText("NOT ON SALE")).toBeVisible();
  });
});

/** Bea, in her own browser context, sees CE's One-time purchases on the Plans page. */
async function memberSeesOnPlans(browser: Browser, text: RegExp) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInAndOnboard(page, "tester", "CE");
    await page.goto(paths.memberApp.plansFor("CE"));
    await expect(page.getByRole("radiogroup", { name: "ONE-TIME PURCHASES" })).toContainText(text);
  } finally {
    await context.close();
  }
}

test.describe("an Owner selling a Course (Phase 5, ticket 06)", () => {
  test("switches the HPGE Crash Course each way, confirmed with the count, then prices it and puts it on sale", async ({
    page,
    browser,
  }) => {
    // The sample Courses and Bea are the in-memory sample data's.
    test.skip(LIVE, SKIP_LIVE);
    test.setTimeout(120_000);
    await signInAs(page, "owner", paths.admin.courses);
    await page
      .getByRole("navigation", { name: "COURSES · 3" })
      .getByRole("link", { name: /HPGE Crash Course/ })
      .click();
    await page.getByRole("link", { name: "Course settings →" }).click();
    const how = page.getByRole("radiogroup", { name: "How members get it" });
    await expect(how.getByRole("radio", { name: "Sold separately" })).toBeChecked();

    // To Included: the confirmation counts who gains it.
    await how.getByRole("radio", { name: "Included in CE All-Access" }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/\d+ members? with active CE All-Access gains? it now/);
    await dialog.getByRole("button", { name: "Include in All-Access" }).click();
    await expect(how.getByRole("radio", { name: "Included in CE All-Access" })).toBeChecked();

    // Back to Sold separately: the confirmation counts who loses it.
    await how.getByRole("radio", { name: "Sold separately" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/\d+ members? who watched it through CE All-Access/);
    await dialog.getByRole("button", { name: "Sell separately" }).click();
    await expect(how.getByRole("radio", { name: "Sold separately" })).toBeChecked();
    await expect(page.getByText("No price yet")).toBeVisible();

    // One-time purchases: ₱1,299, then On sale.
    await page.getByRole("link", { name: "Set the price in Plans & prices" }).click();
    await expect(page).toHaveURL(/\/admin\/plans$/);
    const oneTime = page.getByRole("region", { name: /ONE-TIME PURCHASES · NO EXPIRY/ });
    await oneTime.getByRole("textbox", { name: "Price: HPGE Crash Course" }).fill("1,299");
    await oneTime
      .getByRole("listitem")
      .filter({ hasText: "HPGE Crash Course" })
      .getByRole("button", { name: "Save price" })
      .click();
    await expect(oneTime.getByRole("textbox", { name: "Price: HPGE Crash Course" })).toHaveValue(
      "1299",
    );
    const hpge = oneTime.getByRole("listitem").filter({ hasText: "HPGE Crash Course" });
    await expect(hpge.getByText("NOT ON SALE")).toBeVisible();
    await hpge.getByRole("switch", { name: "On sale: HPGE Crash Course" }).click();
    // Saved once the page reads it again: the NOT ON SALE tag goes.
    await expect(hpge.getByText("NOT ON SALE")).toHaveCount(0);
    await page.reload();
    await expect(oneTime.getByRole("switch", { name: "On sale: HPGE Crash Course" })).toBeChecked();

    await memberSeesOnPlans(browser, /HPGE Crash Course.*₱1,299/);
  });
});

test.describe("an Editor", () => {
  test("sees how Members get a Course read-only, with no way to switch it", async ({ page }) => {
    test.skip(LIVE, SKIP_LIVE);
    await signInAs(page, "editor", paths.admin.courses);
    await page
      .getByRole("navigation", { name: "COURSES · 3" })
      .getByRole("link", { name: /PSAD Masterclass/ })
      .click();
    await page.getByRole("link", { name: "Course settings →" }).click();
    await expect(page.getByText("Sold separately · ₱1,499")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "How members get it" })).toHaveCount(0);
  });

  test("sees no SALES group, and is refused Plans & prices", async ({ page }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByText("MEMBER APP", { exact: true })).toBeVisible();
    await expect(nav.getByText("SALES", { exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Plans & prices/ })).toHaveCount(0);

    await page.goto(paths.admin.plans);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
  });
});
