import path from "node:path";

import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The question editor (Phase 3, ticket 10; stories 125, 127, 133l), on the
// sample data: an Editor writes quiz questions with maths in a Topic's quiz,
// with the live preview and "Save & add next", edits one, reorders them,
// and deletes one; deleting the last question of a Visible quiz hides the quiz and says
// so. The sample CE MSTC Topics are Simple Curves (a Visible quiz with no
// questions yet), Spiral Curves (a Hidden quiz with none) and Surveying (no
// quiz).

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const form = (page: Page) => page.getByRole("region", { name: "Question form" });
const preview = (page: Page) =>
  form(page).getByRole("region", { name: "PREVIEW · AS MEMBERS SEE IT" });
const questionList = (page: Page, topic: string) =>
  page.getByRole("list", { name: `Questions in ${topic}` }).getByRole("link");
const quizState = (page: Page) => page.getByRole("region", { name: /quiz$/ });

/** Opens a CE MSTC Topic's quiz from its Topics list, as an Editor. */
async function openQuiz(page: Page, topic: string) {
  await signInAs(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
  await page.getByRole("link", { name: `Quiz in ${topic}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/quiz\?topic=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 2, name: `${topic} quiz` })).toBeVisible();
}

/** Writes a question in the form, its correct choice picked; the save is the caller's. */
async function writeQuestion(
  page: Page,
  question: string,
  { choices = ["1", "2", "3", "4"], correct = "B", explanation = "Because." } = {},
) {
  await form(page).getByLabel("QUESTION", { exact: true }).fill(question);
  for (const [index, letter] of ["A", "B", "C", "D"].entries()) {
    await form(page)
      .getByLabel(`CHOICE ${letter}`, { exact: true })
      .fill(choices[index] ?? "");
  }
  await form(page).getByRole("radio", { name: correct, exact: true }).check();
  await form(page).getByLabel("EXPLANATION", { exact: true }).fill(explanation);
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("an Editor", () => {
  test("writes questions with maths, edits and reorders them, and deletes one", async ({
    page,
  }) => {
    await openQuiz(page, "Spiral Curves");
    await expect(quizState(page)).toContainText("CE · MSTC · 0 QUESTIONS · HIDDEN");

    // The first question, with maths, saved with "Save & add next".
    await writeQuestion(page, "Degree of curve for $R = 200$ m?", {
      choices: ["$5.73°$", "$11.46°$", "$2.86°$", "$1.43°$"],
      correct: "A",
      explanation: "$D = \\frac{1145.916}{R}$",
    });
    await expect(preview(page).locator(".katex").first()).toBeVisible();
    await expect(preview(page).getByRole("list", { name: "Choices" })).toContainText("✓ CORRECT");
    await form(page).getByRole("button", { name: "Save & add next" }).click();
    await expect(form(page).getByRole("status")).toHaveText(
      "✓ SAVED QUESTION 1 · WRITING THE NEXT ONE",
    );
    await expect(form(page).getByLabel("QUESTION", { exact: true })).toHaveValue("");
    await expect(questionList(page, "Spiral Curves")).toHaveCount(1);

    // The second, with a figure, saved with "Save".
    await writeQuestion(page, "Spiral angle?", { correct: "D" });
    await form(page).getByLabel("Add a figure").setInputFiles(fixture("product-photo.png"));
    await expect(
      preview(page).getByRole("img", { name: "Figure for the question" }),
    ).toHaveAttribute("src", /^blob:/);
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/&question=[0-9a-f-]{36}$/);
    await expect(questionList(page, "Spiral Curves")).toHaveCount(2);
    // The saved figure now comes from the Admin's Staff-only route.
    await expect(
      preview(page).getByRole("img", { name: "Figure for the question" }),
    ).toHaveAttribute("src", /^\/admin\/content\/quiz\/figure\/[0-9a-f-]{36}$/);

    // No correct choice picked, and a formula that won't render: refused.
    await page.getByRole("link", { name: "+ Add question" }).click();
    await expect(form(page).getByRole("form", { name: "New question" })).toBeVisible();
    await form(page).getByLabel("QUESTION", { exact: true }).fill("Broken $\\frac{1}{$");
    await expect(form(page)).toContainText("The question has a formula that won’t render");
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(form(page).getByLabel("QUESTION", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      form(page).getByRole("group", { name: "CORRECT CHOICE" }),
    ).toHaveAccessibleDescription("PICK THE CORRECT CHOICE TO SAVE");
    await expect(questionList(page, "Spiral Curves")).toHaveCount(2);

    // Reorder.
    await page.getByRole("button", { name: "Move up: question 2" }).click();
    await expect(questionList(page, "Spiral Curves").first()).toHaveAccessibleName(
      "Edit question 1: Spiral angle?",
    );

    // Edit: open it from the list, change its correct choice, save.
    await questionList(page, "Spiral Curves").first().click();
    await expect(form(page).getByRole("form", { name: "Question 1" })).toBeVisible();
    await expect(form(page).getByLabel("QUESTION", { exact: true })).toHaveValue("Spiral angle?");
    await form(page).getByRole("radio", { name: "C", exact: true }).check();
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(form(page).getByRole("status")).toHaveText("✓ SAVED QUESTION 1");
    await expect(preview(page).getByRole("listitem").filter({ hasText: "✓ CORRECT" })).toHaveText(
      /^C/,
    );

    // Delete, which keeps the question for Members' old attempts.
    await page.getByRole("button", { name: "Delete question 2" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Members’ past attempts keep it, marked as removed");
    await dialog.getByRole("button", { name: "Delete question" }).click();
    await expect(questionList(page, "Spiral Curves")).toHaveCount(1);
    await expect(quizState(page)).toContainText("CE · MSTC · 1 QUESTION · HIDDEN");
  });

  test("deletes the last question of a Visible quiz, which hides the quiz and says so", async ({
    page,
  }) => {
    await openQuiz(page, "Simple Curves");
    await writeQuestion(page, "Only question?");
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(questionList(page, "Simple Curves")).toHaveCount(1);
    await expect(quizState(page)).toContainText("CE · MSTC · 1 QUESTION · VISIBLE");

    await page.getByRole("button", { name: "Delete question 1" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete question" }).click();

    await expect(
      quizState(page).getByText("The quiz is now Hidden because it has no questions."),
    ).toBeVisible();
    await expect(quizState(page)).toContainText("CE · MSTC · 0 QUESTIONS · HIDDEN");
  });
});
