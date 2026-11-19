import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, signInAndOnboard, SKIP_LIVE } from "./helpers";

// Taking a quiz on sample data (Phase 3, ticket 11; stories 98–100, 106 and
// 133k): the lapsed tester, whose CE pass ended, takes HPGE Hydrostatics'
// Free Preview quiz, goes back to change an answer, submits, and sees the
// score and the review; then retakes it with a lower score, still sees the
// higher Best Score, and reviews the first attempt. The sample quizzes start
// with no questions, so an Editor writes them first in the Admin's question
// editor. The quiz shuffles its questions, so each one is answered by what it
// asks.

const expect = baseExpect.configure({ timeout: 15_000 });

/** The questions, each with its choices A–D and its correct choice. */
const QUESTIONS = [
  {
    asks: "Pressure at depth",
    question: "Pressure at depth $h$ in a fluid of density $\\rho$?",
    choices: ["$\\rho g h$", "$\\rho h$", "$g h$", "$\\rho / g$"],
    correct: "A",
    wrong: "B",
  },
  {
    asks: "Buoyant force",
    question: "Buoyant force on a fully submerged body?",
    choices: ["Its weight", "Its volume", "The weight of the fluid it displaces", "Zero"],
    correct: "C",
    wrong: "D",
  },
  {
    asks: "Specific gravity",
    question: "Specific gravity of water at 4 °C?",
    choices: ["0.5", "1.0", "9.81", "1000"],
    correct: "B",
    wrong: "A",
  },
] as const;

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });

/** An Editor writes the questions in HPGE Hydrostatics' quiz, in the Admin, in their own browser context. */
async function editorWritesQuestions(browser: Browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "editor", paths.admin.contentTopics("CE", "HPGE"));
    await page.getByRole("link", { name: "Quiz in Hydrostatics" }).click();
    const form = page.getByRole("region", { name: "Question form" });
    for (const [index, { question, choices, correct }] of QUESTIONS.entries()) {
      await form.getByLabel("QUESTION", { exact: true }).fill(question);
      for (const [place, letter] of ["A", "B", "C", "D"].entries()) {
        await form.getByLabel(`CHOICE ${letter}`, { exact: true }).fill(choices[place] ?? "");
      }
      await form.getByRole("radio", { name: correct, exact: true }).check();
      await form.getByLabel("EXPLANATION", { exact: true }).fill(`Why it's ${correct}.`);
      await form.getByRole("button", { name: "Save & add next" }).click();
      await expect(form.getByRole("status")).toHaveText(
        `✓ SAVED QUESTION ${index + 1} · WRITING THE NEXT ONE`,
      );
    }
  } finally {
    await context.close();
  }
}

/** The question showing now, by what it asks. */
async function shownQuestion(page: Page) {
  const text = await page.getByRole("heading", { level: 2, name: /^Question \d+: / }).innerText();
  const shown = QUESTIONS.find((candidate) => text.includes(candidate.asks));
  if (!shown) throw new Error(`An unknown question: ${text}`);
  return shown;
}

/** Picks a choice for the question showing, by its letter. */
async function pick(page: Page, letter: string) {
  const choice = page.getByRole("radio", { name: new RegExp(`^${letter} `) });
  await choice.check();
  await expect(choice).toBeChecked();
}

test.skip(LIVE, SKIP_LIVE);

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("a Member with no pass, on a Free Preview quiz", () => {
  test("takes it, changes an answer, sees the score and review, and keeps the higher Best Score on a lower retake", async ({
    page,
    browser,
  }) => {
    // An Editor writes three questions first, and the Member takes the quiz twice.
    test.setTimeout(120_000);
    await editorWritesQuestions(browser);
    await signInAndOnboard(page, "lapsed", "CE");
    await memberNav(page)
      .getByRole("link", { name: /Library/ })
      .click();
    await page
      .getByRole("navigation", { name: "Subjects" })
      .getByRole("link", { name: "HPGE" })
      .click();
    await page
      .getByRole("list", { name: "HPGE Topics" })
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 3, name: /Hydrostatics$/ }) })
      .getByRole("link", { name: /^Quiz/ })
      .click();
    await expect(page).toHaveURL(/\/app\/library\/quiz\/[0-9a-f-]{36}$/);

    // The start screen.
    await expect(page.getByRole("heading", { level: 1, name: "Hydrostatics" })).toBeVisible();
    const facts = page.getByRole("list", { name: "About this quiz" });
    await expect(facts.getByRole("listitem")).toHaveText([
      "QUESTIONS3",
      "PASSING SCORE70%",
      "YOUR BEST—",
    ]);
    await expectNoBlockingViolations(page);
    await page.getByRole("button", { name: "Start quiz" }).click();

    // The first question answered wrong, the second right; back to the first to change it.
    await expect(page.getByText("QUESTION 1 / 3")).toBeVisible();
    // The watermark is a picture over the question, not text on it.
    await expect(page.locator("[data-watermark]")).toHaveCSS(
      "background-image",
      /data:image\/svg\+xml/,
    );
    const first = await shownQuestion(page);
    await pick(page, first.wrong);
    await expectNoBlockingViolations(page);
    await page.getByRole("button", { name: "Next question" }).click();
    await expect(page.getByText("QUESTION 2 / 3")).toBeVisible();
    const second = await shownQuestion(page);
    await pick(page, second.correct);
    await page.getByRole("button", { name: "Previous question" }).click();
    await expect(page.getByText("QUESTION 1 / 3")).toBeVisible();
    await expect(page.getByRole("radio", { name: new RegExp(`^${first.wrong} `) })).toBeChecked();
    await pick(page, first.correct);
    await page.getByRole("button", { name: "Next question" }).click();
    await page.getByRole("button", { name: "Next question" }).click();
    const third = await shownQuestion(page);
    await pick(page, third.wrong);
    await page.getByRole("button", { name: "Finish quiz" }).click();

    // The score, against the passing score, and the missed question with its answer.
    await expect(page.getByText("QUIZ COMPLETE · HYDROSTATICS")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "2 / 3" })).toBeVisible();
    await expect(page.getByText("66% · BEST SO FAR")).toBeVisible();
    await expect(page.getByText("NOT PASSED · PASSING SCORE 70%")).toBeVisible();
    const missed = page.getByRole("list", { name: "Missed questions" }).getByRole("listitem");
    await expect(missed).toHaveCount(1);
    await expect(missed).toContainText(third.asks);
    await expect(missed).toContainText(`Correct: ${third.correct} ·`);
    await expect(missed).toContainText(`Why it's ${third.correct}.`);
    await expectNoBlockingViolations(page);

    // A retake, all wrong: the Best Score stays at the higher one.
    await page.getByRole("button", { name: "Retake quiz" }).click();
    await expect(facts.getByRole("listitem")).toHaveText([
      "QUESTIONS3",
      "PASSING SCORE70%",
      "YOUR BEST66%",
    ]);
    await page.getByRole("button", { name: "Start quiz" }).click();
    for (let place = 1; place <= 3; place += 1) {
      await expect(page.getByText(`QUESTION ${place} / 3`)).toBeVisible();
      await pick(page, (await shownQuestion(page)).wrong);
      await page
        .getByRole("button", { name: place === 3 ? "Finish quiz" : "Next question" })
        .click();
    }
    await expect(page.getByRole("heading", { level: 2, name: "0 / 3" })).toBeVisible();
    await expect(page.getByText("0% · BEST IS 66%")).toBeVisible();
    await expect(page.getByText("Previous attempts: 66%")).toBeVisible();

    // Both attempts are listed, newest first; the first reviews as it was scored.
    await page.getByRole("button", { name: "Retake quiz" }).click();
    await expect(facts.getByRole("listitem")).toHaveText([
      "QUESTIONS3",
      "PASSING SCORE70%",
      "YOUR BEST66%",
    ]);
    const attempts = page.getByRole("list", { name: "Your attempts" }).getByRole("listitem");
    await expect(attempts).toHaveCount(2);
    await expect(attempts.nth(0)).toContainText("0% · NOT PASSED");
    await expect(attempts.nth(1)).toContainText("66% · NOT PASSED");
    await attempts
      .nth(1)
      .getByRole("link", { name: /^Review your attempt of / })
      .click();

    await expect(page).toHaveURL(/\/app\/library\/quiz\/[0-9a-f-]{36}\?attempt=[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: /^Your attempt of / })).toBeVisible();
    await expect(page.getByText("66% · BEST SO FAR")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Missed questions" }).getByRole("listitem"),
    ).toContainText(third.asks);
    await expectNoBlockingViolations(page);
    await page.getByRole("link", { name: "Back to the quiz" }).click();
    await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();

    // On a phone the quiz is a focus screen: a back bar, and no Menu button.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page
        .getByRole("navigation", { name: "Back" })
        .getByRole("link", { name: "Back to HPGE topics" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
  });
});
