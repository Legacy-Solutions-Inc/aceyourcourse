import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { sampleUserId } from "../../src/services/mock/members";
import { expectNoBlockingViolations, signInAndOnboard, SKIP_LIVE } from "../member-app/helpers";
import { LIVE, resetSampleData, signInAs } from "./helpers";

// Users in the Admin (Phase 3, ticket 16; stories 129, 130 and 132): the
// sample tester signs in to the Member App on one device, then an Owner, on
// another, finds them in the Users list (filter, search, no results), opens
// their detail page, and forces their device to sign out with a reason. The
// tester's next Member App request shows "Session ended". An Editor is
// refused both screens.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const TESTER = "tester@example.com";
/** The sample tester's User id, as "Sign in as" gives it. */
const TESTER_ID = sampleUserId(TESTER);

const usersList = (page: Page) => page.getByRole("region", { name: "Users list" });
/** The Members' rows: each has a link to the Member's page; the header row has none. */
const rows = (page: Page) =>
  usersList(page)
    .getByRole("row")
    .filter({ has: page.getByRole("link") });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search by name or email" });
const chip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Filter" }).getByRole("link", { name, exact: true });
const section = (page: Page, name: string | RegExp) => page.getByRole("region", { name });

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("the Owner", () => {
  test.skip(LIVE, SKIP_LIVE);

  test("finds a Beta Tester, opens their page and signs their device out", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    // The tester's phone: signed in to the Member App, on CE.
    await signInAndOnboard(page, "tester", "CE");

    const desk = await browser.newContext();
    try {
      const owner = await desk.newPage();
      await signInAs(owner, "owner", paths.admin.users);
      await expect(owner).toHaveURL(/\/admin\/users$/);
      await expect(rows(owner)).toHaveCount(1);

      // Filter to the Beta Testers: the tester, with their pass and device.
      await chip(owner, "Beta Tester").click();
      await expect(owner).toHaveURL(/\/admin\/users\?filter=beta$/);
      await expect(chip(owner, "Beta Tester")).toHaveAttribute("aria-current", "true");
      const tester = rows(owner).filter({ hasText: TESTER });
      await expect(tester).toBeVisible();
      await expect(tester).toContainText("BETA TESTER");
      await expect(tester).toContainText("MEMBER");

      // A search with no results, then the way back to everyone.
      await search(owner).fill("nobody");
      await expect(owner).toHaveURL(/q=nobody/);
      await expect(owner.getByText("No users match. Clear the search or filter.")).toBeVisible();
      await owner.getByRole("link", { name: "Show every Member" }).click();
      await expect(owner).toHaveURL(/\/admin\/users$/);
      await search(owner).fill("Bea");
      await expect(owner).toHaveURL(/q=Bea/);
      await expect(rows(owner)).toHaveCount(1);
      await expectNoBlockingViolations(owner);

      // The detail page, with every section.
      await rows(owner).getByRole("link", { name: "Bea Tester" }).click();
      await expect(owner).toHaveURL(new RegExp(`${paths.admin.user(TESTER_ID)}$`));
      await expect(owner.getByRole("heading", { level: 2, name: "Bea Tester" })).toBeVisible();
      await expect(section(owner, "TARGET EXAMS")).toContainText("CE · Civil Engineering");
      await expect(section(owner, "ACCESS PASSES")).toContainText("ACTIVE");
      await expect(section(owner, "PROGRESS")).toContainText("CARDS GOT IT");
      await expect(section(owner, "DEVICE SWITCHES · 1")).toBeVisible();
      await expect(section(owner, "CONSENT")).toContainText("TERMS 2.0 · PRIVACY 2.0");
      await expect(section(owner, "PURCHASE HISTORY")).toContainText(
        "Purchases arrive with Payments (Phase 4).",
      );
      await expectNoBlockingViolations(owner);
      // On a phone, the profile and the sections stack, with no sideways scroll.
      const desktop = owner.viewportSize();
      await owner.setViewportSize({ width: 390, height: 844 });
      await expectNoBlockingViolations(owner);
      if (desktop) await owner.setViewportSize(desktop);

      // Force sign-out: refused without a reason, then done with one.
      const device = section(owner, "ACTIVE DEVICE");
      await device.getByRole("button", { name: "Sign out this device" }).click();
      const dialog = owner.getByRole("dialog", { name: /^Sign Bea out of / });
      await dialog.getByRole("button", { name: "Sign out device" }).click();
      await expect(dialog.getByText("ENTER A REASON · IT’S SAVED IN STAFF ACTIVITY")).toBeVisible();
      await dialog.getByLabel("REASON · SAVED IN STAFF ACTIVITY").fill("Shared with a classmate");
      await dialog.getByRole("button", { name: "Sign out device" }).click();
      await expect(device.getByRole("status")).toContainText("✓ SIGNED OUT");
      await expect(device).toContainText("No Active Device. Nothing to sign out.");
      await expectNoBlockingViolations(owner);
    } finally {
      await desk.close();
    }

    // The tester's phone: its next Member App request lands on "Session ended".
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "You were signed in on another device" }),
    ).toBeVisible();
  });
});

test.describe("the Editor", () => {
  test("is refused the Users list and a Member's detail page", async ({ page }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(paths.admin.users);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await page.goto(paths.admin.user(TESTER_ID));
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(page.getByRole("heading", { level: 2, name: "Bea Tester" })).toHaveCount(0);
  });
});
