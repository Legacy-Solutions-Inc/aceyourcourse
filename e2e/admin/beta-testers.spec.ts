import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// Beta Testers in the Admin (Phase 3, ticket 01; stories 133a and 133b): an
// Owner opens Users' Beta Testers tab, adds a Google email to the Beta Tester
// list and removes one, and an Editor has no Users screen at all. The sample data starts with
// one Beta Tester, tester@example.com.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAMPLE_TESTER = "tester@example.com";
const NEW_TESTER = "new.tester@example.com";

const testers = (page: Page) => page.getByRole("region", { name: "BETA TESTERS" });
const status = (page: Page) => testers(page).getByRole("status");
const rows = (page: Page) =>
  testers(page).getByRole("list", { name: "Beta Testers" }).getByRole("listitem");
const row = (page: Page, email: string) => rows(page).filter({ hasText: email });

async function openUsers(page: Page) {
  await signInAs(page, "owner", paths.admin.betaTesters);
  await expect(page).toHaveURL(/\/admin\/users\?tab=beta-testers$/);
  await expect(testers(page)).toBeVisible();
}

async function add(page: Page, email: string) {
  await testers(page).getByLabel("GOOGLE ACCOUNT EMAIL").fill(email);
  await testers(page).getByRole("button", { name: "Add Beta Tester" }).click();
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("the Owner", () => {
  test("opens Users from the menu, then the Beta Testers tab, with the sample tester", async ({
    page,
  }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);
    await page
      .getByRole("complementary")
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Users" })
      .click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("banner").getByRole("heading", { level: 1 })).toHaveText("Users");
    await expect(page.getByRole("link", { name: "USERS", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("link", { name: "BETA TESTERS" }).click();
    await expect(page).toHaveURL(/\/admin\/users\?tab=beta-testers$/);
    await expect(page.getByRole("link", { name: "BETA TESTERS" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The sample data's two testers: the tester and the lapsed tester.
    await expect(rows(page)).toHaveCount(2);
    await expect(row(page, SAMPLE_TESTER)).toContainText(/ADDED \d{1,2} [A-Z]{3} \d{4} · BY ANGEL/);
  });

  test("adds a Beta Tester by email, lowercased, and removes them again", async ({ page }) => {
    await openUsers(page);

    await add(page, "New.Tester@Example.com");
    await expect(status(page)).toHaveText(`✓ ADDED · ${NEW_TESTER.toUpperCase()} IS A BETA TESTER`);
    await expect(rows(page)).toHaveCount(3);
    await expect(row(page, NEW_TESTER)).toContainText("BY ANGEL ROSE L. LEPAÑA");
    await expect(testers(page).getByLabel("GOOGLE ACCOUNT EMAIL")).toHaveValue("");

    // The list is the server's: it's still there after a reload.
    await page.reload();
    await expect(row(page, NEW_TESTER)).toBeVisible();

    await row(page, NEW_TESTER)
      .getByRole("button", { name: `Remove ${NEW_TESTER}` })
      .click();
    const dialog = page.getByRole("dialog", { name: `Remove ${NEW_TESTER} from the beta?` });
    await dialog.getByRole("button", { name: "Remove Beta Tester" }).click();

    await expect(status(page)).toHaveText(
      `✓ REMOVED · ${NEW_TESTER.toUpperCase()} IS NO LONGER A BETA TESTER`,
    );
    await expect(rows(page)).toHaveCount(2);
    await page.reload();
    await expect(row(page, NEW_TESTER)).toHaveCount(0);
    await expect(row(page, SAMPLE_TESTER)).toBeVisible();
  });

  test("keeps the tester when the remove dialog is cancelled", async ({ page }) => {
    await openUsers(page);

    await row(page, SAMPLE_TESTER)
      .getByRole("button", { name: `Remove ${SAMPLE_TESTER}` })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row(page, SAMPLE_TESTER)).toBeVisible();
  });

  test("is told why an invalid email, or one already on the list, wasn't added", async ({
    page,
  }) => {
    await openUsers(page);

    await add(page, "not-an-email");
    await expect(
      testers(page).getByText("Enter a valid email address, like name@example.com."),
    ).toBeVisible();

    await add(page, "  TESTER@example.com ");
    await expect(testers(page).getByText("This email is already a Beta Tester.")).toBeVisible();
    await expect(testers(page).getByLabel("GOOGLE ACCOUNT EMAIL")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(rows(page)).toHaveCount(2);
  });
});

test.describe("the Editor", () => {
  test("has no Users in the menu, and opening Users gets the owners-only 403", async ({ page }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("complementary").getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Reviews & FAQs" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    // MEMBER APP holds only Member App content for an Editor.
    await expect(nav.getByRole("link", { name: /Member App content/ })).toBeVisible();

    await page.goto(paths.admin.users);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(page.getByRole("region", { name: "BETA TESTERS" })).toHaveCount(0);
  });
});
