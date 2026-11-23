import path from "node:path";

import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, signInAndOnboard } from "./helpers";

// Home's dashboard and the Library's % on sample data (Phase 3, ticket 15;
// stories 88–93), at the end of the Member App journey: the tester, whose CE
// pass is active, starts at the starter state, marks a card, takes a quiz and
// reads two Reviewer PDF pages, then finds on Home their Subject %, quiz
// average, Study Streak and weak Topic, and "Continue" takes them back to the
// card they were on. The sample content starts with no cards, questions or
// pages, so an Editor writes 2 cards and 1 question in CE MSTC's Simple
// Curves and publishes a real 3-page PDF under Surveying first.

// Sign-in redirects, the split and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const THREE_PAGES = path.join(
  import.meta.dirname,
  "..",
  "..",
  "test",
  "fixtures",
  "reviewer-pdfs",
  "three-pages.pdf",
);

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const topicRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "MSTC Topics" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`${name}$`) }) });
const region = (page: Page, name: string) => page.getByRole("region", { name });
type Kind = "deck" | "quiz" | "reviewer-pdf";
/** A content item's address, any id. */
const itemUrl = (kind: Kind) => new RegExp(`${paths.memberApp.content(kind, "")}[0-9a-f-]{36}$`);
/** Waits for a study write (a mark, a quiz submit, a reader position) to reach the server. */
const posted = (page: Page, kind: Kind) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith(paths.memberApp.content(kind, "")),
  );

/**
 * An Editor, in their own browser: 2 cards and 1 question in CE MSTC's Simple
 * Curves, and the 3-page PDF placed under Surveying and published.
 */
async function editorPreparesContent(browser: Browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
    await page.getByRole("link", { name: "Flashcards in Simple Curves" }).click();
    const cards = page.getByRole("region", { name: "Card form" });
    for (const [index, front] of ["Degree of curve", "Tangent distance"].entries()) {
      await cards.getByLabel(/^FRONT/).fill(front);
      await cards.getByLabel(/^BACK/).fill(`Formula ${index + 1}`);
      await cards.getByRole("button", { name: "Save & add next" }).click();
      await expect(cards.getByRole("status")).toHaveText(
        `✓ SAVED CARD ${index + 1} · WRITING THE NEXT ONE`,
      );
    }

    await page.goto(paths.admin.contentTopics("CE", "MSTC"));
    await page.getByRole("link", { name: "Quiz in Simple Curves" }).click();
    const question = page.getByRole("region", { name: "Question form" });
    await question.getByLabel("QUESTION", { exact: true }).fill("Degree of curve, arc basis?");
    for (const [letter, choice] of [
      ["A", "1145.916 / R"],
      ["B", "R / 1145.916"],
      ["C", "2R"],
      ["D", "R²"],
    ]) {
      await question.getByLabel(`CHOICE ${letter}`, { exact: true }).fill(choice ?? "");
    }
    await question.getByRole("radio", { name: "A", exact: true }).check();
    await question.getByLabel("EXPLANATION", { exact: true }).fill("D = 1145.916 / R.");
    await question.getByRole("button", { name: "Save & add next" }).click();
    await expect(question.getByRole("status")).toHaveText(
      "✓ SAVED QUESTION 1 · WRITING THE NEXT ONE",
    );

    await page.goto(paths.admin.reviewerPdfs);
    await page.getByLabel("Choose a PDF").setInputFiles(THREE_PAGES);
    const row = page
      .getByRole("list", { name: "Reviewer PDFs" })
      .getByRole("listitem")
      .filter({ hasText: "three-pages.pdf" });
    await expect(row).toContainText("Draft · 3 pages", { timeout: 30_000 });
    await row.getByRole("link", { name: "three-pages.pdf" }).click();
    const placement = page.getByRole("region", { name: "PLACEMENT" });
    await placement.getByLabel("EXAM").selectOption("CE");
    await placement.getByLabel("SUBJECT").selectOption("MSTC");
    await placement.getByLabel("TOPIC").selectOption({ label: "Surveying" });
    await placement.getByRole("button", { name: "Save placement" }).click();
    await expect(placement.getByRole("status")).toHaveText("✓ SAVED");
    const inTheApp = page.getByRole("region", { name: "IN THE MEMBER APP" });
    await inTheApp.getByRole("button", { name: "Publish" }).click();
    await expect(inTheApp).toContainText("LIVE IN THE LIBRARY");
  } finally {
    await context.close();
  }
}

/** Opens one of a Topic's items from the Library's MSTC Topics. */
async function openFromLibrary(page: Page, topic: string, item: RegExp) {
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  await topicRow(page, topic).getByRole("link", { name: item }).click();
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test("a Member's study shows on Home and in the Library, and Continue opens the last deck", async ({
  page,
  browser,
}) => {
  // An Editor prepares a deck, a quiz and a Reviewer PDF; the Member studies all three.
  test.setTimeout(180_000);
  await editorPreparesContent(browser);
  await signInAndOnboard(page, "tester", "CE");

  // Before any study: where to start, and no streak yet.
  await expect(region(page, "Start studying CE")).toBeVisible();
  await expect(region(page, "Study streak")).toContainText("No streak yet");
  await expect(page.getByRole("link", { name: "START A STREAK STUDY TODAY" })).toBeVisible();

  // Got it on the first card: the deck now resumes at card 2.
  await openFromLibrary(page, "Simple Curves", /^Flashcards/);
  await expect(page.getByText("CARD 1 / 2")).toBeVisible();
  const marked = posted(page, "deck");
  await page.keyboard.press("ArrowRight");
  await marked;
  await expect(page.getByText("CARD 2 / 2")).toBeVisible();

  // The quiz, answered wrong: a Best Score of 0%, below its passing 70%.
  await openFromLibrary(page, "Simple Curves", /^Quiz/);
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByText("QUESTION 1 / 1")).toBeVisible();
  await page.getByRole("radio", { name: /^B / }).check();
  const submitted = posted(page, "quiz");
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await submitted;
  await expect(page.getByRole("heading", { level: 2, name: "0 / 1" })).toBeVisible();

  // Pages 1 and 2 of Surveying's Reviewer PDF, leaving it at page 2.
  await openFromLibrary(page, "Surveying", /^Reviewer PDF/);
  // Longer than the default: a server's first stamped page loads sharp's
  // fonts, which took about 15 s on a cold dev server live; later pages take
  // well under a second.
  await expect(page.getByRole("img", { name: "Page 1 of 3" })).toBeVisible({ timeout: 45_000 });
  const left = posted(page, "reviewer-pdf");
  await page
    .getByRole("navigation", { name: "Pages" })
    .getByRole("button", { name: "Next →" })
    .click();
  await expect(page.getByRole("img", { name: "Page 2 of 3" })).toBeVisible();
  await left;

  // Home: Simple Curves (cards 50%, quiz 0%) 25%, Surveying (2 of 3 pages) 66%: MSTC 45%.
  await memberNav(page).getByRole("link", { name: /Home/ }).click();
  await expect(region(page, "Study streak")).toContainText("1day in a row");
  await expect(page.getByRole("link", { name: "1-DAY STREAK DONE TODAY" })).toBeVisible();
  const subjects = region(page, "Progress by subject");
  await expect(subjects).toContainText("1 / 2 CARDS GOT IT · 0% QUIZ AVG");
  await expect(subjects.getByRole("link", { name: /MSTC/ })).toContainText(/^45%MSTC/);
  const weak = region(page, "Weak topics to review").getByRole("listitem");
  await expect(weak).toHaveCount(1);
  await expect(weak).toContainText("Simple Curves");
  await expect(weak).toContainText("BEST SCORE 0% · PASSING 70%");
  await expect(weak.getByRole("link", { name: "Retake quiz in Simple Curves" })).toBeVisible();
  const resume = region(page, "Continue where you left off").getByRole("link");
  await expect(resume).toHaveCount(2);
  await expect(resume.nth(0)).toContainText("PAGE 2 OF 3");
  await expect(resume.nth(1)).toContainText("CARD 2 OF 2");
  await expectNoBlockingViolations(page);

  // The Library shows each Topic's %.
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  await expect(topicRow(page, "Simple Curves")).toContainText("25% DONE");
  await expect(topicRow(page, "Surveying")).toContainText("66% DONE");

  // Continue opens the last deck, at the card the Member was on.
  await memberNav(page).getByRole("link", { name: /Home/ }).click();
  await region(page, "Continue where you left off")
    .getByRole("link", { name: /FLASHCARDS/ })
    .click();
  await expect(page).toHaveURL(itemUrl("deck"));
  await expect(
    page.getByRole("heading", { level: 2, name: "You stopped at card 2 of 2" }),
  ).toBeVisible();

  // And the last Reviewer PDF, at the page the Member left it on.
  await page.goto(paths.memberApp.home);
  await region(page, "Continue where you left off")
    .getByRole("link", { name: /REVIEWER/ })
    .click();
  await expect(page).toHaveURL(itemUrl("reviewer-pdf"));
  await expect(page.getByRole("img", { name: "Page 2 of 3" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pages" })).toContainText("PAGE 2 / 3");

  // On a phone the dashboard fits without scrolling sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(paths.memberApp.home);
  await expect(region(page, "Progress by subject")).toBeVisible();
  await expectNoBlockingViolations(page);
});
