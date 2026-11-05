import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// About's text from Pages & promo on sample data (ticket 21): an Editor opens
// ABOUT's Iloilo City roots, saves a heading, and the About page shows it as
// typed, markup and all, as plain text; cleared, today's heading is back.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAVED = "✓ SAVED · LIVE ON THE SITE";
const TODAY = "Packed in Iloilo. Shipped to wherever you’re reviewing.";
const HEADING = "Packed in Iloilo. Shipped to <b>you</b>.";

const editor = (page: Page) => page.getByRole("complementary", { name: "Site page editor" });
const saveState = (page: Page) => editor(page).getByRole("status");

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("an Editor saves the Iloilo City roots heading, and the About page shows it", async ({
  page,
}) => {
  await signInAs(page, "editor", `${paths.admin.examPages}?page=site&site=about`);
  const about = page.getByRole("region", { name: "ABOUT Site page" });
  await about.getByRole("link", { name: /^Iloilo City roots/ }).click();
  await expect(page).toHaveURL(/\?page=site&site=about&section=roots$/);
  await expect(editor(page)).toContainText("EDIT · ILOILO CITY ROOTS · ABOUT");

  const heading = editor(page).getByLabel("HEADING");
  await expect(heading).toHaveAttribute("placeholder", TODAY);
  await heading.fill(HEADING);
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.about);
  await expect(page.getByRole("heading", { level: 2, name: HEADING })).toBeVisible();
  await expect(page.locator("main b")).toHaveCount(0);
  // Every other section is today's.
  await expect(page.getByRole("heading", { level: 2, name: "The mission" })).toBeVisible();

  await page.goto(`${paths.admin.examPages}?page=site&site=about&section=roots`);
  await editor(page).getByLabel("HEADING").fill("");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(saveState(page)).toHaveText(SAVED);
  await page.goto(paths.about);
  await expect(page.getByRole("heading", { level: 2, name: TODAY })).toBeVisible();
});
