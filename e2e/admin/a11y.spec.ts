import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

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
});
