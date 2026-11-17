import { readFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// A Subject's card import (Phase 3, ticket 06; stories 118, 120–124, 133p), on
// the sample data: an Editor imports a CSV and a zip of images into CE's PSAD,
// which has no Topics yet, sees the Topics created with Hidden decks; a CSV
// with errors shows them and can't be imported; and the template downloads
// and imports unchanged.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const importScreen = (page: Page, subject = "PSAD") =>
  page.getByRole("region", { name: `CE · ${subject} · IMPORT CARDS` });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("an Editor", () => {
  test("imports a CSV and a zip of images, creating Topics with Hidden decks", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.contentTopics("CE", "PSAD"));
    await page.getByRole("link", { name: "Import cards" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/import\?exam=ce&subject=psad$/);

    const screen = importScreen(page);
    await screen.getByLabel("CSV FILE").setInputFiles(fixture("card-import.csv"));
    await screen
      .getByLabel("ZIP OF IMAGES (OPTIONAL)")
      .setInputFiles(fixture("card-import-images.zip"));
    await screen.getByRole("button", { name: "Check file" }).click();

    await expect(
      screen.getByRole("heading", { name: "PREVIEW · NOTHING IS SAVED YET" }),
    ).toBeVisible();
    await expect(screen.getByText("3 cards in 2 Topics · 2 new Topics")).toBeVisible();
    const table = screen.getByRole("table", { name: "CARDS PER TOPIC" });
    await expect(table.getByRole("rowheader")).toHaveText([/^Beams/, /^Columns/]);
    await expect(table.getByText("NEW DECK · HIDDEN")).toHaveCount(2);

    await screen.getByRole("button", { name: "Import" }).click();
    await expect(screen.getByText("✓ IMPORTED")).toBeVisible();
    await expect(screen.getByRole("list", { name: "Imported Topics" })).toContainText(
      "Beams · new Topic, with a Hidden deck · 2 added",
    );

    await screen.getByRole("link", { name: "See PSAD’s Topics" }).click();
    const topics = page.getByRole("region", { name: "CE · PSAD · TOPICS" });
    await expect(
      topics.getByRole("list", { name: "PSAD Topics" }).getByRole("heading", { level: 3 }),
    ).toHaveText(["Beams", "Columns"]);
    await expect(topics.getByRole("list", { name: "What Beams holds" })).toHaveText(
      "DECK · HIDDEN",
    );
    await expect(topics.getByRole("list", { name: "What Columns holds" })).toHaveText(
      "DECK · HIDDEN",
    );
  });

  test("sees each problem in a CSV with errors, where it is, and can't import it", async ({
    page,
  }) => {
    await signInAs(page, "editor", paths.admin.cardImport("CE", "PSAD"));
    const screen = importScreen(page);
    await screen.getByLabel("CSV FILE").setInputFiles(fixture("card-import-errors.csv"));
    await screen.getByRole("button", { name: "Check file" }).click();

    await expect(
      screen.getByRole("heading", {
        name: "3 PROBLEMS · FIX THEM IN THE SPREADSHEET, THEN CHECK AGAIN",
      }),
    ).toBeVisible();
    const problems = screen.getByRole("table", { name: "Problems with the files" });
    await expect(problems.getByRole("row").filter({ hasNotText: "WHERE" })).toHaveText([
      /^CSV · ROW 2 · BACKhas a formula that won’t render, “\\frac\{1\}\{”/,
      "CSV · ROW 3 · BACKis blank",
      "CSV · ROW 4 · IMAGEnames “missing.png”, but no zip of images was chosen",
    ]);
    await expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);

    // Nothing was saved: PSAD still has no Topics.
    await page.goto(paths.admin.contentTopics("CE", "PSAD"));
    await expect(page.getByText("No Topics in PSAD yet. Add the first one below.")).toBeVisible();
  });

  test("downloads the template and its example image, and imports them unchanged", async ({
    page,
  }, testInfo) => {
    await signInAs(page, "editor", paths.admin.cardImport("CE", "PSAD"));
    const screen = importScreen(page);

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      screen.getByRole("link", { name: "Download the template (CSV)" }).click(),
    ]);
    expect(csvDownload.suggestedFilename()).toBe("card-import-template.csv");
    const csvPath = testInfo.outputPath("card-import-template.csv");
    await csvDownload.saveAs(csvPath);
    expect(await readFile(csvPath, "utf8")).toContain("topic,front,back,note,image");

    const [zipDownload] = await Promise.all([
      page.waitForEvent("download"),
      screen.getByRole("link", { name: "Its example image (zip)" }).click(),
    ]);
    const zipPath = testInfo.outputPath("card-import-example-images.zip");
    await zipDownload.saveAs(zipPath);

    await screen.getByLabel("CSV FILE").setInputFiles(csvPath);
    await screen.getByLabel("ZIP OF IMAGES (OPTIONAL)").setInputFiles(zipPath);
    await screen.getByRole("button", { name: "Check file" }).click();
    await expect(screen.getByText("2 cards in 1 Topic · 1 new Topic")).toBeVisible();

    await screen.getByRole("button", { name: "Import" }).click();
    await expect(screen.getByText("✓ IMPORTED")).toBeVisible();
  });
});
