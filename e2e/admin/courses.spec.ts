import { expect as baseExpect, type Page, test } from "@playwright/test";

import path from "node:path";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Courses & videos (Phase 5, tickets 01 and 02; stories 156, 174–178, 187),
// on the sample data with the video fake: an Editor builds a Course for CE ·
// PSAD, adds 2 Modules and 3 Lessons, reorders them, moves a Lesson to the
// other Module and renames a Module; the order holds after a reload, and the
// Course can't be made Visible without a Published Lesson. Then an Editor
// uploads a small MP4 to a new Lesson, sees the progress, Processing, then
// the ready video, previews it, publishes the Lesson and makes the Course
// Visible. The sample data has three Visible Courses, every Lesson Published
// with a ready (fake) video.

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
  test("sees the three sample Courses, Visible, from the menu", async ({ page }) => {
    await signInAs(page, "editor");
    await page
      .getByRole("complementary")
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Courses & videos" })
      .click();
    await expect(page).toHaveURL(/\/admin\/content\/courses$/);
    const list = page.getByRole("navigation", { name: "COURSES · 3" });
    await expect(list.getByRole("link")).toHaveText([
      /Surveying & Curves Lectures.*CE · 5 LESSONS · VISIBLE/,
      /PSAD Masterclass.*CE · 3 LESSONS · VISIBLE/,
      /HPGE Crash Course.*CE · 3 LESSONS · VISIBLE/,
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

  test("can't delete a Lesson without typing DELETE", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.courses);
    await page.getByRole("link", { name: /Surveying & Curves Lectures/ }).click();
    await page.getByRole("link", { name: "Simple curves" }).click();
    await expect(page.getByLabel("LESSON TITLE")).toHaveValue("Simple curves");
    await expect(page.getByText(/^VIDEO READY · \d+:\d\d$/)).toBeVisible();

    await page.getByRole("button", { name: "Delete lesson" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("0 members lose their saved position in this lesson.");
    await dialog.getByLabel("TYPE DELETE TO CONFIRM").fill("delete");
    await expect(dialog.getByRole("button", { name: "Delete lesson" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.reload();
    await expect(page.getByLabel("LESSON TITLE")).toHaveValue("Simple curves");
  });

  test("uploads a Lesson's video, previews it, publishes the Lesson and makes the Course Visible", async ({
    page,
  }) => {
    await signInAs(page, "editor", paths.admin.newCourse);
    await page.getByLabel("COURSE TITLE").fill("PSAD Video Lectures");
    await page.getByLabel("SUBJECT").selectOption("PSAD");
    await page.getByRole("button", { name: "Add course" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/courses\?course=[0-9a-f-]{36}$/);
    await addModule(page, "Concrete");
    await addLesson(page, "Concrete", "Beams in flexure");
    await lessonsIn(page, "Concrete").filter({ hasText: "Beams in flexure" }).click();
    await expect(page.getByLabel("LESSON TITLE")).toHaveValue("Beams in flexure");

    // No video yet: Publish is refused.
    await page.getByRole("button", { name: "Publish lesson" }).click();
    await expect(page.getByText("ADD A VIDEO BEFORE PUBLISHING")).toBeVisible();

    // The upload: progress, then Processing, then the ready video with its length.
    await page
      .getByLabel("Video file")
      .setInputFiles(path.join(import.meta.dirname, "..", "fixtures", "lesson-video.mp4"));
    await expect(page.getByText(/^\d+% · .*keep this page open$/)).toBeVisible();
    await expect(page.getByRole("status").getByText("PROCESSING", { exact: true })).toBeVisible();
    await expect(page.getByText(/^VIDEO READY · \d+:\d\d$/)).toBeVisible({ timeout: 30_000 });

    // The preview: the sample player, playing.
    await page.getByRole("button", { name: "▶ Preview" }).click();
    const player = page.getByRole("figure", { name: "Sample video: Beams in flexure" });
    await expect(player.getByText("SAMPLE VIDEO")).toBeVisible();
    await player.getByRole("button", { name: "Play" }).click();
    await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(player.getByTestId("sample-clock")).not.toHaveText(/^0:00 \//);

    await page.getByRole("button", { name: "Publish lesson" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

    // Now the Course can be Visible.
    await page.getByRole("link", { name: /← PSAD Video Lectures/ }).click();
    await page.getByRole("link", { name: "Course settings →" }).click();
    const visible = page.getByRole("switch", { name: "Course visible to members" });
    await visible.click();
    await expect(visible).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.getByRole("switch", { name: "Course visible to members" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
