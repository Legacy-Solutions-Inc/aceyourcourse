import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { formatDate } from "../../src/lib/manila-time";
import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import {
  daysFromToday,
  examForm,
  expectNoBlockingViolations,
  LIVE,
  onboardingHeading,
  signInAndAgree,
  signInAndOnboard,
  SKIP_LIVE,
  startCountdown,
} from "./helpers";

// Onboarding and Target Exams on sample data (Phase 3, ticket 03): a new
// Member picks their Exam and Exam Date, then adds, switches, edits and
// removes Target Exams, and the shell follows the selected one. The sample
// data's Exams start with no Official Exam Date, so an Owner sets one in the
// Admin where a test needs it. Dates are counted from today, in Asia/Manila.

const expect = baseExpect.configure({ timeout: 15_000 });

const sidebar = (page: Page) => page.getByRole("complementary");
const switcher = (page: Page) => sidebar(page).getByRole("button", { name: /STUDYING FOR/ });
const countdown = (page: Page) => page.getByRole("region", { name: /board exam countdown/ });
const yourExams = (page: Page) => page.getByRole("region", { name: "Your exams" });
const yourExam = (page: Page, name: string) => yourExams(page).getByRole("article", { name });

/** A Staff User sets an Exam's Official Exam Date in the Admin, in their own browser context. */
async function staffSetOfficialDate(browser: Browser, examCode: string, date: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(
      page,
      "owner",
      `${paths.admin.examPages}?exam=${examCode.toLowerCase()}&section=date`,
    );
    const editor = page.getByRole("complementary", { name: "Exam page editor" });
    await editor.getByLabel("OFFICIAL EXAM DATE", { exact: true }).fill(date);
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(editor.getByRole("status")).toHaveText(/SAVED/);
  } finally {
    await context.close();
  }
}

/** Adds another Target Exam through the add form, with its date `days` from today. */
async function addExam(page: Page, examCode: string, days: number) {
  await page.goto(paths.memberApp.addExam);
  const form = examForm(page);
  await form.pick(examCode);
  await form.date.fill(daysFromToday(days));
  await page.getByRole("button", { name: "Add exam" }).click();
  await expect(page).toHaveURL(/\/app(\?restored=\w+)?$/);
}

test.skip(LIVE, SKIP_LIVE);

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("onboarding", () => {
  test("a new Member picks their Exam and date, starts the countdown, and lands on Home", async ({
    page,
  }) => {
    await signInAndAgree(page, "tester");

    await expect(page).toHaveURL(/\/app$/);
    await expect(onboardingHeading(page, "Bea")).toBeVisible();
    await expect(page.getByText("STEP 1 · YOUR EXAM")).toBeVisible();
    await expect(switcher(page)).toHaveCount(0);

    // Every Exam on the Website is a pill, and each can be selected.
    const form = examForm(page);
    await expect(page.getByRole("radio")).toHaveCount(5);
    for (const code of ["ME", "CPA", "EE"]) {
      await form.pick(code);
      await expect(form.pill(code)).toBeChecked();
    }
    await expect(form.pill("ME")).not.toBeChecked();

    // EE has no Official Exam Date, so the Member must give one.
    await expect(
      page.getByText("There’s no official REE date yet. Enter your exam date."),
    ).toBeVisible();
    await expect(form.date).toHaveValue("");
    await page.getByRole("button", { name: "Start my countdown" }).click();
    await expect(onboardingHeading(page, "Bea")).toBeVisible();

    await form.date.fill(daysFromToday(30));
    await page.getByRole("button", { name: "Start my countdown" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Welcome, Bea" })).toBeVisible();
    await expect(page.getByText("01 · HOME · EE · REE")).toBeVisible();
    await expect(countdown(page)).toContainText("REE BOARD EXAM");
    await expect(countdown(page)).toContainText("30days to go");
    await expect(countdown(page)).toContainText(
      `${formatDate(daysFromToday(30))} · Date set by you`,
    );
    await expect(switcher(page)).toContainText("EE · REE");
    await expect(switcher(page)).toContainText("30 days to the exam");
    await expect(sidebar(page).getByText("Studying for EE · REE")).toBeAttached();
  });

  test("sends a Member with no Target Exam to Home from every other screen", async ({ page }) => {
    await signInAndAgree(page, "tester");
    for (const path of [
      paths.memberApp.library,
      paths.memberApp.account,
      paths.memberApp.addExam,
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app$/);
      await expect(onboardingHeading(page, "Bea")).toBeVisible();
    }
  });

  test("refuses a date that has passed", async ({ page }) => {
    await signInAndAgree(page, "tester");
    const form = examForm(page);
    await form.pick("CE");
    // Typed past the field's own earliest date, as a browser without it would send it.
    await form.date.evaluate((input) => input.removeAttribute("min"));
    await form.date.fill(daysFromToday(-1));
    await page.getByRole("button", { name: "Start my countdown" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "That date has passed. Enter today’s date or a later one.",
    );
    await expect(onboardingHeading(page, "Bea")).toBeVisible();
  });

  test("prefills the Official Exam Date, and a Member who kept it follows a Staff change", async ({
    page,
    browser,
  }) => {
    await staffSetOfficialDate(browser, "CE", daysFromToday(40));
    await signInAndAgree(page, "tester");

    const form = examForm(page);
    await expect(form.pill("CE")).toBeChecked();
    await expect(form.date).toHaveValue(daysFromToday(40));
    await expect(
      page.getByText(`The official CELE exam date is ${formatDate(daysFromToday(40))}.`, {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start my countdown" }).click();

    await expect(countdown(page)).toContainText("40days to go");
    await expect(countdown(page)).toContainText("Official exam date");

    await staffSetOfficialDate(browser, "CE", daysFromToday(47));
    await page.reload();
    await expect(countdown(page)).toContainText("47days to go");
    await expect(switcher(page)).toContainText("47 days to the exam");
  });

  test("a Member who edited their date keeps it when Staff change the Official Exam Date", async ({
    page,
    browser,
  }) => {
    await staffSetOfficialDate(browser, "CE", daysFromToday(40));
    await signInAndAgree(page, "tester");
    await page.getByRole("button", { name: "Start my countdown" }).click();
    await expect(countdown(page)).toContainText("40days to go");

    await countdown(page).getByRole("link", { name: "Change date" }).click();
    await expect(page).toHaveURL(/\/app\/account$/);
    const ce = yourExam(page, "Civil Engineering");
    await ce.getByLabel("CE exam date").fill(daysFromToday(55));
    await ce.getByRole("button", { name: "Save date" }).click();
    await expect(ce.getByRole("status")).toHaveText("Date saved.");
    await expect(ce).toContainText("Date set by you · 55 days to the exam");

    await staffSetOfficialDate(browser, "CE", daysFromToday(47));
    await page.goto(paths.memberApp.home);
    await expect(countdown(page)).toContainText("55days to go");
    await expect(countdown(page)).toContainText("Date set by you");
  });
});

test.describe("Target Exams", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOnboard(page, "tester", "ME");
  });

  test("adds a second Exam from the switcher, switches between them, and the shell follows", async ({
    page,
  }) => {
    await expect(switcher(page)).toContainText("ME · MELE");

    await switcher(page).click();
    await sidebar(page).getByRole("link", { name: "+ Add an exam" }).click();
    await expect(page).toHaveURL(/\/app\/add-exam$/);
    // ME is the Member's already, so it isn't offered again.
    await expect(page.getByRole("radio")).toHaveCount(4);
    const form = examForm(page);
    await form.pick("CPA");
    await form.date.fill(daysFromToday(90));
    await page.getByRole("button", { name: "Add exam" }).click();

    // The one just added is selected.
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("01 · HOME · CPA · CPALE")).toBeVisible();
    await expect(countdown(page)).toContainText("CPALE BOARD EXAM");
    await expect(countdown(page)).toContainText("90days to go");
    await expect(switcher(page)).toContainText("CPA · CPALE");

    // Switch back to ME: the card, the header, the countdown and the badge change.
    await switcher(page).click();
    const list = sidebar(page).getByRole("list", { name: "Your exams" });
    await expect(list.getByRole("button")).toHaveText([
      /Mechanical Engineering.*Exam /,
      /Accountancy|CPA/,
    ]);
    await expect(list.getByRole("button").nth(1)).toHaveAttribute("aria-current", "true");
    await list.getByRole("button", { name: /Mechanical Engineering/ }).click();

    await expect(switcher(page)).toContainText("ME · MELE");
    await expect(switcher(page)).toContainText("30 days to the exam");
    await expect(page.getByText("01 · HOME · ME · MELE")).toBeVisible();
    await expect(countdown(page)).toContainText("MELE BOARD EXAM");
    await expect(sidebar(page).getByText("Studying for ME · MELE")).toBeAttached();

    // The selection is remembered on the next visit.
    await page.reload();
    await expect(switcher(page)).toContainText("ME · MELE");
  });

  test("edits an Exam Date in Account, and refuses one that has passed", async ({ page }) => {
    await page.goto(paths.memberApp.account);
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    const me = yourExam(page, "Mechanical Engineering");
    const date = me.getByLabel("ME exam date");
    await expect(date).toHaveValue(daysFromToday(30));

    await date.fill(daysFromToday(12));
    await me.getByRole("button", { name: "Save date" }).click();
    await expect(me.getByRole("status")).toHaveText("Date saved.");
    await expect(me).toContainText("12 days to the exam");
    await expect(switcher(page)).toContainText("12 days to the exam");

    await date.evaluate((input) => input.removeAttribute("min"));
    await date.fill(daysFromToday(-3));
    await me.getByRole("button", { name: "Save date" }).click();
    await expect(me.getByRole("alert")).toHaveText(
      "That date has passed. Enter today’s date or a later one.",
    );
    await page.reload();
    await expect(yourExam(page, "Mechanical Engineering")).toContainText("12 days to the exam");
  });

  test("removes a Target Exam after confirming, can't remove the last one, and restores it when added back", async ({
    page,
  }) => {
    await addExam(page, "CE", 60);
    await page.goto(paths.memberApp.account);

    // Keeping it changes nothing.
    await page.getByRole("button", { name: "Remove CE" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove CE from your exams?" });
    await expect(dialog).toContainText("Your progress and exam date are kept");
    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(dialog).toBeHidden();
    await expect(yourExams(page).getByRole("article")).toHaveCount(2);

    // Removing it takes it out of Account, the switcher and Home.
    await page.getByRole("button", { name: "Remove CE" }).click();
    await dialog.getByRole("button", { name: "Remove CE" }).click();
    await expect(yourExams(page).getByRole("article")).toHaveCount(1);
    await expect(switcher(page)).toContainText("ME · MELE");
    await switcher(page).click();
    await expect(
      sidebar(page).getByRole("list", { name: "Your exams" }).getByRole("button"),
    ).toHaveCount(1);

    // The last one can't be removed.
    await expect(page.getByRole("button", { name: "Remove ME" })).toBeDisabled();
    await expect(page.getByText(/This is your only exam, so it can’t be removed/)).toBeVisible();

    // Adding CE again restores it with the date it had, whatever date is typed now.
    await addExam(page, "CE", 200);
    await expect(page.getByRole("status")).toContainText("CE is back in your exams");
    await expect(countdown(page)).toContainText("60days to go");
  });

  test("the add form refuses an Exam that isn't on the Website, even when posted directly", async ({
    page,
  }) => {
    await page.goto(paths.memberApp.addExam);
    const form = examForm(page);
    await form.pick("CE");
    await form.date.fill(daysFromToday(20));
    // Change the picked pill's value to an Exam that doesn't exist, as a tampered form would.
    await form.pill("CE").evaluate((input: HTMLInputElement) => {
      input.value = "XYZ";
    });
    await page.getByRole("button", { name: "Add exam" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Pick one of the exams listed.",
    );
    await page.goto(paths.memberApp.account);
    await expect(yourExams(page).getByRole("article")).toHaveCount(1);
  });

  test("one Member never sees another's Target Exams", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const owner = await context.newPage();
      await signInAndAgree(owner, "owner");
      await expect(onboardingHeading(owner, "Angel")).toBeVisible();
      await startCountdown(owner, "CE", 15);
      await expect(owner.getByText("01 · HOME · CE · CELE")).toBeVisible();
      await owner.goto(paths.memberApp.account);
      await expect(yourExams(owner).getByRole("article")).toHaveCount(1);
      await expect(yourExam(owner, "Civil Engineering")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the drawer has the exam switcher, and “+ Add an exam” closes the drawer", async ({
    page,
  }) => {
    await signInAndOnboard(page, "tester", "ME");
    await page.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    const card = drawer.getByRole("button", { name: /STUDYING FOR/ });
    await expect(card).toContainText("ME · MELE");

    await card.click();
    await expect(drawer.getByRole("list", { name: "Your exams" })).toBeVisible();
    await drawer.getByRole("link", { name: "+ Add an exam" }).click();
    await expect(page).toHaveURL(/\/app\/add-exam$/);
    await expect(drawer).toBeHidden();
  });
});

test.describe("accessibility", () => {
  for (const size of [
    { name: "a desktop", viewport: { width: 1280, height: 800 } },
    { name: "a phone", viewport: { width: 375, height: 812 } },
  ] as const) {
    test.describe(`on ${size.name} (${size.viewport.width} px)`, () => {
      test.use({ viewport: size.viewport });

      test("no serious or critical violations on onboarding, with a refusal showing", async ({
        page,
      }) => {
        await signInAndAgree(page, "tester");
        await expect(onboardingHeading(page, "Bea")).toBeVisible();
        await expectNoBlockingViolations(page);

        const form = examForm(page);
        await form.date.evaluate((input) => input.removeAttribute("min"));
        await form.date.fill(daysFromToday(-1));
        await page.getByRole("button", { name: "Start my countdown" }).click();
        await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
        await expectNoBlockingViolations(page);
      });

      test("no serious or critical violations on Home's countdown, the add form and Account", async ({
        page,
      }) => {
        await signInAndOnboard(page, "tester", "ME");
        await expectNoBlockingViolations(page);

        await addExam(page, "CE", 60);
        await page.goto(paths.memberApp.addExam);
        await expect(page.getByRole("heading", { level: 1, name: "Add an exam" })).toBeVisible();
        await expectNoBlockingViolations(page);

        await page.goto(paths.memberApp.account);
        await expect(yourExams(page).getByRole("article")).toHaveCount(2);
        await expectNoBlockingViolations(page);

        await page.getByRole("button", { name: "Remove CE" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        // Its fade-in has to finish, or the text is measured half-transparent.
        await dialog.evaluate((element) =>
          Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished)),
        );
        await expectNoBlockingViolations(page);
      });

      test("no serious or critical violations with the exam switcher open", async ({ page }) => {
        await signInAndOnboard(page, "tester", "ME");
        if (size.viewport.width < 760) await page.getByRole("button", { name: "Menu" }).click();
        const card = page.getByRole("button", { name: /STUDYING FOR/ });
        await card.click();
        await expect(page.getByRole("list", { name: "Your exams" })).toBeVisible();
        await expectNoBlockingViolations(page);
      });
    });
  }
});
