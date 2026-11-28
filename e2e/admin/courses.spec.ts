import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Courses & videos (Phase 5, ticket 01; stories 156, 174, 175, 177, 179), on
// the sample data: an Editor builds a Course for CE · PSAD, adds 2 Modules
// and 3 Lessons, reorders them, moves a Lesson to the other Module and
// renames a Module; the order holds after a reload, and the Course can't be
// made Visible without a Published Lesson. The sample data has three Hidden
// Courses with no videos yet.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

const modules = (page: Page) =>
  page.getByRole("list", { name: "Modules" }).getByRole("listitem", { name: /^Module/ });
const lessonsIn = (page: Page, module: string) =>
  page.getByRole("list", { name: `Lessons in ${module}` }).getByRole("link");

async function addModule(page: Page, title: string) {
  await page.getByLabel("NEW MODULE").fill(title);
  await page.getByRole("button", { name: "+ Module" }).click();
  await expect(page.getByRole("listitem", { name: new RegExp(`: ${title}$`) })).toBeVisible();
}

async function addLesson(page: Page, module: string, title: string) {
  await page.getByLabel(`NEW LESSON IN ${module.toUpperCase()}`).fill(title);
  await page
    .getByRole("listitem", { name: new RegExp(`: ${module}$`) })
    .getByRole("button", { name: "+ Lesson" })
    .click();
  await expect(lessonsIn(page, module).filter({ hasText: title })).toBeVisible();
}

test.describe("an Editor", () => {
  test("sees the three sample Courses, Hidden, from the menu", async ({ page }) => {
    await signInAs(page, "editor");
    await page
      .getByRole("complementary")
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Courses & videos" })
      .click();
    await expect(page).toHaveURL(/\/admin\/content\/courses$/);
    const list = page.getByRole("navigation", { name: "COURSES · 3" });
    await expect(list.getByRole("link")).toHaveText([
      /Surveying & Curves Lectures.*CE · 5 LESSONS · HIDDEN/,
      /PSAD Masterclass.*CE · 3 LESSONS · HIDDEN/,
      /HPGE Crash Course.*CE · 3 LESSONS · HIDDEN/,
      "+ New course",
    ]);
    await list.getByRole("link", { name: /PSAD Masterclass/ }).click();
    await page.getByRole("link", { name: "Course settings →" }).click();
    await expect(page.getByText("Sold separately · ₱1,499")).toBeVisible();
  });

  test("builds a Course for CE · PSAD whose order holds after a reload", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.newCourse);
    await page.getByLabel("COURSE TITLE").fill("PSAD Design Lectures");
    await page.getByLabel("SUBJECT").selectOption("PSAD");
    await expect(page.getByText("Included in CE All-Access")).toBeVisible();
    await page.getByRole("button", { name: "Add course" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/courses\?course=[0-9a-f-]{36}$/);
    await expect(page.getByText("CE · PSAD · 0 MODULES · 0 LESSONS · 0 PUBLISHED")).toBeVisible();

    await addModule(page, "Concrete");
    await addModule(page, "Steel");
    await addLesson(page, "Concrete", "Beams");
    await addLesson(page, "Concrete", "Columns");
    await addLesson(page, "Steel", "Tension members");

    // ▲▼: Steel first, then Columns before Beams.
    await page.getByRole("button", { name: "Move up: Steel" }).click();
    await expect(modules(page).first()).toHaveAccessibleName("Module 1: Steel");
    await page.getByRole("button", { name: "Move up: Columns" }).click();
    await expect(lessonsIn(page, "Concrete")).toHaveText(["Columns", "Beams"]);

    // Move to Module…: Beams to Steel, last.
    await page.getByLabel("Move Beams to Module").selectOption("Steel");
    await expect(lessonsIn(page, "Steel")).toHaveText(["Tension members", "Beams"]);

    // The title, edited in place.
    await page.getByRole("button", { name: "Rename Concrete" }).click();
    await page.getByLabel("MODULE TITLE").fill("Reinforced concrete");
    await page.getByRole("button", { name: "Save title" }).click();
    await expect(page.getByRole("button", { name: "Rename Reinforced concrete" })).toBeVisible();

    await page.reload();
    await expect(modules(page)).toHaveCount(2);
    await expect(modules(page).nth(0)).toHaveAccessibleName("Module 1: Steel");
    await expect(modules(page).nth(1)).toHaveAccessibleName("Module 2: Reinforced concrete");
    await expect(lessonsIn(page, "Steel")).toHaveText(["Tension members", "Beams"]);
    await expect(lessonsIn(page, "Reinforced concrete")).toHaveText(["Columns"]);
    await expect(page.getByText("CE · PSAD · 2 MODULES · 3 LESSONS · 0 PUBLISHED")).toBeVisible();

    // It stays Hidden: no Lesson is Published.
    await page.getByRole("link", { name: "Course settings →" }).click();
    await page.getByRole("switch", { name: "Course visible to members" }).click();
    // The toast says why, as the note under the switch does.
    await expect(
      page.locator("[data-sonner-toast]").getByText("Needs at least one published lesson"),
    ).toBeVisible();
    await expect(page.getByRole("switch", { name: "Course visible to members" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("can't publish a Lesson without a video, or delete it without typing DELETE", async ({
    page,
  }) => {
    await signInAs(page, "editor", paths.admin.courses);
    await page.getByRole("link", { name: /Surveying & Curves Lectures/ }).click();
    await page.getByRole("link", { name: "Simple curves" }).click();
    await expect(page.getByLabel("LESSON TITLE")).toHaveValue("Simple curves");

    await page.getByRole("button", { name: "Publish lesson" }).click();
    await expect(page.getByText("ADD A VIDEO BEFORE PUBLISHING")).toBeVisible();

    await page.getByRole("button", { name: "Delete lesson" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("0 members lose their saved position in this lesson.");
    await dialog.getByLabel("TYPE DELETE TO CONFIRM").fill("delete");
    await expect(dialog.getByRole("button", { name: "Delete lesson" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.reload();
    await expect(page.getByLabel("LESSON TITLE")).toHaveValue("Simple curves");
  });
});
