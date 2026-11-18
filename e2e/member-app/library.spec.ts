import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, signInAndOnboard, SKIP_LIVE } from "./helpers";

// The Library and opening an item on sample data (Phase 3, ticket 05;
// stories 93, 94, 103 and 133i): the Beta Tester's CE pass opens CE, a new
// tester with no pass gets Free Preview and the unlock prompt, the lapsed
// tester's ended pass says so, and the Library follows the Topics editor.
// The sample CE content: MSTC has Simple Curves (a Free Preview deck, a quiz
// and a Reviewer PDF), Spiral Curves (a deck; its quiz is Hidden), Surveying
// (empty) and Algebra (a Hidden deck).

const expect = baseExpect.configure({ timeout: 15_000 });

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const topics = (page: Page, subject = "MSTC") =>
  page.getByRole("list", { name: `${subject} Topics` });
const row = (page: Page, name: string, subject = "MSTC") =>
  topics(page, subject)
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`${name}$`) }) });

async function openLibrary(page: Page) {
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  await expect(page).toHaveURL(/\/app\/library$/);
  await expect(page.getByRole("heading", { level: 1, name: "Subjects and topics" })).toBeVisible();
  // The sidebar's current item fades from Home to Library: let it finish, so
  // the accessibility checks measure the colours that stay.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );
}

/** An Owner adds an email to the Beta Tester list in the Admin, in their own browser context. */
async function ownerAddsTester(browser: Browser, email: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.users);
    const testers = page.getByRole("region", { name: "BETA TESTERS" });
    await testers.getByLabel("GOOGLE ACCOUNT EMAIL").fill(email);
    await testers.getByRole("button", { name: "Add Beta Tester" }).click();
    await expect(testers.getByRole("status")).toHaveText(/ADDED/);
  } finally {
    await context.close();
  }
}

test.skip(LIVE, SKIP_LIVE);

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("the Beta Tester, with a CE pass", () => {
  test("sees CE's Subjects and Topics, all open, and opens an item", async ({ page }) => {
    await signInAndOnboard(page, "tester", "CE");
    await openLibrary(page);

    await expect(page.getByText("02 · LIBRARY · CE · CELE")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Subjects" }).getByRole("link", { name: "MSTC" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(topics(page).getByRole("heading", { level: 3 })).toHaveText([
      "01Simple Curves",
      "02Spiral Curves",
      "03Surveying",
      "04Algebra",
    ]);
    await expect(row(page, "Simple Curves").getByRole("link")).toHaveText([
      "Flashcards",
      "Quiz",
      "Reviewer PDF",
    ]);
    // Hidden content never shows: Spiral Curves' quiz is Hidden, Algebra's only deck too.
    await expect(row(page, "Spiral Curves").getByRole("link")).toHaveText(["Flashcards"]);
    await expect(row(page, "Algebra")).toContainText(
      "Content for this Topic is still being prepared.",
    );
    await expect(page.getByText("🔒")).toHaveCount(0);
    await expectNoBlockingViolations(page);

    await row(page, "Simple Curves").getByRole("link", { name: "Quiz" }).click();
    await expect(page).toHaveURL(/\/app\/library\/quiz\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Opening soon" })).toBeVisible();
    await expectNoBlockingViolations(page);

    await page.getByRole("link", { name: "Back to MSTC topics" }).click();
    await expect(page).toHaveURL(/\/app\/library\?subject=MSTC$/);
    await expect(topics(page)).toBeVisible();
  });

  test("moves between Subjects with the tabs", async ({ page }) => {
    await signInAndOnboard(page, "tester", "CE");
    await openLibrary(page);

    await page
      .getByRole("navigation", { name: "Subjects" })
      .getByRole("link", { name: "HPGE" })
      .click();
    await expect(page).toHaveURL(/\/app\/library\?subject=HPGE$/);
    await expect(topics(page, "HPGE").getByRole("heading", { level: 3 })).toHaveText([
      "01Hydrostatics",
      "02Soil Mechanics",
      "03Fluid Properties",
    ]);
  });
});

test.describe("a new tester with no pass", () => {
  test("sees Free Preview open and the rest locked, with how to unlock it", async ({
    page,
    browser,
  }) => {
    await ownerAddsTester(browser, "stranger@example.com");
    await signInAndOnboard(page, "stranger", "CE");
    await openLibrary(page);

    await expect(row(page, "Simple Curves").getByRole("link", { name: /^Flashcards/ })).toHaveText(
      "Flashcards · FREE PREVIEW",
    );
    await expect(
      row(page, "Simple Curves").getByRole("link", {
        name: "Quiz, locked: unlock with CE All-Access",
      }),
    ).toBeVisible();
    await expect(
      row(page, "Simple Curves").getByRole("link", { name: "🔒 Unlock with CE All-Access" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "🔒 UNLOCK WITH CE ALL-ACCESS" })).toContainText(
      "During the beta, access comes from AYC.",
    );
    await expectNoBlockingViolations(page);

    // The locked quiz shows the unlock prompt.
    await row(page, "Simple Curves")
      .getByRole("link", { name: "Quiz, locked: unlock with CE All-Access" })
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    // The Free Preview deck opens: with no cards yet, it's being prepared (ticket 08's player).
    await page.getByRole("link", { name: "Back to MSTC topics" }).click();
    await row(page, "Simple Curves")
      .getByRole("link", { name: /^Flashcards/ })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();
  });
});

test.describe("the lapsed tester", () => {
  test("is told their CE pass ended and their progress is kept", async ({ page }) => {
    await signInAndOnboard(page, "lapsed", "CE");
    await openLibrary(page);

    await row(page, "Simple Curves")
      .getByRole("link", { name: "Quiz, locked: your CE All-Access ended" })
      .click();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /^Your CE All-Access ended on \d{1,2} [A-Z][a-z]{2} \d{4}$/,
      }),
    ).toBeVisible();
    await expect(page.getByText(/Your access ended\. Your progress is kept\./)).toBeVisible();
    await expectNoBlockingViolations(page);
  });
});

test.describe("the Library and the Topics editor", () => {
  test("follows an Editor's rename and reorder", async ({ page, browser }) => {
    const context = await browser.newContext();
    try {
      const admin = await context.newPage();
      await signInToAdmin(admin, "editor", paths.admin.contentTopics("CE", "MSTC"));
      await admin.getByRole("button", { name: "Rename Surveying" }).click();
      await admin.getByLabel("NAME", { exact: true }).fill("Leveling");
      await admin.getByRole("button", { name: "Save name" }).click();
      await expect(admin.getByRole("heading", { level: 3, name: "Leveling" })).toBeVisible();
      await admin.getByRole("button", { name: "Move up: Leveling" }).click();
      await expect(
        admin.getByRole("list", { name: "MSTC Topics" }).getByRole("heading", { level: 3 }),
      ).toHaveText(["Simple Curves", "Leveling", "Spiral Curves", "Algebra"]);
    } finally {
      await context.close();
    }

    await signInAndOnboard(page, "tester", "CE");
    await openLibrary(page);
    await expect(topics(page).getByRole("heading", { level: 3 })).toHaveText([
      "01Simple Curves",
      "02Leveling",
      "03Spiral Curves",
      "04Algebra",
    ]);
  });
});
