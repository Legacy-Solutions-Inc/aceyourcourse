import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData } from "../admin/helpers";
import {
  expectNoBlockingViolations,
  LIVE,
  signInAndOnboard,
  signInAsMember,
  SKIP_LIVE,
} from "./helpers";

// Resume and progress (Phase 5, ticket 04; stories 158, 160–162, 166) on the
// in-memory sample data with the video fake: Bea Tester has watched
// "Distance and leveling" to the end (done) and left "Traverse computations"
// (16:46) at 12:40 two days ago. She picks it up there, plays and pauses in
// the sample player (each pause saves), reloads, and it picks up where she
// paused; Home shows the Lesson to continue and the Lessons done; "Mark
// complete · next lesson →" marks it done and opens the next one. Signed in
// on another device meanwhile, a save sends this one to "Session ended".
// Live there's no video service (so no player to drive), and no sample
// progress: this spec is the sample data's.

const expect = baseExpect.configure({ timeout: 15_000 });

const SURVEYING = "Surveying & Curves Lectures";

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const region = (page: Page, name: string) => page.getByRole("region", { name });
const player = (page: Page, title: string) =>
  page.getByRole("figure", { name: `Sample video: ${title}` });
const clock = (page: Page, title: string) => player(page, title).getByTestId("sample-clock");
const sidePanel = (page: Page) => page.getByRole("navigation", { name: SURVEYING });

/** The next save the Lesson screen posts (its Server Action, on the Lesson's own address). */
const saved = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /^\/app\/courses\/[^/]+\/lessons\/[^/]+$/.test(new URL(response.url()).pathname),
  );

/** Plays the sample player for a moment and pauses it, which saves; gives the clock's "mm:ss" then. */
async function playAndPause(page: Page, title: string): Promise<string> {
  const video = player(page, title);
  await video.getByRole("button", { name: "Play" }).click();
  const before = (await clock(page, title).textContent()) ?? "";
  // Let the clock move on a second or two: no real wait, just the next ticks.
  await expect(clock(page, title)).not.toHaveText(before);
  await expect(clock(page, title)).not.toHaveText((await clock(page, title).textContent()) ?? "");
  const posted = saved(page);
  await video.getByRole("button", { name: "Pause" }).click();
  await posted;
  return ((await clock(page, title).textContent()) ?? "").split(" / ")[0] ?? "";
}

/** Another device: its own browser context. */
async function anotherDevice(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.beforeEach(async ({ request }) => {
  test.skip(LIVE, SKIP_LIVE);
  await resetSampleData(request);
});

test("Bea picks a Lesson up where she stopped, Home shows it, and Mark complete moves her on", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInAndOnboard(page, "tester", "CE");

  // Her Course card: 1 of 5 done, and the Lesson she left.
  await memberNav(page)
    .getByRole("link", { name: /Courses/ })
    .click();
  const surveying = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { level: 3, name: SURVEYING }) });
  await expect(surveying.getByText("1 / 5")).toBeVisible();
  await surveying.getByRole("link", { name: "Continue: Traverse computations →" }).click();

  // It picks up at 12:40, saying when she stopped; the side panel marks the Lessons.
  await expect(
    page.getByRole("heading", { level: 1, name: "Traverse computations" }),
  ).toBeVisible();
  await expect(
    page.getByText("You stopped here 2 days ago. The video picks up at 12:40."),
  ).toBeVisible();
  await expect(clock(page, "Traverse computations")).toHaveText("12:40 / 16:46");
  await expect(
    sidePanel(page).getByRole("link", { name: /^Done: Distance and leveling/ }),
  ).toContainText("✓");
  await expect(
    sidePanel(page).getByRole("link", { name: /^Now: Traverse computations/ }),
  ).toContainText("▶");
  await expect(
    sidePanel(page).getByRole("link", { name: /^To do: Areas and volumes/ }),
  ).toContainText("○");
  await expect(sidePanel(page)).toContainText("1 / 5 DONE");
  await expectNoBlockingViolations(page);

  // She plays, pauses (which saves), and reloads: it picks up where she paused.
  const pausedAt = await playAndPause(page, "Traverse computations");
  expect(pausedAt).not.toBe("12:40");
  await page.reload();
  await expect(
    page.getByText(`You stopped here earlier today. The video picks up at ${pausedAt}.`),
  ).toBeVisible();
  await expect(clock(page, "Traverse computations")).toHaveText(`${pausedAt} / 16:46`);

  // Home: the Lesson to continue, MSTC's Lessons done and the Exam's.
  await memberNav(page).getByRole("link", { name: /Home/ }).click();
  const resume = region(page, "Continue where you left off").getByRole("link", {
    name: /VIDEO LESSON/,
  });
  await expect(resume).toContainText(`VIDEO LESSON · MSTC`);
  await expect(resume).toContainText("Traverse computations");
  await expect(resume).toContainText(`${pausedAt} OF 16:46`);
  const subjects = region(page, "Progress by subject");
  await expect(subjects).toContainText("1 / 5 LESSONS");
  await expect(subjects.getByRole("link", { name: /MSTC/ })).toContainText("1 lesson");
  await expectNoBlockingViolations(page);

  // Resume goes back to it; Mark complete marks it done and opens the next Lesson.
  await resume.click();
  await expect(clock(page, "Traverse computations")).toHaveText(`${pausedAt} / 16:46`);
  await page.getByRole("button", { name: "Mark complete · next lesson →" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Areas and volumes" })).toBeVisible();
  await expect(page.getByText("Starts from the beginning.")).toBeVisible();
  await expect(
    sidePanel(page).getByRole("link", { name: /^Done: Traverse computations/ }),
  ).toContainText("✓");
  await expect(sidePanel(page)).toContainText("2 / 5 DONE");

  await page.goto(paths.memberApp.home);
  await expect(region(page, "Progress by subject")).toContainText("2 / 5 LESSONS");
});

test("a save after signing in on another device goes to Session ended, saving nothing", async ({
  page,
  browser,
}) => {
  await signInAndOnboard(page, "tester", "CE");
  await memberNav(page)
    .getByRole("link", { name: /Courses/ })
    .click();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { level: 3, name: SURVEYING }) })
    .getByRole("link", { name: "Continue: Traverse computations →" })
    .click();
  await expect(clock(page, "Traverse computations")).toHaveText("12:40 / 16:46");
  const lessonUrl = page.url();

  const phone = await anotherDevice(browser);
  try {
    await signInAsMember(phone.page, "tester");
    await expect(phone.page).toHaveURL(/\/app(\/|$)/);

    // Back on this one: play, then pause, which saves; the server refuses it
    // and sends this device to "Session ended", taking the video away.
    const video = player(page, "Traverse computations");
    await video.getByRole("button", { name: "Play" }).click();
    await expect(clock(page, "Traverse computations")).not.toHaveText("12:40 / 16:46");
    await video.getByRole("button", { name: "Pause" }).click();
    await expect(page).toHaveURL(/\/app\/device\?next=%2Fapp%2Fcourses%2F/);
    await expect(
      page.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeVisible();
    await expect(page.getByText("SESSION ENDED", { exact: true })).toBeVisible();
    await expect(page.getByRole("figure")).toHaveCount(0);
    await expectNoBlockingViolations(page);

    // The save was refused: the Lesson still picks up at 12:40 for the new device.
    await phone.page.goto(lessonUrl);
    await expect(clock(phone.page, "Traverse computations")).toHaveText("12:40 / 16:46");
  } finally {
    await phone.context.close();
  }
});
