import { expect, test } from "@playwright/test";

// The Website shell on a real browser. The e2e server runs with the Member App
// switch off (MEMBER_APP_LIVE unset), the launch default.

const CREAM = "rgb(246, 241, 231)";

const EXAMS = [
  ["Civil Engineering", "/exams/ce"],
  ["Mechanical Engineering", "/exams/me"],
  ["Electrical Engineering", "/exams/ee"],
  ["Medical Technology", "/exams/mt"],
  ["Accountancy", "/exams/cpa"],
] as const;

test("sets a nonce Content-Security-Policy on a public page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toMatch(
    /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
  );
});

test("shows no Member App link while the switch is off", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
});

test.describe("in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("keeps the light theme", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", CREAM);
  });
});

test.describe("on desktop", () => {
  test("opens the Exams menu, lists every Exam, and closes on Escape", async ({ page }) => {
    await page.goto("/");
    const examsButton = page.getByRole("button", { name: "Exams" });

    await examsButton.click();
    await expect(examsButton).toHaveAttribute("aria-expanded", "true");
    const header = page.getByRole("banner");
    for (const [name, href] of EXAMS) {
      const tile = header.getByRole("link", { name: new RegExp(name) });
      await expect(tile).toBeVisible();
      await expect(tile).toHaveAttribute("href", href);
    }

    await page.keyboard.press("Escape");
    await expect(examsButton).toHaveAttribute("aria-expanded", "false");
    await expect(header.getByRole("link", { name: /Civil Engineering/ })).toBeHidden();
  });

  test("remembers a dismissed announcement on the next visit", async ({ page }) => {
    await page.goto("/");
    const dismiss = page.getByRole("button", { name: "Dismiss announcement" });

    await dismiss.click();
    await expect(dismiss).toBeHidden();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss announcement" })).toBeHidden();
  });
});

test.describe("on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens a drawer with the Exam grid, the four links and the Printed copies row", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Exams" })).toBeHidden();

    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    for (const [name, href] of EXAMS) {
      const tile = drawer.getByRole("link", { name: new RegExp(name) });
      await expect(tile).toBeVisible();
      await expect(tile).toHaveAttribute("href", href);
    }
    for (const name of ["Products", "Reviews", "About", "FAQ"]) {
      await expect(drawer.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(drawer.getByText("Printed copies")).toBeVisible();
    for (const [name, href] of [
      [/shopee/i, "https://shopee.ph/aceyourcourse"],
      [/lazada/i, "https://www.lazada.com.ph/shop/aceyourcourse"],
      [/tiktok/i, "https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop"],
    ] as const) {
      const link = drawer.getByRole("link", { name });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
    }

    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(drawer).toBeHidden();
  });
});
