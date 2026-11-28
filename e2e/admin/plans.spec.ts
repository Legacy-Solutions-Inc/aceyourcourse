import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Plans & prices on sample data (Phase 4, ticket 01; stories 145, 146, 151p
// and 151r): an Owner opens the SALES group's Plans & prices, adds a 365-day
// CE Plan while its preview shows the per-month figure, then ticks Best
// value on it, and CE's 90-day Plan loses its tag. Switching a Plan off keeps
// it listed, marked off. An Editor sees no SALES group, and the screen
// refuses them.

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

test.describe("an Editor", () => {
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
