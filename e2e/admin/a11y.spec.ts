import { readFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { openSignInAs, resetSampleData, type SampleUserKey, signInAs } from "./helpers";

// The Admin's screens, signed in where they need it, through axe with every
// rule on. Serious and critical issues block, as on the Website
// (e2e/a11y.spec.ts).
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

async function expectNoBlockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ""));
  const summary = blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test("no serious or critical accessibility violations on the sign-in screen", async ({ page }) => {
  await page.goto("/admin/sign-in");
  await expectNoBlockingViolations(page);
});

test("no serious or critical accessibility violations on the open Sign in as list", async ({
  page,
}) => {
  const list = await openSignInAs(page);
  await list.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(list.getByRole("alert")).toBeVisible();
  await expectNoBlockingViolations(page);
});

for (const [who, reason] of [
  ["not-staff", "not-staff"],
  ["expired", "invite-expired"],
] as const satisfies ReadonlyArray<readonly [SampleUserKey, string]>) {
  test(`no serious or critical accessibility violations on the 403 screen (${reason})`, async ({
    page,
  }) => {
    await signInAs(page, who);
    await expect(page).toHaveURL(new RegExp(`reason=${reason}$`), { timeout: 15_000 });
    await expectNoBlockingViolations(page);
  });
}

test("no serious or critical accessibility violations on the owners-only 403 screen", async ({
  page,
}) => {
  await signInAs(page, "editor");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/reason=owners-only$/, { timeout: 15_000 });
  await expectNoBlockingViolations(page);
});

test("no serious or critical accessibility violations on the signed-in screens", async ({
  page,
}) => {
  await signInAs(page, "owner");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  for (const path of [
    "/admin",
    "/admin/exam-pages",
    "/admin/products",
    "/admin/reviews",
    "/admin/settings",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoBlockingViolations(page);
  }
});

test("no serious or critical accessibility violations on Settings showing field messages", async ({
  page,
}) => {
  await signInAs(page, "owner", paths.admin.settings);
  await expect(page).toHaveURL(/\/admin\/settings$/, { timeout: 15_000 });
  const contact = page.getByRole("form", { name: "CONTACT EMAIL" });
  await contact.getByLabel("EMAIL ADDRESS").fill("not-an-email");
  await contact.getByRole("button", { name: "Save" }).click();
  await expect(contact.getByText("ENTER A VALID EMAIL ADDRESS")).toBeVisible({ timeout: 15_000 });
  const links = page.getByRole("form", { name: "STORE & SOCIAL LINKS" });
  await links.getByLabel("SHOPEE").fill("lazada.com.ph/shop");
  await links.getByRole("button", { name: "Save links" }).click();
  await expect(links.getByText("SHOULD BE A SHOPEE.PH LINK")).toBeVisible({ timeout: 15_000 });
  await expectNoBlockingViolations(page);
});

test("no serious or critical accessibility violations on Products with a hidden, a selected and no matching row", async ({
  page,
}) => {
  await signInAs(page, "editor", `${paths.admin.products}?product=prd-005`);
  await expect(page).toHaveURL(/\/admin\/products\?product=prd-005$/, { timeout: 15_000 });
  const hide = page.getByRole("switch", { name: "Show CE Formula Flash Cards on the website" });
  await hide.click();
  await expect(hide).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
  await page.reload();
  await expect(page.getByText("Hidden from the website")).toBeAttached({ timeout: 15_000 });
  await expectNoBlockingViolations(page);

  await page.goto(`${paths.admin.products}?exam=cpa&q=poster&missing=1`);
  await expect(page.getByText("No products match.")).toBeVisible({ timeout: 15_000 });
  await expectNoBlockingViolations(page);
});

/**
 * Waits for a dialog's open animation: mid fade-in it is partly transparent,
 * and axe would measure the blended colours.
 */
async function settled(dialog: Locator) {
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
}

test("no serious or critical accessibility violations on Settings' Admin accounts dialogs", async ({
  page,
}) => {
  await signInAs(page, "owner", paths.admin.settings);
  await expect(page).toHaveURL(/\/admin\/settings$/, { timeout: 15_000 });
  const accounts = page.getByRole("region", { name: "ADMIN ACCOUNTS" });

  await accounts.getByRole("button", { name: "+ Authorise an account" }).click();
  const modal = page.getByRole("dialog", { name: "Give someone admin access" });
  await settled(modal);
  await modal.getByLabel("GOOGLE ACCOUNT EMAIL").fill("bad");
  await modal.getByRole("button", { name: "Add invite" }).click();
  await expect(modal.getByText("Enter a valid email address, like name@example.com.")).toBeVisible({
    timeout: 15_000,
  });
  await expectNoBlockingViolations(page);
  await modal.getByLabel("GOOGLE ACCOUNT EMAIL").fill("new.editor@example.com");
  await modal.getByRole("button", { name: "Add invite" }).click();
  await settled(page.getByRole("dialog", { name: "Now send them the invite" }));
  await expectNoBlockingViolations(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await accounts
    .getByRole("listitem")
    .filter({ hasText: "content@aceyourcourse.ph" })
    .getByRole("button", { name: /^Remove/ })
    .click();
  await settled(page.getByRole("dialog", { name: /^Remove/ }));
  await expectNoBlockingViolations(page);
});

test("no serious or critical accessibility violations on the Product editor, its messages and the typed-DELETE dialog", async ({
  page,
}) => {
  await signInAs(page, "editor", `${paths.admin.products}?product=prd-005`);
  const editor = page.getByRole("complementary", { name: "Product editor" });
  await expect(editor.getByRole("form")).toBeVisible({ timeout: 15_000 });
  await expectNoBlockingViolations(page);

  await editor.getByRole("textbox", { name: "PRICE FROM", exact: true }).fill("abc");
  await editor.getByRole("textbox", { name: "PAGE TITLE", exact: true }).fill("x".repeat(61));
  await editor.getByRole("button", { name: "Save product" }).click();
  await expect(editor.getByText("ENTER A PRICE IN PESOS, LIKE 1,250")).toBeVisible({
    timeout: 15_000,
  });
  await expectNoBlockingViolations(page);

  await editor.getByRole("button", { name: "Delete", exact: true }).click();
  await settled(page.getByRole("dialog", { name: "Delete “Ultimate CE Posters 2.0”?" }));
  await expectNoBlockingViolations(page);
  await page.keyboard.press("Escape");

  await page.goto(`${paths.admin.products}?product=new`);
  await expect(page.getByRole("form", { name: "New product" })).toBeVisible({ timeout: 15_000 });
  await expectNoBlockingViolations(page);
});

test("no serious or critical accessibility violations on the photo strip with uploads, a failure and a refusal", async ({
  page,
}) => {
  await signInAs(page, "editor", `${paths.admin.products}?product=prd-005`);
  const editor = page.getByRole("complementary", { name: "Product editor" });
  await expect(editor.getByRole("form")).toBeVisible({ timeout: 15_000 });
  let puts = 0;
  await page.route("**/api/dev/uploads/**", (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    puts += 1;
    return puts === 1 ? route.abort("failed") : route.continue();
  });
  const photo = await readFile(
    path.join(import.meta.dirname, "..", "fixtures", "product-photo.png"),
  );

  await editor.getByLabel("Add photos").setInputFiles([
    { name: "front.png", mimeType: "image/png", buffer: photo },
    { name: "back.png", mimeType: "image/png", buffer: photo },
    { name: "spinner.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") },
  ]);
  await expect(editor.getByText(/^Upload failed ·/)).toBeVisible({ timeout: 15_000 });
  await expect(editor.getByText("UNSAVED")).toBeVisible();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expectNoBlockingViolations(page);
});

test("no serious or critical accessibility violations on Reviews: the editor, its messages, ▲▼ and the delete dialog", async ({
  page,
}) => {
  await signInAs(page, "editor", `${paths.admin.reviews}?review=rev-014`);
  const editor = page.getByRole("complementary", { name: "Review editor" });
  await expect(editor.getByRole("form", { name: "Edit review" })).toBeVisible({ timeout: 15_000 });
  await expect(editor.getByRole("figure")).toBeVisible();
  await expectNoBlockingViolations(page);

  await editor.getByLabel("REVIEW TEXT · COPY WORD FOR WORD").fill("");
  await editor.getByLabel("HELPFUL VOTES").fill("-1");
  await editor.getByRole("button", { name: "Save review" }).click();
  await expect(editor.getByText("ENTER A WHOLE NUMBER, 0 OR MORE")).toBeVisible({
    timeout: 15_000,
  });
  await expectNoBlockingViolations(page);

  await editor.getByRole("button", { name: "Delete" }).click();
  await settled(page.getByRole("dialog", { name: "Delete this review?" }));
  await expectNoBlockingViolations(page);

  await page.goto(`${paths.admin.reviews}?pinned=1&review=new`);
  await expect(page.getByRole("button", { name: /^Move up on Home/ }).first()).toBeDisabled({
    timeout: 15_000,
  });
  await expectNoBlockingViolations(page);

  await page.goto(`${paths.admin.reviews}?q=nothing-matches`);
  await expect(page.getByText("No reviews match. Clear the search or filters.")).toBeVisible({
    timeout: 15_000,
  });
  await expectNoBlockingViolations(page);

  await page.goto(`${paths.admin.reviews}?tab=faqs`);
  await expect(
    page.getByRole("navigation", { name: "Reviews and FAQs" }).getByRole("link", { name: "FAQS" }),
  ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
  await expectNoBlockingViolations(page);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("no serious or critical accessibility violations with the drawer open", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expectNoBlockingViolations(page);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("no serious or critical accessibility violations on Products", async ({ page }) => {
    await signInAs(page, "editor", paths.admin.products);
    await expect(page.getByRole("region", { name: "Products" })).toBeVisible({ timeout: 15_000 });
    await expectNoBlockingViolations(page);
  });

  test("no serious or critical accessibility violations on Reviews", async ({ page }) => {
    await signInAs(page, "editor", `${paths.admin.reviews}?review=rev-001`);
    await expect(page.getByRole("region", { name: "Reviews" })).toBeVisible({ timeout: 15_000 });
    await expectNoBlockingViolations(page);
  });
});
