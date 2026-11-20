import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Member App content → a Subject's Topics (Phase 3, ticket 05; story 133n):
// an Editor adds, renames, reorders and deletes an empty Topic, and a Topic
// with content can't be deleted. The sample data's CE MSTC Topics are Simple
// Curves (a deck, quiz and Reviewer PDF), Spiral Curves, Surveying (empty)
// and Algebra (a Hidden deck).

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const topics = (page: Page) => page.getByRole("region", { name: "CE · MSTC · TOPICS" });
const names = (page: Page) =>
  topics(page).getByRole("list", { name: "MSTC Topics" }).getByRole("heading", { level: 3 });
const row = (page: Page, name: string) =>
  topics(page)
    .getByRole("list", { name: "MSTC Topics" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("an Editor", () => {
  test("opens Member App content from the menu, on CE's first Subject", async ({ page }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);
    await page
      .getByRole("complementary")
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Member App content" })
      .click();

    await expect(page).toHaveURL(/\/admin\/content$/);
    await expect(page.getByRole("banner").getByRole("heading", { level: 1 })).toHaveText(
      "Member App content",
    );
    await expect(names(page)).toHaveText([
      "Simple Curves",
      "Spiral Curves",
      "Surveying",
      "Algebra",
    ]);
    await expect(row(page, "Simple Curves")).toContainText(
      "It has a deck, a quiz and a Reviewer PDF. Only an empty Topic can be deleted.",
    );
    await expect(row(page, "Simple Curves").getByRole("button", { name: /^Delete/ })).toHaveCount(
      0,
    );

    await page.getByRole("list", { name: "Subject" }).getByRole("link", { name: "HPGE" }).click();
    await expect(page).toHaveURL(/\/admin\/content\?exam=ce&subject=hpge$/);
    await expect(page.getByRole("region", { name: "CE · HPGE · TOPICS" })).toBeVisible();
  });

  test("adds, renames, reorders and deletes an empty Topic", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
    await expect(topics(page)).toBeVisible();

    // Add: it goes last, empty.
    await topics(page).getByLabel("NEW TOPIC").fill("Highways");
    await topics(page).getByRole("button", { name: "+ Add topic" }).click();
    await expect(names(page)).toHaveText([
      "Simple Curves",
      "Spiral Curves",
      "Surveying",
      "Algebra",
      "Highways",
    ]);
    await expect(row(page, "Highways")).toContainText("EMPTY");
    await expect(topics(page).getByLabel("NEW TOPIC")).toHaveValue("");

    // Rename.
    await page.getByRole("button", { name: "Rename Highways" }).click();
    await row(page, "Highways").getByLabel("NAME").fill("Highway Design");
    await row(page, "Highways").getByRole("button", { name: "Save name" }).click();
    await expect(row(page, "Highway Design")).toBeVisible();

    // Reorder: one place up, ahead of Algebra.
    await page.getByRole("button", { name: "Move up: Highway Design" }).click();
    await expect(names(page)).toHaveText([
      "Simple Curves",
      "Spiral Curves",
      "Surveying",
      "Highway Design",
      "Algebra",
    ]);

    // The server's list, after a reload.
    await page.reload();
    await expect(names(page).nth(3)).toHaveText("Highway Design");

    // Delete, after the confirmation.
    await page.getByRole("button", { name: "Delete Highway Design" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Highway Design” from MSTC?" });
    await dialog.getByRole("button", { name: "Delete topic" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(names(page)).toHaveText([
      "Simple Curves",
      "Spiral Curves",
      "Surveying",
      "Algebra",
    ]);
  });

  test("is told a name already in the Subject wasn't added, ignoring case", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
    await topics(page).getByLabel("NEW TOPIC").fill("simple curves");
    await topics(page).getByRole("button", { name: "+ Add topic" }).click();

    await expect(
      topics(page).getByText("MSTC ALREADY HAS A TOPIC CALLED “simple curves”"),
    ).toBeVisible();
    await expect(names(page)).toHaveCount(4);
  });
});
