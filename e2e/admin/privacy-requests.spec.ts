import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { expectNoBlockingViolations, signInAndOnboard, SKIP_LIVE } from "../member-app/helpers";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// Privacy Requests (Phase 3, ticket 18; stories 111, 112 and 133): the sample
// tester asks, from Account in the Member App, for a copy of their data and
// for their account to be deleted, and sees both pending. An Owner, on
// another device, finds both on the Users screen's Privacy Requests tab, with
// their due dates. An Editor is refused the tab.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const TESTER = "tester@example.com";

const privacy = (page: Page) => page.getByRole("region", { name: "Privacy" });
const requestsList = (page: Page) => page.getByRole("region", { name: "Privacy Requests" });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("a Member and the Owner", () => {
  test.skip(LIVE, SKIP_LIVE);

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

test.describe("the Editor", () => {
  test("is refused the Privacy Requests tab", async ({ page }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(paths.admin.privacyRequests);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(page.getByRole("region", { name: "Privacy Requests" })).toHaveCount(0);
  });
});
