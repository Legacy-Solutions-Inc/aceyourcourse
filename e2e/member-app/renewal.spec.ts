import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import {
  expectNoBlockingViolations,
  signInAndAgree,
  signInAndOnboard,
  startCountdown,
} from "./helpers";

// Renewal reminders and ended access on sample data (Phase 4, ticket 12;
// stories 141 and 142): the renewing tester, whose CE pass ends 5 days after
// the sample data starts, sets their CE exam 27 days after that and finds the
// "before your exam" banner on Home and on CE's study screens; dismissing it
// keeps it hidden on reload, for the rest of the Manila day (the next day is
// the unit tests'). The lapsed tester, whose CE pass ended, marks a card in
// a Free Preview deck and then finds it kept, with "Renew access", on locked
// CE content. No email is sent.

const expect = baseExpect.configure({ timeout: 15_000 });

const DAY = 24 * 60 * 60 * 1000;
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Manila",
});

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const banners = (page: Page) => page.getByRole("region", { name: "Access ending soon" });
const topicRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "MSTC Topics" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`${name}$`) }) });

async function openLibrary(page: Page) {
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Subjects and topics" })).toBeVisible();
}

/** An Editor writes one card in CE MSTC's Simple Curves deck, in the Admin, in their own browser. */
async function editorWritesACard(browser: Browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
    await page.getByRole("link", { name: "Flashcards in Simple Curves" }).click();
    const form = page.getByRole("region", { name: "Card form" });
    await form.getByLabel(/^FRONT/).fill("Degree of curve");
    await form.getByLabel(/^BACK/).fill("1145.916 / R");
    await form.getByRole("button", { name: "Save & add next" }).click();
    await expect(form.getByRole("status")).toHaveText("✓ SAVED CARD 1 · WRITING THE NEXT ONE");
  } finally {
    await context.close();
  }
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("the renewing tester, whose CE pass ends in 5 days", () => {
  test("sees the before-your-exam banner on Home and a CE study screen, and dismisses it for the day", async ({
    page,
  }) => {
    await signInAndAgree(page, "renewing");
    // The exam 32 days from today: 27 days after the pass ends.
    await startCountdown(page, "CE", 32);
    const text = `Your CE All-Access ends ${dayMonth.format(Date.now() + 5 * DAY)}, 27 days before your exam`;

    await expect(banners(page)).toContainText(text);
    await expect(
      banners(page).getByRole("link", { name: "Renew to cover your exam" }),
    ).toHaveAttribute("href", paths.memberApp.plansFor("CE"));
    await expectNoBlockingViolations(page);

    await openLibrary(page);
    await expect(banners(page)).toContainText(text);

    await topicRow(page, "Simple Curves")
      .getByRole("link", { name: /^Flashcards/ })
      .click();
    await expect(page).toHaveURL(/\/app\/library\/deck\/[0-9a-f-]{36}$/);
    await expect(banners(page)).toContainText(text);
    await expectNoBlockingViolations(page);

    const dismissed = page.waitForResponse((response) => response.request().method() === "POST");
    await banners(page)
      .getByRole("button", { name: `Dismiss: ${text}` })
      .click();
    await expect(banners(page)).toHaveCount(0);
    await dismissed;

    // Kept on the server: hidden after a reload, and on Home.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeVisible();
    await expect(banners(page)).toHaveCount(0);
    await memberNav(page).getByRole("link", { name: /Home/ }).click();
    await expect(page.getByRole("region", { name: /board exam countdown/ })).toBeVisible();
    await expect(banners(page)).toHaveCount(0);
  });
});

test.describe("the lapsed tester, whose CE pass ended", () => {
  test("finds their progress kept and Renew access on locked CE content, with no banner", async ({
    page,
    browser,
  }) => {
    await editorWritesACard(browser);
    await signInAndOnboard(page, "lapsed", "CE");
    await expect(banners(page)).toHaveCount(0);

    // A card marked Got it in Simple Curves' Free Preview deck.
    await openLibrary(page);
    await topicRow(page, "Simple Curves")
      .getByRole("link", { name: "Flashcards · FREE PREVIEW" })
      .click();
    await expect(page.getByRole("figure", { name: "Card front" })).toContainText("Degree of curve");
    await page.keyboard.press("Space");
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && /\/app\/library\/deck\//.test(response.url()),
    );
    await page.keyboard.press("ArrowRight");
    await saved;
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      "1 of 1 got it · 0 to review again",
    );

    await openLibrary(page);
    await topicRow(page, "Simple Curves")
      .getByRole("link", { name: "Reviewer PDF, locked: your CE All-Access ended" })
      .click();
    await expect(
      page.getByRole("heading", { level: 2, name: /^Your CE All-Access ended on / }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your access ended. Renew to keep reviewing. Your progress is kept: 1 card marked.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Renew access", exact: true })).toHaveAttribute(
      "href",
      paths.memberApp.plansFor("CE"),
    );
    await expect(banners(page)).toHaveCount(0);
    // After a client-side navigation the title follows the page: wait for it before axe looks.
    await expect(page).toHaveTitle(/Library/);
    await expectNoBlockingViolations(page);
  });
});
