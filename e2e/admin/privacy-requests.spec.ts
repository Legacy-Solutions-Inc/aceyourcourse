import { readFile } from "node:fs/promises";

import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import {
  agreeToConsent,
  expectNoBlockingViolations,
  onboardingHeading,
  signInAndOnboard,
  signInAsMember,
} from "../member-app/helpers";
import { LIVE, resetSampleData, signInAs, waitForHydration } from "./helpers";

// Privacy Requests (Phase 3, tickets 18 and 19; stories 111, 112, 133, 133q
// and 133r): the sample tester asks, from Account in the Member App, for a
// copy of their data and for their account to be deleted, and sees both
// pending. An Owner, on another device, finds both on the Users screen's
// Privacy Requests tab, with their due dates. The Owner then carries requests
// out: downloads a Member's data and marks it done, and deletes another
// Member's account after typing their email, after which that Google account
// signs in as a brand-new Member. An Editor is refused all of it. On the
// sample data, the auth admin deletes no Supabase User: "Sign in as" makes none.
//
// Phase 4, ticket 14: the data copy holds the Member's Orders, and deleting
// Lou's account keeps her two paid Orders (AYC-10008, refunded, and
// AYC-10012) for tax records: the confirmation says so, and the Orders list
// still shows both, marked ACCOUNT DELETED.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const TESTER = "tester@example.com";
const LAPSED = "lapsed@example.com";

/** The sections every data copy has (src/lib/member-app/data-export.ts). */
const DATA_SECTIONS = [
  "accessPasses",
  "cardMarks",
  "consents",
  "devices",
  "exportedAt",
  "format",
  "notices",
  "orders",
  "profile",
  "quizAttempts",
  "resume",
  "reviewerPagesViewed",
  "studyDays",
  "targetExams",
  "version",
];

const privacy = (page: Page) => page.getByRole("region", { name: "Privacy" });
const requestsList = (page: Page) => page.getByRole("region", { name: "Privacy Requests" });
/** One of the request screen's facts: the value beside its term (MEMBER, STATUS…). */
const fact = (page: Page, name: string) =>
  page.getByRole("term").filter({ hasText: name }).locator("xpath=following-sibling::dd[1]");

/** A sample Member, in their own browser, joins and asks for a data copy or a deletion from Account. */
async function memberAsks(
  browser: Browser,
  who: "tester" | "lapsed",
  type: "data-copy" | "deletion",
) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInAndOnboard(page, who);
    await page.goto(paths.memberApp.account);
    if (type === "data-copy") {
      await privacy(page).getByRole("button", { name: "Request a copy of my data" }).click();
      await expect(privacy(page).getByRole("status", { name: "Data copy" })).toBeVisible();
      return;
    }
    await privacy(page).getByRole("button", { name: "Delete my account" }).click();
    const warning = privacy(page).getByRole("group", { name: "Delete your account?" });
    await warning.getByLabel("Type DELETE to confirm").fill("DELETE");
    await warning.getByRole("button", { name: "Delete my account" }).click();
    await expect(privacy(page).getByRole("status", { name: "Account deletion" })).toBeVisible();
  } finally {
    await context.close();
  }
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("a Member and the Owner", () => {
  test("the tester asks for a data copy and a deletion; the Owner sees both listed", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await signInAndOnboard(page, "tester");
    await page.goto(paths.memberApp.account);

    // A data copy: one click, then it's pending.
    await privacy(page).getByRole("button", { name: "Request a copy of my data" }).click();
    await expect(privacy(page).getByRole("status", { name: "Data copy" })).toContainText(
      `AYC will email your data to ${TESTER} within 7 days.`,
    );

    // A deletion: the warning, refused without the typed confirmation, then asked for.
    await privacy(page).getByRole("button", { name: "Delete my account" }).click();
    const warning = privacy(page).getByRole("group", { name: "Delete your account?" });
    await expect(warning).toContainText("removed within 30 days");
    await expect(warning).toContainText("Access you paid for isn’t refunded");
    await warning.getByLabel("Type DELETE to confirm").fill("delete");
    await warning.getByRole("button", { name: "Delete my account" }).click();
    await expect(warning.getByRole("alert")).toHaveText("Type DELETE, in capitals, to confirm.");
    await warning.getByLabel("Type DELETE to confirm").fill("DELETE");
    await warning.getByRole("button", { name: "Delete my account" }).click();
    await expect(privacy(page).getByRole("status", { name: "Account deletion" })).toContainText(
      /^Deletion requested on \d{1,2} \w{3} \d{4}\./,
    );

    // Still signed in, and both still pending on the next visit.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    await expect(privacy(page).getByRole("status")).toHaveCount(2);

    const desk = await browser.newContext();
    try {
      const owner = await desk.newPage();
      await signInAs(owner, "owner", paths.admin.users);
      await owner.getByRole("link", { name: "PRIVACY REQUESTS" }).click();
      await expect(owner).toHaveURL(/\/admin\/users\?tab=privacy-requests$/);
      const rows = requestsList(owner).getByRole("row").filter({ hasText: TESTER });
      await expect(rows).toHaveCount(2);
      // Soonest due first: the copy (7 days), then the deletion (30).
      await expect(rows.nth(0)).toContainText("DATA COPY");
      await expect(rows.nth(1)).toContainText("DELETION");
      await expect(rows.nth(0)).toContainText("OPEN");
      await expect(requestsList(owner).getByText("OVERDUE")).toHaveCount(0);
      await expectNoBlockingViolations(owner);
      await owner.setViewportSize({ width: 375, height: 812 });
      await expectNoBlockingViolations(owner);
    } finally {
      await desk.close();
    }
  });
});

test.describe("the Owner carrying requests out", () => {
  test("downloads the tester's data and marks it done; deletes the lapsed tester's account", async ({
    page,
    browser,
  }) => {
    test.setTimeout(240_000);
    await memberAsks(browser, "tester", "data-copy");
    await memberAsks(browser, "lapsed", "deletion");

    await signInAs(page, "owner", paths.admin.privacyRequests);
    await expect(page).toHaveURL(/\/admin\/users\?tab=privacy-requests$/);

    // The data copy: the file, with every section and only the tester's data.
    await requestsList(page)
      .getByRole("link", { name: `DATA COPY · ${TESTER}` })
      .click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Copy of Bea Tester’s data");
    await waitForHydration(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download this Member’s data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^ayc-member-data-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.json$/,
    );
    const data = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(Object.keys(data).sort()).toEqual(DATA_SECTIONS);
    expect(data.profile).toMatchObject({ email: TESTER, name: "Bea Tester" });
    expect(data.consents).toHaveLength(1);
    expect(data.targetExams).toEqual([expect.objectContaining({ examCode: "ME" })]);
    // Bea's sample Order, part refunded; the sample Orders are in the in-memory sample data only.
    expect(data.orders).toEqual(
      LIVE
        ? []
        : [expect.objectContaining({ reference: "AYC-10007", refunds: [expect.anything()] })],
    );
    expect(JSON.stringify(data)).not.toContain(LAPSED);
    await expectNoBlockingViolations(page);

    await page.getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByText("✓ MARKED DONE")).toBeVisible();
    await expect(fact(page, "STATUS")).toContainText("DONE");
    await expect(fact(page, "STATUS")).toContainText("Angel");
    await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(0);

    // The deletion: refused for a wrong email, then done after the right one.
    await page.getByRole("link", { name: "← All Privacy Requests" }).click();
    await requestsList(page)
      .getByRole("link", { name: `DELETION · ${LAPSED}` })
      .click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Delete Lou Lapsed’s account");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Delete this account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete Lou Lapsed’s account?" });
    await expect(dialog).toContainText("Access Passes, with no refund");
    await expect(dialog).toContainText("Their email stays on the Beta Tester list");
    // Lou's two paid Orders are in the in-memory sample data only; with none, it doesn't mention Orders.
    if (LIVE) await expect(dialog).not.toContainText("Orders are kept");
    else {
      await expect(dialog).toContainText(
        "2 paid Orders are kept for tax records, without the account.",
      );
    }
    // Checked once it has faded in: mid-animation, its text is paler than it will be.
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    await expectNoBlockingViolations(page);
    await dialog.getByLabel("TYPE THEIR EMAIL TO CONFIRM").fill(TESTER);
    await dialog.getByRole("button", { name: "Delete account" }).click();
    await expect(dialog.getByText("TYPE THIS MEMBER’S EMAIL EXACTLY TO CONFIRM")).toBeVisible();
    await dialog.getByLabel("TYPE THEIR EMAIL TO CONFIRM").fill(LAPSED);
    await dialog.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByText("✓ ACCOUNT DELETED · REQUEST DONE")).toBeVisible();
    await expect(fact(page, "MEMBER")).toHaveText("Account deleted");
    await expect(fact(page, "STATUS")).toContainText("DONE");
    await expect(page.getByText("The account is deleted.")).toBeVisible();

    // Both done in the list; the deleted Member's request says nothing of them.
    await page.getByRole("link", { name: "← All Privacy Requests" }).click();
    const done = requestsList(page).getByRole("row").filter({ hasText: "DONE" });
    await expect(done).toHaveCount(2);
    await expect(requestsList(page)).not.toContainText(LAPSED);
    await expect(requestsList(page).getByText("Account deleted", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await requestsList(page).getByRole("link", { name: "DELETION · account deleted" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Account deletion");
    await expectNoBlockingViolations(page);

    // Lou's paid Orders stay, with no account, as she bought them (sample data only, as above).
    if (!LIVE) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${paths.admin.orders}?q=${encodeURIComponent(LAPSED)}&range=all`);
      const orders = page.getByRole("region", { name: "Orders list" });
      await expect(orders.getByRole("table").getByRole("link", { name: /^AYC-\d+$/ })).toHaveText([
        "AYC-10008",
        "AYC-10012",
      ]);
      for (const reference of ["AYC-10008", "AYC-10012"]) {
        const row = orders
          .getByRole("row")
          .filter({ has: page.getByRole("link", { name: reference, exact: true }) });
        await expect(row).toContainText(`${LAPSED}ACCOUNT DELETED`);
      }
    }

    // The same Google account signs in again as a brand-new Member.
    const again = await browser.newContext();
    try {
      const lou = await again.newPage();
      await signInAsMember(lou, "lapsed");
      await agreeToConsent(lou);
      await expect(onboardingHeading(lou, "Lou")).toBeVisible();
    } finally {
      await again.close();
    }
  });
});

test.describe("the Editor", () => {
  test("is refused the Privacy Requests tab, a request's screen and its download", async ({
    page,
  }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(paths.admin.privacyRequests);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(page.getByRole("region", { name: "Privacy Requests" })).toHaveCount(0);

    const anyRequest = "5d2c1b0a-9e8f-4a7b-8c6d-0e1f2a3b4c5d";
    await page.goto(paths.admin.privacyRequest(anyRequest));
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    const refused = await page.request.post(paths.admin.privacyRequestData(anyRequest));
    expect(refused.status()).toBe(403);
    expect(refused.headers()["cache-control"]).toBe("no-store");
  });
});
