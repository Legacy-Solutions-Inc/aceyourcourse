import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, sampleEmail, signInAs } from "./helpers";

// The Admin journey on sample data (ticket 12; spec, Testing Decisions → Seam
// 5, Admin): an Editor changes a Product's price and the Website shows it;
// the Editor is refused Settings; Kim's invited email activates on her first
// sign-in; Juan, who isn't Staff, gets the 403 screen; and the Owner's Reset
// brings back the seed, on the Website and on the staff list.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const CARDS = { id: "prd-001", slug: "ce-formula-flash-cards" };
const KIM = sampleEmail("invited");

const productPrice = (page: Page, price: string) => page.getByRole("main").getByText(price).first();
const kimsRow = (page: Page) =>
  page
    .getByRole("region", { name: "ADMIN ACCOUNTS" })
    .getByRole("list", { name: "Admin accounts" })
    .getByRole("listitem")
    .filter({ hasText: KIM });

async function signOut(page: Page) {
  await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("an Editor's price goes live, Settings stays Owners-only, an Invite activates, a non-Staff User is refused, and Reset restores the seed", async ({
  page,
}) => {
  await test.step("an Editor changes a Product's price, and the Website shows it", async () => {
    await page.goto(paths.products.details(CARDS.slug));
    await expect(productPrice(page, "₱1,200")).toBeVisible();

    await signInAs(page, "editor", `${paths.admin.products}?product=${CARDS.id}`);
    const editor = page.getByRole("complementary", { name: "Product editor" });
    await editor.getByRole("textbox", { name: "PRICE FROM", exact: true }).fill("1,250");
    await editor.getByRole("button", { name: "Save product" }).click();
    await expect(editor.getByRole("status")).toHaveText("✓ SAVED · LIVE ON THE SITE");

    await page.goto(paths.products.details(CARDS.slug));
    await expect(productPrice(page, "₱1,250")).toBeVisible();
  });

  await test.step("the Editor is refused Settings", async () => {
    await page.goto(paths.admin.settings);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "This page is for Owners only" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to the Overview" }).click();
    await signOut(page);
  });

  await test.step("Kim's invited email activates on her first sign-in", async () => {
    await signInAs(page, "invited");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { level: 2, name: /^Good (morning|afternoon|evening), Kim\.$/ }),
    ).toBeVisible();
    await signOut(page);
  });

  await test.step("a User who isn't Staff gets the 403 screen", async () => {
    await signInAs(page, "not-staff");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await expect(page.getByText("403 · NOT AUTHORISED")).toBeVisible();
    await page.goto(paths.admin.products);
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await page.getByRole("button", { name: "Use another account" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  });

  await test.step("the Owner's Reset restores the seed", async () => {
    await signInAs(page, "owner", paths.admin.settings);
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(kimsRow(page)).not.toContainText("INVITED");

    await page.getByRole("banner").getByRole("button", { name: "Reset" }).click();
    await expect(kimsRow(page)).toContainText("INVITED");

    await page.goto(paths.products.details(CARDS.slug));
    await expect(productPrice(page, "₱1,200")).toBeVisible();
  });
});
