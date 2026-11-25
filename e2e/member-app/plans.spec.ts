import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, signInAndOnboard, signInAsMember } from "./helpers";

// The Member's Plans page on sample data (Phase 4, ticket 02; stories 134,
// 151c, 151e and 151m): a Member with CE opens Plans on CE and sees each CE
// Plan with the date their access would end, and Pay with the payments fake
// (ticket 03; "Buying opens soon", disabled, in live mode, which has no
// payments client here). Locked CE content's "See plans",
// and ended access's "Renew access", open Plans on CE. A Plan an Owner
// switches off leaves the page. Every Exam's starting Plans are on sale (CE:
// 1, 3 and 6 months).

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const pills = (page: Page) => page.getByRole("navigation", { name: "Exams" });
/** An Exam's pill, by its code. */
const pill = (page: Page, code: string) =>
  pills(page).getByRole("link", { name: new RegExp(`^${code} · `) });
const planGroup = (page: Page) => page.getByRole("radiogroup", { name: /ALL-ACCESS/ });
const UNTIL = /Until \d{1,2} [A-Z][a-z]{2} \d{4}/;

/** An Owner adds an email to the Beta Tester list in the Admin, in their own browser context. */
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

/** An Owner switches CE's 1-month Plan off in Plans & prices, in their own browser context. */
async function ownerSwitchesOffCeMonth(browser: Browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", `${paths.admin.plans}?exam=ce`);
    const month = page
      .getByRole("region", { name: "Plans" })
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: /CE All-Access\s*1 month/ }) });
    await month.getByRole("switch", { name: "On sale: CE All-Access · 1 month" }).click();
    await expect(month.getByText("NOT ON SALE")).toBeVisible();
  } finally {
    await context.close();
  }
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("a Member with CE", () => {
  test("opens Plans on CE: each Plan with its end, and Pay", async ({ page }) => {
    await signInAndOnboard(page, "tester", "CE");
    await memberNav(page).getByRole("link", { name: /Plans/ }).click();
    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect(page.getByRole("heading", { level: 1, name: "Choose your access" })).toBeVisible();

    await expect(pill(page, "CE")).toHaveAttribute("aria-current", "page");
    await expect(planGroup(page).getByRole("radio")).toHaveCount(3);
    for (const period of ["1 month", "3 months", "6 months"]) {
      // Each row's radio is named by its whole row: period, Best value, end and price.
      await expect(
        planGroup(page).getByRole("radio", { name: new RegExp(`^${period}.*${UNTIL.source}`) }),
      ).toHaveCount(1);
    }
    await expect(planGroup(page).getByRole("radio", { name: /^3 months/ })).toBeChecked();
    if (LIVE) await expect(page.getByRole("button", { name: "Buying opens soon" })).toBeDisabled();
    else await expect(page.getByRole("button", { name: "Pay ₱1,299 with PayMongo" })).toBeEnabled();

    // The sidebar's current item fades to Plans: let it finish before measuring colours.
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished)),
    );
    await expectNoBlockingViolations(page);

    // Another Exam's pill opens its Plans.
    await pill(page, "ME").click();
    await expect(page).toHaveURL(/\/app\/plans\?exam=ME$/);
    await expect(planGroup(page).getByRole("radio")).toHaveCount(1);
  });

  test("no longer sees a Plan an Owner switches off", async ({ page, browser }) => {
    await signInAndOnboard(page, "tester", "CE");
    await page.goto(paths.memberApp.plansFor("CE"));
    await expect(planGroup(page).getByRole("radio")).toHaveCount(3);

    await ownerSwitchesOffCeMonth(browser);

    await page.reload();
    await expect(planGroup(page).getByRole("radio")).toHaveCount(2);
    await expect(planGroup(page).getByRole("radio", { name: /^1 month/ })).toHaveCount(0);
  });

  test("comes back to Plans for the Exam asked for after signing in again", async ({ page }) => {
    await signInAndOnboard(page, "tester", "CE");
    await page.context().clearCookies();

    await page.goto(paths.memberApp.plansFor("ME"));
    await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp%2Fplans%3Fexam%3DME$/);
    await signInAsMember(page, "tester", paths.memberApp.plansFor("ME"));
    await expect(page).toHaveURL(/\/app\/plans\?exam=ME$/, { timeout: 20_000 });
    await expect(pill(page, "ME")).toHaveAttribute("aria-current", "page");
  });
});

test.describe("a lock leads to Plans", () => {
  test("locked CE content's See plans opens Plans on CE", async ({ page, browser }) => {
    await ownerAddsTester(browser, "stranger@example.com");
    await signInAndOnboard(page, "stranger", "CE");
    await memberNav(page)
      .getByRole("link", { name: /Library/ })
      .click();
    await page
      .getByRole("link", { name: "Quiz, locked: unlock with CE All-Access" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "See plans", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/plans\?exam=CE$/);
    await expect(pill(page, "CE")).toHaveAttribute("aria-current", "page");
  });

  test("ended CE access's Renew access opens Plans on CE", async ({ page }) => {
    await signInAndOnboard(page, "lapsed", "CE");
    await memberNav(page)
      .getByRole("link", { name: /Library/ })
      .click();
    await page
      .getByRole("link", { name: "Reviewer PDF, locked: your CE All-Access ended" })
      .first()
      .click();

    await page.getByRole("link", { name: "Renew access", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/plans\?exam=CE$/);
    await expect(planGroup(page).getByRole("radio")).toHaveCount(3);
  });
});
