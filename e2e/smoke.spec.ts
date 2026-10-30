import { expect, test } from "@playwright/test";

test("Website Home renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Remember every formula on board day." }),
  ).toBeVisible();
});

// The template's demo dashboard and email/password auth screens are gone (ADR
// 0008): no Visitor can reach a sign-up, password or demo screen.
for (const path of [
  "/dashboard",
  "/dashboard/customers",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/sign-up-confirm",
  "/auth/reset-password",
  "/auth/update-password",
]) {
  test(`${path} returns 404`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  });
}

// The OAuth callback stays for Phase 2's Google sign-in. Without a code it
// sends the Visitor Home, and it never follows an off-site `next`.
test("the OAuth callback without a code lands on Home", async ({ page, baseURL }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(`${baseURL}/`);
});

test("the OAuth callback never follows an off-site `next`", async ({ page, baseURL }) => {
  await page.goto("/auth/callback?next=//evil.example");
  await expect(page).toHaveURL(`${baseURL}/`);
});
