import { expect, test } from "@playwright/test";

test("Website Home renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Remember every topic on board day." }),
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

// The OAuth callback is where Google sign-in comes back (ticket 16). Without a
// code it returns to the Admin's sign-in screen saying so, and it never
// follows an off-site `next`.
test("the OAuth callback without a code returns to sign-in, saying so", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL("/admin/sign-in?next=%2Fadmin&error=callback");
  await expect(page.getByText("Sign-in didn't finish. Try again.")).toBeVisible();
});

test("the OAuth callback never follows an off-site `next`", async ({ page, baseURL }) => {
  await page.goto("/auth/callback?next=//evil.example");
  await expect(page).toHaveURL(`${baseURL}/admin/sign-in?next=%2Fadmin&error=callback`);
});
