import { readFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { sampleTopicId } from "../../src/services/mock/content";
import { resetSampleData, signInAs } from "./helpers";

// A Subject's quiz import and a quiz's settings (Phase 3, ticket 09; stories
// 119–124, 126–128, 133l), on the sample data: an Editor imports a quiz CSV
// and a zip of figures into CE's PSAD, which has no Topics yet, fixes a bad
// row after seeing its error, confirms, changes the passing score (after a
// refused one) and makes the quiz Visible; an empty quiz can't be made
// Visible; and the quiz template downloads and imports unchanged.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const importScreen = (page: Page) =>
  page.getByRole("region", { name: "CE · PSAD · IMPORT QUIZZES" });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("an Editor", () => {
  test("imports a quiz with a figure after fixing a bad row, then sets its passing score and makes it Visible", async ({
    page,
  }) => {
    await signInAs(page, "editor", paths.admin.contentTopics("CE", "PSAD"));
    await page.getByRole("link", { name: "Import quizzes" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/import\?exam=ce&subject=psad&kind=quizzes$/);

    // A correct answer of "E": the problem names its row and column, and Import stays off.
    const screen = importScreen(page);
    await screen.getByLabel("CSV FILE").setInputFiles(fixture("quiz-import-errors.csv"));
    await screen
      .getByLabel("ZIP OF FIGURES (OPTIONAL)")
      .setInputFiles(fixture("card-import-images.zip"));
    await screen.getByRole("button", { name: "Check file" }).click();
    await expect(
      screen.getByRole("heading", {
        name: "1 PROBLEM · FIX IT IN THE SPREADSHEET, THEN CHECK AGAIN",
      }),
    ).toBeVisible();
    await expect(
      screen
        .getByRole("table", { name: "Problems with the files" })
        .getByRole("row")
        .filter({ hasNotText: "WHERE" }),
    ).toHaveText(["CSV · ROW 3 · CORRECT ANSWERis “E”: write A, B, C or D"]);
    await expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();

    // The fixed file checks clean.
    await screen.getByLabel("CSV FILE").setInputFiles(fixture("quiz-import.csv"));
    await screen.getByRole("button", { name: "Check file" }).click();
    await expect(screen.getByText("2 questions in 1 Topic · 1 new Topic")).toBeVisible();
    await expect(
      screen.getByRole("table", { name: "QUESTIONS PER TOPIC" }).getByText("NEW QUIZ · HIDDEN"),
    ).toBeVisible();

    await screen.getByRole("button", { name: "Import" }).click();
    await expect(screen.getByText("✓ IMPORTED")).toBeVisible();
    await expect(screen.getByRole("list", { name: "Imported Topics" })).toContainText(
      "Beams · new Topic, with a Hidden quiz · 2 added",
    );

    // The quiz arrived Hidden, with the default settings and its figure.
    await screen.getByRole("link", { name: "Open the quiz in Beams" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Beams quiz" })).toBeVisible();
    await expect(page.getByText("CE · PSAD · 2 QUESTIONS · HIDDEN")).toBeVisible();
    const figure = page.getByRole("img", { name: "Figure for question 2" });
    await expect(figure).toBeVisible();
    await expect
      .poll(() => figure.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);

    const settings = page.getByRole("form", { name: "SETTINGS" });
    const score = settings.getByLabel("PASSING SCORE (%)");
    await expect(score).toHaveValue("70");
    await score.fill("0");
    await settings.getByRole("button", { name: "Save settings" }).click();
    await expect(settings.getByText("ENTER A WHOLE NUMBER FROM 1 TO 100")).toBeVisible();
    await score.fill("80");
    await settings.getByRole("button", { name: "Save settings" }).click();
    await expect(settings.getByText("✓ SAVED · MEMBERS’ NEXT ATTEMPT USES THESE")).toBeVisible();

    await page.getByRole("switch", { name: "Visible to members" }).click();
    await expect(page.getByText("CE · PSAD · 2 QUESTIONS · VISIBLE")).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("form", { name: "SETTINGS" }).getByLabel("PASSING SCORE (%)"),
    ).toHaveValue("80");
    await expect(page.getByRole("switch", { name: "Visible to members" })).toBeChecked();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  test("can't make a quiz with no questions Visible", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.quiz(sampleTopicId("CE", "MSTC", "Spiral Curves")));

    const visible = page.getByRole("switch", { name: "Visible to members" });
    await expect(visible).toBeDisabled();
    await expect(visible).toHaveAccessibleDescription(
      "ADD A QUESTION FIRST · A QUIZ NEEDS AT LEAST ONE QUESTION TO BE VISIBLE",
    );
  });

  test("downloads the quiz template and its example figure, and imports them unchanged", async ({
    page,
  }, testInfo) => {
    await signInAs(page, "editor", paths.admin.quizImport("CE", "PSAD"));
    const screen = importScreen(page);

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      screen.getByRole("link", { name: "Download the template (CSV)" }).click(),
    ]);
    expect(csvDownload.suggestedFilename()).toBe("quiz-import-template.csv");
    const csvPath = testInfo.outputPath("quiz-import-template.csv");
    await csvDownload.saveAs(csvPath);
    expect(await readFile(csvPath, "utf8")).toContain(
      "topic,question,choice a,choice b,choice c,choice d,correct answer,explanation,figure",
    );

    const [zipDownload] = await Promise.all([
      page.waitForEvent("download"),
      screen.getByRole("link", { name: "Its example image (zip)" }).click(),
    ]);
    const zipPath = testInfo.outputPath("import-example-images.zip");
    await zipDownload.saveAs(zipPath);

    await screen.getByLabel("CSV FILE").setInputFiles(csvPath);
    await screen.getByLabel("ZIP OF FIGURES (OPTIONAL)").setInputFiles(zipPath);
    await screen.getByRole("button", { name: "Check file" }).click();
    await expect(screen.getByText("2 questions in 1 Topic · 1 new Topic")).toBeVisible();

    await screen.getByRole("button", { name: "Import" }).click();
    await expect(screen.getByText("✓ IMPORTED")).toBeVisible();
  });
});
