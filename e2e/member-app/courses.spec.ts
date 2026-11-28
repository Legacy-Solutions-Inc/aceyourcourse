import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { shortMemberId } from "../../src/lib/member-app/member-id";
import { sampleUserId } from "../../src/services/mock/members";
import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, memberEmail, signInAndOnboard } from "./helpers";

// The Courses screen and watching a Lesson (Phase 5, ticket 03; stories 157,
// 159, 163–165) on the sample Courses: "Surveying & Curves Lectures" (CE ·
// MSTC, included in CE All-Access, 2 Modules, 5 Lessons, "Simple curves" Free
// Preview), "PSAD Masterclass" (sold separately, ₱1,499, on sale) and "HPGE
// Crash Course" (sold separately, not on sale). In sample mode the video fake
// plays each Lesson in the sample player with the Member's watermark; live,
// on CI's local Supabase, there's no video service, so the Lesson screen says
// the video isn't available yet and the rest of it still works.

const expect = baseExpect.configure({ timeout: 15_000 });

const SURVEYING = "Surveying & Curves Lectures";

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
/** A Course's card on the Courses screen, by its title. */
const card = (page: Page, title: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { level: 3, name: title }) });

async function openCourses(page: Page) {
  await memberNav(page)
    .getByRole("link", { name: /Courses/ })
    .click();
  await expect(page).toHaveURL(/\/app\/courses$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your CE courses" })).toBeVisible();
  // The sidebar's current item fades from Home to Courses: let it finish, so
  // the accessibility checks measure the colours that stay.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );
}

/** The Lesson's video plays: the sample player with the watermark for `email`, or, live, says it isn't available yet. */
async function expectPlaying(page: Page, title: string, email: string) {
  if (LIVE) {
    await expect(page.getByText("This video isn’t available yet")).toBeVisible();
    return;
  }
  const player = page.getByRole("figure", { name: `Sample video: ${title}` });
  await expect(player.getByText("SAMPLE VIDEO")).toBeVisible();
  // The watermark drifting across it: the Member's email and short Member ID.
  const drawn = await player
    .getByTestId("sample-watermark")
    .evaluate((element) => (element as HTMLElement).style.backgroundImage);
  expect(decodeURIComponent(drawn)).toContain(`${email} · ${shortMemberId(sampleUserId(email))}`);
  await player.getByRole("button", { name: "Play" }).click();
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(player.getByTestId("sample-clock")).not.toHaveText(/^0:00 \//);
}

/**
 * No serious or critical axe issues on a Courses page, once its title is in:
 * Next streams the metadata, so right after a navigation the page can be
 * checked a moment before its <title> arrives (axe's document-title).
 */
async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/^Courses · /);
  await expectNoBlockingViolations(page);
}

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

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test("Bea (CE All-Access) watches an included Lesson, with her email and Member ID across it", async ({
  page,
}) => {
  await signInAndOnboard(page, "tester", "CE");
  await openCourses(page);

  await expect(page.getByText("03 · COURSES · CE · CELE")).toBeVisible();
  const surveying = card(page, SURVEYING);
  await expect(surveying.getByText("IN YOUR PLAN")).toBeVisible();
  await expect(surveying.getByText("2 MODULES · 5 LESSONS")).toBeVisible();
  await expectAccessible(page);

  await surveying.getByRole("link", { name: "Start course" }).click();
  await expect(page).toHaveURL(/\/app\/courses\/[0-9a-f-]{36}\/lessons\/[0-9a-f-]{36}$/);
  await expect(page.getByText("SURVEYING & CURVES LECTURES · MODULE 1 · LESSON 1")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Distance and leveling" }),
  ).toBeVisible();
  await expect(page.getByText(/Taping corrections\./)).toBeVisible();
  await expectPlaying(page, "Distance and leveling", memberEmail("tester"));
  await expectAccessible(page);

  // Any Lesson, in any order: Next, then one from the side panel.
  await page.getByRole("link", { name: "Next lesson →" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Traverse computations" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: SURVEYING })
    .getByRole("link", { name: /Compound and reverse curves/ })
    .click();
  await expect(page.getByText("SURVEYING & CURVES LECTURES · MODULE 2 · LESSON 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "← Simple curves" })).toBeVisible();
});

test("the separately sold Courses stay locked for an Access Pass: one on sale, one not", async ({
  page,
}) => {
  await signInAndOnboard(page, "tester", "CE");
  await openCourses(page);

  const psad = card(page, "PSAD Masterclass");
  await expect(psad.getByText(/LOCKED/)).toBeVisible();
  await expect(psad.getByRole("link", { name: "Unlock for ₱1,499" })).toHaveAttribute(
    "href",
    paths.memberApp.plansFor("CE"),
  );
  const hpge = card(page, "HPGE Crash Course");
  await expect(hpge.getByText(/LOCKED/)).toBeVisible();
  await expect(hpge.getByText("Not on sale right now")).toBeVisible();

  // Its list opens, but its Lessons don't play.
  await psad.getByRole("link", { name: "PSAD Masterclass" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "PSAD Masterclass" })).toBeVisible();
  const outline = page.getByRole("list", { name: "Modules and lessons" });
  await expect(outline.getByText(/Beams in flexure/)).toBeVisible();
  await expect(outline.getByRole("link")).toHaveCount(0);
  await expectAccessible(page);
});

test("a Member with no pass sees the included Course locked, opens its list and plays its Free Preview Lesson", async ({
  page,
  browser,
}) => {
  await ownerAddsTester(browser, "stranger@example.com");
  await signInAndOnboard(page, "stranger", "CE");
  await openCourses(page);

  const surveying = card(page, SURVEYING);
  await expect(surveying.getByText(/LOCKED/)).toBeVisible();
  await expect(surveying.getByRole("link", { name: "See plans" })).toBeVisible();
  await expect(surveying.getByText(/1 FREE LESSON/)).toBeVisible();

  await surveying.getByRole("link", { name: SURVEYING }).click();
  const outline = page.getByRole("list", { name: "Modules and lessons" });
  await expect(outline.getByRole("link")).toHaveText([/Simple curves/]);
  await expect(outline.getByText(/Traverse computations/)).toBeVisible();
  await expectAccessible(page);

  await outline.getByRole("link", { name: /Simple curves/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Simple curves" })).toBeVisible();
  await expectPlaying(page, "Simple curves", "stranger@example.com");

  // The next Lesson is locked: its screen says how to unlock it, with no player.
  await page.getByRole("link", { name: "Next lesson →" }).click();
  await expect(page.getByRole("heading", { name: "Unlock with CE All-Access" })).toBeVisible();
  await expect(page.getByRole("figure")).toHaveCount(0);
  await expect(page.getByText("This video isn’t available yet")).toHaveCount(0);
  await expectAccessible(page);
});
