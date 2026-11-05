import { expect as baseExpect, type Page, test } from "@playwright/test";

import {
  E2E_PASSWORD,
  ensurePasswordUser,
  LIVE,
  openSignInAs,
  resetSampleData,
  SAMPLE_USERS,
  sampleEmail,
  signInAs,
  signInWithEmail,
} from "./helpers";

// Staff sign-in and the Admin shell (tickets 01 and 16): each sample User's
// sign-in, the 403 screens, the menu by Staff Role, sign out, the mobile
// drawer and noindex. They run on the in-memory sample data, where Staff sign
// in from "Sign in as", and in CI live too, where they are password Users on
// the runner's local Supabase (e2e/admin/helpers.ts). Google itself is never
// reached: CI's local Supabase has no Google client. Live, the "Development
// only" password box (ticket 19) signs in too: e2e's server runs `pnpm dev`,
// and the local Supabase has Email on.

const SAMPLE_ONLY = "The Sign in as list exists in sample mode only.";
const LIVE_ONLY = "Google sign-in through Supabase runs in live mode only.";

// Sign-in redirects and menu clicks are navigations that wait for a dev server
// compiling the Admin's routes for the first time.
const expect = baseExpect.configure({ timeout: 15_000 });

const MANILA_DATE_LINE = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Today's Overview date line in Manila, e.g. "THURSDAY · 22 OCT 2026". */
function todaysDateLine() {
  const parts = Object.fromEntries(
    MANILA_DATE_LINE.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return `${parts.weekday} · ${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

const adminNav = (page: Page) => page.getByRole("navigation", { name: "Admin" });

const passwordBox = (page: Page) => page.getByRole("region", { name: "Development only" });

/** Signs in through the "Development only" password box. Live mode only. */
async function signInThroughBox(page: Page, email: string, password = E2E_PASSWORD, next?: string) {
  await page.goto(next ? `/admin/sign-in?next=${encodeURIComponent(next)}` : "/admin/sign-in");
  const box = passwordBox(page);
  await box.getByLabel("Email").fill(email);
  await box.getByLabel("Password").fill(password);
  await box.getByRole("button", { name: "Sign in" }).click();
  return box;
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("signed out", () => {
  test("/admin sends a signed-out visitor to sign-in, coming back to the Overview", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in to manage the site" }),
    ).toBeVisible();
    await expect(
      page.getByText("Only Google accounts on the admin list can open the dashboard."),
    ).toBeVisible();
  });

  test("Continue with Google opens the Sign in as list of the five sample Users", async ({
    page,
  }) => {
    test.skip(LIVE, SAMPLE_ONLY);
    await page.goto("/admin/sign-in");
    const google = page.getByRole("button", { name: "Continue with Google" });
    await expect(google).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("region", { name: "Sign in as" })).toBeHidden();

    await google.click();
    await expect(google).toHaveAttribute("aria-expanded", "true");
    const list = page.getByRole("region", { name: "Sign in as" });
    for (const { email } of SAMPLE_USERS) {
      await expect(list.getByRole("button", { name: new RegExp(email) })).toBeVisible();
    }
    await expect(list.getByRole("listitem")).toHaveCount(5);
    await expect(list.getByLabel("Other email")).toBeVisible();
    // The password box is live mode's only (ticket 19).
    await expect(passwordBox(page)).toHaveCount(0);
  });

  test("Continue with Google says it isn't set up when the local Supabase has no Google client", async ({
    page,
  }) => {
    test.skip(!LIVE, LIVE_ONLY);
    await page.goto("/admin/sign-in?next=%2Fadmin%2Fproducts");
    await expect(page.getByRole("region", { name: "Sign in as" })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue with Google" }).click();

    await expect(page).toHaveURL(
      /\/admin\/sign-in\?next=%2Fadmin%2Fproducts&error=google-not-set-up$/,
    );
    await expect(page.getByRole("alert")).toHaveText("Google sign-in isn't set up on this server");
  });

  test("a callback with no code, or a bad one, returns to sign-in saying so", async ({ page }) => {
    test.skip(!LIVE, LIVE_ONLY);
    for (const query of ["", "?code=not-a-real-code"]) {
      await page.goto(`/auth/callback${query}`);
      await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin&error=callback$/);
      await expect(page.getByRole("alert")).toHaveText("Sign-in didn't finish. Try again.");
    }
  });

  test("every Admin screen sends a signed-out visitor to sign-in, coming back to it", async ({
    page,
  }) => {
    for (const path of [
      "/admin/exam-pages",
      "/admin/products",
      "/admin/reviews",
      "/admin/settings",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(`/admin/sign-in?next=${encodeURIComponent(path)}`);
    }
  });
});

test.describe("the Owner", () => {
  test("lands on the Overview with the greeting and today's date in Manila", async ({ page }) => {
    await page.goto("/admin");
    await signInAs(page, "owner", "/admin");

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /^Good (morning|afternoon|evening), Angel\.$/,
      }),
    ).toBeVisible();
    await expect(page.getByText(todaysDateLine(), { exact: true })).toBeVisible();
  });

  test("sees the five screens and View site, and each opens with its header", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);

    const nav = adminNav(page);
    await expect(nav.getByRole("link")).toHaveText([
      "01Overview",
      "02Pages & promo",
      "03Products & store links",
      "04Reviews & FAQs",
      "05Settings",
      "View site ↗",
    ]);
    await expect(nav.getByRole("link", { name: "View site" })).toHaveAttribute("href", "/");

    for (const [group, title, path] of [
      ["WEBSITE", "Pages & promo", "/admin/exam-pages"],
      ["WEBSITE", "Products & store links", "/admin/products"],
      ["WEBSITE", "Reviews & FAQs", "/admin/reviews"],
      ["SETTINGS", "Settings", "/admin/settings"],
      ["HOME", "Overview", "/admin"],
    ] as const) {
      await nav.getByRole("link", { name: title }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      const header = page.getByRole("banner");
      await expect(header.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(header.getByText(group, { exact: true })).toBeVisible();
      // Only sample data says so; live, the Admin edits the real site.
      await expect(header.getByText("SAMPLE DATA", { exact: true })).toHaveCount(LIVE ? 0 : 1);
      await expect(header.getByRole("link", { name: "View site" })).toHaveAttribute("href", "/");
      await expect(nav.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
    }
  });

  test("shows the Owner's name, email and Staff Role in the user block", async ({ page }) => {
    await signInAs(page, "owner");
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByText("Angel Rose L. Lepaña", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("angel@aceyourcourse.ph", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("OWNER", { exact: true })).toBeVisible();
  });

  test("comes back to the screen that sent them to sign-in", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Fproducts$/);
    await signInAs(page, "owner", "/admin/products");
    await expect(page).toHaveURL(/\/admin\/products$/);
  });

  for (const next of ["https://evil.example", "//evil.example", "/app", "/admin/../app"]) {
    test(`goes to the Overview, not next=${next}`, async ({ page }) => {
      await signInAs(page, "owner", next);
      await expect(page).toHaveURL(/\/admin$/);
    });
  }

  test("signs out to the sign-in screen, and /admin asks to sign in again", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in to manage the site" }),
    ).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  });
});

test.describe("the Editor", () => {
  test("has no Settings in the menu, and opening Settings gets the owners-only 403", async ({
    page,
  }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/);
    const nav = adminNav(page);
    await expect(nav.getByRole("link", { name: "Reviews & FAQs" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByText("SETTINGS", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("complementary").getByText("EDITOR", { exact: true }),
    ).toBeVisible();

    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "This page is for Owners only" }),
    ).toBeVisible();
    await expect(
      page.getByText("You’re signed in as content@aceyourcourse.ph, an Editor."),
    ).toBeVisible();
    await expect(page.getByText("Nothing was changed.", { exact: false })).toBeVisible();

    await page.getByRole("link", { name: "Back to the Overview" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("an invited email", () => {
  test("activates Kim's Invite from the list, then again from Other email in capitals", async ({
    page,
  }) => {
    await signInAs(page, "invited");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: /^Good (morning|afternoon|evening), Kim\.$/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary").getByText("EDITOR", { exact: true }),
    ).toBeVisible();

    await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);

    // Supabase keeps emails lowercase, so the capitals are sample mode's.
    await signInWithEmail(page, LIVE ? "kim.reyes@gmail.com" : "KIM.REYES@GMAIL.COM");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("complementary").getByText("kim.reyes@gmail.com", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("the 403 screen", () => {
  test("tells Juan he isn't on the admin list and that the attempt was logged", async ({
    page,
  }) => {
    await signInAs(page, "not-staff");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await expect(page.getByText("403 · NOT AUTHORISED")).toBeVisible();
    await expect(
      page.getByText(
        "You’re signed in as juan.delacruz@gmail.com, which isn’t on the admin list. Nothing was changed.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/^THIS ATTEMPT WAS LOGGED · \d{1,2} [A-Z]{3} \d{4}, \d{1,2}:\d{2} [AP]M$/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the website" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(page.getByRole("link", { name: "Go to the member app" })).toHaveCount(0);

    // A User who isn't Staff can't reach any Admin screen.
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
  });

  test("Use another account signs out and returns to sign-in", async ({ page }) => {
    test.skip(LIVE, SAMPLE_ONLY);
    await signInAs(page, "not-staff");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await page.getByRole("button", { name: "Use another account" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  });

  test("Use another account signs out, back to sign-in with Google and the password box", async ({
    page,
  }) => {
    test.skip(!LIVE, LIVE_ONLY);
    await signInAs(page, "not-staff");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await page.getByRole("button", { name: "Use another account" }).click();
    // Where the password box shows, it returns to sign-in instead of Google
    // (ticket 19; a unit test checks Google asks which account to use).
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(passwordBox(page)).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  });

  test("tells the expired Invite to ask an Owner to renew it, and logs the attempt", async ({
    page,
  }) => {
    await signInAs(page, "expired");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=invite-expired$/);
    await expect(page.getByText("expired.invite@example.com", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Your invite expired. Ask an Owner to renew it.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Nothing was changed.", { exact: false })).toBeVisible();
    await expect(page.getByText(/^THIS ATTEMPT WAS LOGGED · /)).toBeVisible();

    // Opening the Admin again gives the same, true reason.
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=invite-expired$/);
    await page.goto("/admin/denied?reason=not-staff");
    await expect(
      page.getByText("Your invite expired. Ask an Owner to renew it.", { exact: false }),
    ).toBeVisible();
  });

  test("never honours the sample cookie live, even the Owner's", async ({ page, baseURL }) => {
    test.skip(!LIVE, LIVE_ONLY);
    await page
      .context()
      .addCookies([{ name: "ayc_admin_sample", value: sampleEmail("owner"), url: baseURL ?? "" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/);
  });

  test("treats a sample cookie for an unknown email as not Staff", async ({ page, baseURL }) => {
    test.skip(LIVE, SAMPLE_ONLY);
    await page
      .context()
      .addCookies([{ name: "ayc_admin_sample", value: "someone@example.com", url: baseURL ?? "" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await expect(page.getByText("someone@example.com", { exact: true })).toBeVisible();
    // Opening the Admin was an attempt too, so it was recorded.
    await expect(page.getByText(/^THIS ATTEMPT WAS LOGGED · /)).toBeVisible();
  });

  test("sends Staff who may use the Admin back to the Overview", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/denied?reason=owners-only");
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("the Development only password box (ticket 19)", () => {
  test.beforeEach(() => {
    test.skip(!LIVE, LIVE_ONLY);
  });

  test("signs the Owner in, landing on the Overview", async ({ page }) => {
    await ensurePasswordUser(sampleEmail("owner"));
    await signInThroughBox(page, sampleEmail("owner"));

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByRole("complementary").getByText("OWNER", { exact: true })).toBeVisible();
  });

  test("lands on next, and on the Overview for another site's next", async ({ page }) => {
    await ensurePasswordUser(sampleEmail("owner"));
    await signInThroughBox(page, sampleEmail("owner"), E2E_PASSWORD, "/admin/settings");
    await expect(page).toHaveURL(/\/admin\/settings$/);

    await page.context().clearCookies();
    await signInThroughBox(page, sampleEmail("owner"), E2E_PASSWORD, "https://evil.example");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("activates a pending Invite for a confirmed password User", async ({ page }) => {
    await ensurePasswordUser(sampleEmail("invited"));
    await signInThroughBox(page, sampleEmail("invited"));

    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("complementary").getByText("EDITOR", { exact: true }),
    ).toBeVisible();
  });

  test("sends a confirmed User who isn't Staff to the 403 screen, logging the attempt", async ({
    page,
  }) => {
    await ensurePasswordUser(sampleEmail("not-staff"));
    await signInThroughBox(page, sampleEmail("not-staff"));

    await expect(page).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
    await expect(page.getByText(/^THIS ATTEMPT WAS LOGGED · /)).toBeVisible();
    await page.getByRole("button", { name: "Use another account" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(passwordBox(page)).toBeVisible();
  });

  test("stays on sign-in with a wrong password, keeping the email", async ({ page }) => {
    await ensurePasswordUser(sampleEmail("owner"));
    const box = await signInThroughBox(page, sampleEmail("owner"), "not-the-password");

    await expect(box.getByRole("alert")).toHaveText("That email and password don't match.");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await expect(box.getByLabel("Email")).toHaveValue(sampleEmail("owner"));
    await expect(box.getByLabel("Password")).toHaveValue("");
  });

  test("says Enter your email and Enter your password next to empty fields", async ({ page }) => {
    const box = await signInThroughBox(page, "", "");

    await expect(box.getByText("Enter your email")).toBeVisible();
    await expect(box.getByText("Enter your password")).toBeVisible();
    await expect(box.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  });
});

test.describe("Other email", () => {
  for (const [typed, message] of [
    ["", "Enter an email address."],
    ["not-an-email", "Enter a valid email address, like name@example.com."],
  ] as const) {
    test(`rejects ${JSON.stringify(typed)} with a message`, async ({ page }) => {
      test.skip(LIVE, SAMPLE_ONLY);
      const list = await openSignInAs(page);
      const field = list.getByLabel("Other email");
      await field.fill(typed);
      await list.getByRole("button", { name: "Sign in", exact: true }).click();

      await expect(list.getByRole("alert")).toHaveText(message);
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveValue(typed);
      await expect(page).toHaveURL(/\/admin\/sign-in$/);
    });
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the Menu button opens the drawer; Escape and the scrim close it and focus returns", async ({
    page,
  }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("complementary")).toBeHidden();

    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(drawer.getByText("Angel Rose L. Lepaña")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await expect(drawer).toBeVisible();
    // Radix starts listening for clicks outside the drawer a moment after it
    // opens, so a click in that moment is ignored. A person taps the scrim once
    // the drawer has slid in; so does this test.
    await drawer.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    // The scrim is the strip to the right of the drawer.
    await page.mouse.click(360, 400);
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await drawer.getByRole("link", { name: "Products & store links" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(drawer).toBeHidden();
  });

  test("fits the sign-in and 403 screens without scrolling sideways", async ({ page }) => {
    if (LIVE) await page.goto("/admin/sign-in");
    else await openSignInAs(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    await signInAs(page, "not-staff");
    await expect(page).toHaveURL(/\/admin\/denied/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
  });
});

test.describe("search engines", () => {
  test("every Admin screen is noindex", async ({ page }) => {
    await page.goto("/admin/sign-in");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );

    await signInAs(page, "not-staff");
    await expect(page).toHaveURL(/\/admin\/denied/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );

    await signInAs(page, "owner");
    for (const path of [
      "/admin",
      "/admin/exam-pages",
      "/admin/products",
      "/admin/reviews",
      "/admin/settings",
    ]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
    }
  });

  test("robots.txt keeps crawlers out of /admin", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin$");
    expect(robots).toContain("Disallow: /admin/");
  });
});
