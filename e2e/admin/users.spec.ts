import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { sampleContentId, sampleTopicId } from "../../src/services/mock/content";
import { sampleUserId } from "../../src/services/mock/members";
import { expectNoBlockingViolations, signInAndOnboard } from "../member-app/helpers";
import { resetSampleData, signInAs } from "./helpers";

// Users in the Admin (Phase 3, ticket 16; stories 129, 130 and 132): the
// sample tester signs in to the Member App on one device, then an Owner, on
// another, finds them in the Users list (filter, search, no results), opens
// their detail page, and forces their device to sign out with a reason. The
// tester's next Member App request shows "Session ended". An Editor is
// refused both screens.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const TESTER = "tester@example.com";
/** The sample tester's User id, as "Sign in as" gives it. */
const TESTER_ID = sampleUserId(TESTER);
/** The lapsed tester's User id: their CE pass ended 3 days before the sample data was made. */
const LAPSED_ID = sampleUserId("lapsed@example.com");
/** Spiral Curves' deck, in CE's MSTC: Visible, and not Free Preview, so it needs CE All-Access. */
const SPIRAL_CURVES_DECK = paths.memberApp.content(
  "deck",
  sampleContentId(sampleTopicId("CE", "MSTC", "Spiral Curves"), "deck"),
);

const usersList = (page: Page) => page.getByRole("region", { name: "Users list" });
/** The Members' rows: each has a link to the Member's page; the header row has none. */
const rows = (page: Page) =>
  usersList(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link") });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search by name or email" });
const chip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Filter" }).getByRole("link", { name, exact: true });
const section = (page: Page, name: string | RegExp) => page.getByRole("region", { name });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

/** An Editor writes one card in Spiral Curves' deck, in the Admin, in their own browser context. */
async function editorWritesSpiralCurvesCard(browser: Browser) {
  const context = await browser.newContext();
  try {
    const editor = await context.newPage();
    await signInAs(editor, "editor", paths.admin.contentTopics("CE", "MSTC"));
    await editor.getByRole("link", { name: "Flashcards in Spiral Curves" }).click();
    const form = editor.getByRole("region", { name: "Card form" });
    await form.getByLabel(/^FRONT/).fill("Spiral angle");
    await form.getByLabel(/^BACK/).fill("Half the central angle of the spiral");
    await form.getByRole("button", { name: "Save & add next" }).click();
    await expect(form.getByRole("status")).toHaveText("✓ SAVED CARD 1 · WRITING THE NEXT ONE");
  } finally {
    await context.close();
  }
}

test.describe("the Owner", () => {
  test("finds a Beta Tester, opens their page and signs their device out", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    // The tester's phone: signed in to the Member App, on CE.
    await signInAndOnboard(page, "tester", "CE");

    const desk = await browser.newContext();
    try {
      const owner = await desk.newPage();
      await signInAs(owner, "owner", paths.admin.users);
      await expect(owner).toHaveURL(/\/admin\/users$/);
      await expect(rows(owner)).toHaveCount(1);

      // Filter to the Beta Testers: the tester, with their pass and device.
      await chip(owner, "Beta Tester").click();
      await expect(owner).toHaveURL(/\/admin\/users\?filter=beta$/);
      await expect(chip(owner, "Beta Tester")).toHaveAttribute("aria-current", "true");
      const tester = rows(owner).filter({ hasText: TESTER });
      await expect(tester).toBeVisible();
      await expect(tester).toContainText("BETA TESTER");
      await expect(tester).toContainText("MEMBER");

      // A search with no results, then the way back to everyone.
      await search(owner).fill("nobody");
      await expect(owner).toHaveURL(/q=nobody/);
      await expect(owner.getByText("No users match. Clear the search or filter.")).toBeVisible();
      await owner.getByRole("link", { name: "Show every Member" }).click();
      await expect(owner).toHaveURL(/\/admin\/users$/);
      await search(owner).fill("Bea");
      await expect(owner).toHaveURL(/q=Bea/);
      await expect(rows(owner)).toHaveCount(1);
      await expectNoBlockingViolations(owner);

      // The detail page, with every section.
      await rows(owner).getByRole("link", { name: "Bea Tester" }).click();
      await expect(owner).toHaveURL(new RegExp(`${paths.admin.user(TESTER_ID)}$`));
      await expect(owner.getByRole("heading", { level: 2, name: "Bea Tester" })).toBeVisible();
      await expect(section(owner, "TARGET EXAMS")).toContainText("CE · Civil Engineering");
      await expect(section(owner, "ACCESS PASSES")).toContainText("ACTIVE");
      await expect(section(owner, "PROGRESS")).toContainText("CARDS GOT IT");
      await expect(section(owner, "DEVICE SWITCHES · 1")).toBeVisible();
      await expect(section(owner, "CONSENT")).toContainText("TERMS 2.0 · PRIVACY 2.0");
      // Bea hasn't bought anything here (Phase 4, ticket 07).
      await expect(section(owner, "ORDERS · 0")).toContainText("No Orders yet.");
      await expectNoBlockingViolations(owner);
      // On a phone, the profile and the sections stack, with no sideways scroll.
      const desktop = owner.viewportSize();
      await owner.setViewportSize({ width: 390, height: 844 });
      await expectNoBlockingViolations(owner);
      if (desktop) await owner.setViewportSize(desktop);

      // Force sign-out: refused without a reason, then done with one.
      const device = section(owner, "ACTIVE DEVICE");
      await device.getByRole("button", { name: "Sign out this device" }).click();
      const dialog = owner.getByRole("dialog", { name: /^Sign Bea out of / });
      await dialog.getByRole("button", { name: "Sign out device" }).click();
      await expect(dialog.getByText("ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY")).toBeVisible();
      await dialog.getByLabel("REASON · SAVED IN STAFF ACTIVITY").fill("Shared with a classmate");
      await dialog.getByRole("button", { name: "Sign out device" }).click();
      await expect(device.getByRole("status")).toContainText("✓ SIGNED OUT");
      await expect(device).toContainText("No Active Device. Nothing to sign out.");
      await expectNoBlockingViolations(owner);
    } finally {
      await desk.close();
    }

    // The tester's phone: its next Member App request lands on "Session ended".
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeVisible();
  });
});

test.describe("the Owner and a lapsed tester", () => {
  test("an Owner grants CE; the tester sees the notice and studies; the Owner extends, then ends it, and progress stays", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await editorWritesSpiralCurvesCard(browser);
    // The lapsed tester's phone: signed in, on ME. Their CE pass ended, and CE isn't a Target Exam.
    await signInAndOnboard(page, "lapsed", "ME");
    await page.goto(SPIRAL_CURVES_DECK);
    await expect(
      page.getByRole("heading", { level: 2, name: /^Your CE All-Access ended on / }),
    ).toBeVisible();

    const desk = await browser.newContext();
    try {
      const owner = await desk.newPage();
      await signInAs(owner, "owner", paths.admin.user(LAPSED_ID));
      const passes = section(owner, "ACCESS PASSES");
      const cePass = passes.getByRole("listitem", { name: "CE pass" });
      await expect(cePass).toContainText("ENDED");
      await expect(section(owner, "TARGET EXAMS")).not.toContainText("CE · Civil Engineering");

      // Grant CE for 30 days: refused without a reason, then granted with one.
      await passes.getByRole("button", { name: "Grant Access Pass…" }).click();
      const grant = owner.getByRole("dialog", { name: "Grant Lou an Access Pass" });
      await expect(grant).toContainText("No payment is collected.");
      await grant.getByRole("combobox", { name: "EXAM" }).selectOption("CE");
      await grant.getByRole("radio", { name: "30 days" }).check();
      await expectNoBlockingViolations(owner);
      await grant.getByRole("button", { name: "Grant access" }).click();
      await expect(grant.getByText("ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY")).toBeVisible();
      await grant.getByLabel("REASON · SAVED IN STAFF ACTIVITY").fill("Beta tester");
      await grant.getByRole("button", { name: "Grant access" }).click();
      await expect(passes.getByRole("status")).toHaveText(
        /^✓ GRANTED CE UNTIL \d{1,2} [A-Z]{3} \d{4} · NO PAYMENT COLLECTED · ADDED TO THEIR TARGET EXAMS$/,
      );
      await expect(cePass).toContainText("ACTIVE");
      await expect(cePass).toContainText("+30 DAYS");
      await expect(cePass).toContainText("“Beta tester”");
      await expect(section(owner, "TARGET EXAMS")).toContainText("CE · Civil Engineering");
      await expectNoBlockingViolations(owner);

      // The tester: the notice on Home, then the CE deck opens, and they mark its card.
      await page.goto(paths.memberApp.home);
      const notices = page.getByRole("region", { name: "Notices" });
      await expect(notices).toContainText(
        /^NOTICEYou now have CE All-Access until \d{1,2} [A-Z][a-z]{2} \d{4}Dismiss$/,
      );
      await expectNoBlockingViolations(page);
      await page.goto(SPIRAL_CURVES_DECK);
      await expect(page.getByText("CARD 1 / 1")).toBeVisible();
      // A focus screen: the notice stays out of the way.
      await expect(notices).toHaveCount(0);
      const marked = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && /\/app\/library\/deck\//.test(response.url()),
      );
      await page.getByRole("button", { name: "Got it" }).click();
      await marked;
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(
        "1 of 1 got it · 0 to review again",
      );

      // Dismissed, the notice stays dismissed on the next visit.
      await page.goto(paths.memberApp.home);
      await notices.getByRole("button", { name: /^Dismiss: You now have CE All-Access/ }).click();
      await expect(notices).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(notices).toHaveCount(0);

      // Extend by 7 days: added to the pass's end, and the tester is told the new end.
      await owner.reload();
      await cePass.getByRole("button", { name: "Extend…" }).click();
      const extend = owner.getByRole("dialog", { name: "Add days to Lou’s CE pass" });
      await expect(extend.getByRole("radio", { name: "7 days" })).toBeChecked();
      await extend.getByLabel("REASON · SAVED IN STAFF ACTIVITY").fill("Payment confirmed late");
      await extend.getByRole("button", { name: "Add days" }).click();
      await expect(passes.getByRole("status")).toHaveText(
        /^✓ ADDED 7 DAYS · CE UNTIL \d{1,2} [A-Z]{3} \d{4}$/,
      );
      await expect(cePass).toContainText("+7 DAYS");
      await page.goto(paths.memberApp.home);
      await expect(notices).toContainText(
        /Your CE access was extended to \d{1,2} [A-Z][a-z]{2} \d{4}/,
      );

      // End access now: asked first, with a reason.
      await cePass.getByRole("button", { name: "End access now…" }).click();
      const end = owner.getByRole("dialog", { name: "End Lou’s CE access now?" });
      await end.getByLabel("REASON · SAVED IN STAFF ACTIVITY").fill("Beta over");
      await end.getByRole("button", { name: "End access now" }).click();
      await expect(passes.getByRole("status")).toHaveText(
        "✓ ENDED CE ACCESS · THEY SEE THE EXPIRED STATE",
      );
      await expect(cePass).toContainText("ENDED");
      // Their progress stays: the card they got.
      await expect(section(owner, "PROGRESS")).toContainText("CARDS GOT IT1 / 1");
    } finally {
      await desk.close();
    }

    // The tester: the deck shows the expired state, with their progress kept, and Home says so.
    await page.goto(SPIRAL_CURVES_DECK);
    await expect(
      page.getByRole("heading", { level: 2, name: /^Your CE All-Access ended on / }),
    ).toBeVisible();
    await expect(page.getByText(/Your progress is kept: 1 card marked\./)).toBeVisible();
    await page.goto(paths.memberApp.home);
    const notices = page.getByRole("region", { name: "Notices" }).getByRole("listitem");
    await expect(notices).toHaveCount(2);
    await expect(notices.first()).toContainText("Your CE access has ended");
    await expect(notices.nth(1)).toContainText("Your CE access was extended to");
  });
});

test.describe("the Editor", () => {
  test("is refused the Users list and a Member's detail page", async ({ page }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(paths.admin.users);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await page.goto(paths.admin.user(TESTER_ID));
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(page.getByRole("heading", { level: 2, name: "Bea Tester" })).toHaveCount(0);
  });
});
