import { expect, test } from "@playwright/test";

test("Website Home renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Remember every formula on board day." }),
  ).toBeVisible();
});

test("dashboard redirects unauthenticated users to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});
