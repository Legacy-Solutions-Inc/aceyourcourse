import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin, waitForHydration } from "../admin/helpers";
import {
  agreeToConsent,
  consentScreen,
  expectNoBlockingViolations,
  LIVE,
  memberEmail,
  onboardingHeading,
  openSignInAs,
  passwordBox,
  signInAndOnboard,
  signInAsMember,
  startCountdown,
  signInWithEmail,
  SKIP_LIVE,
} from "./helpers";

// The Member App's shell, sign-in, beta gate and consent on sample data
// (Phase 3, tickets 01 and 02). The Member App switch is off on the e2e
// server, so only active Staff and Beta Testers get past sign-in; everyone
// else sees "Not open yet". Each sample Member starts with nothing agreed (the
// renewing tester with v2.0, ticket 13), so their first visit shows the
// consent screen, and with no Target Exam, so
// Home then shows onboarding (ticket 03, target-exams.spec.ts). The Beta
// Tester list is read on every request, so an Owner's change applies to the
// other person's next click.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const STRANGER = memberEmail("stranger");
const TESTER = memberEmail("tester");

const sidebar = (page: Page) => page.getByRole("complementary");
const memberNav = (page: Page) => sidebar(page).getByRole("navigation", { name: "Member App" });
const welcome = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name: `Welcome, ${name}` });
const notOpenYet = (page: Page) => page.getByRole("heading", { level: 1, name: "Not open yet" });
const consentHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "What we keep, and why" });

/** A second person, in their own browser context. */
async function anotherPerson(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("a signed-out visitor", () => {
  test("is sent from /app to the sign-in screen, which offers Google (and live, under pnpm dev, the password box)", async ({
    page,
  }) => {
    await page.goto(paths.memberApp.home);

    await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    if (LIVE) {
      // Ticket 20: live under `pnpm dev`, with the local Supabase's Email provider on.
      await expect(
        page.getByText(
          "Google is the usual way to sign in. The password sign-in below is for development only.",
        ),
      ).toBeVisible();
      await expect(passwordBox(page).getByLabel("Password")).toBeVisible();
    } else {
      await expect(
        page.getByText("Use your Google account. No separate username or password."),
      ).toBeVisible();
      await expect(page.getByLabel("Password")).toHaveCount(0);
    }
    await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/legal/terms");
  });

  test("is sent to sign-in from every Member App address, coming back to it", async ({ page }) => {
    for (const path of [paths.memberApp.library, paths.memberApp.plans, paths.memberApp.account]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/app/sign-in\\?next=${encodeURIComponent(path)}$`));
    }
    await page.goto(paths.memberApp.notOpenYet);
    await expect(page).toHaveURL(/\/app\/sign-in$/);
  });

  test("sees the five sample Members in the development-only Sign in as list", async ({ page }) => {
    test.skip(LIVE, SKIP_LIVE);
    const list = await openSignInAs(page);
    await expect(list.getByText("SAMPLE DATA · DEVELOPMENT ONLY")).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveText([
      /Bea Tester.*tester@example\.com · Beta Tester · CE All-Access$/,
      /Angel Rose L\. Lepaña.*angel@aceyourcourse\.ph · Owner/,
      /Sam Stranger.*stranger@example\.com · Not a Beta Tester/,
      /Lou Lapsed.*lapsed@example\.com · Beta Tester · CE All-Access ended/,
      /Rae Renewing.*renewing@example\.com · Beta Tester · CE All-Access ends in 5 days · agreed to Legal v2\.0/,
    ]);
  });
});

test.describe("a Beta Tester", () => {
  test("signs in and reaches Home, in the shell with its seven screens", async ({ page }) => {
    await signInAndOnboard(page, "tester");

    await expect(page).toHaveURL(/\/app$/);
    await expect(welcome(page, "Bea")).toBeVisible();
    await expect(memberNav(page).getByRole("link")).toHaveText([
      /^01Home/,
      /^02Library/,
      /^03Courses/,
      /^04Plans/,
      /^05Billing/,
      /^06Account/,
      /^07Support/,
    ]);
    await expect(memberNav(page).getByRole("link", { name: /Home/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebar(page).getByText("Bea Tester", { exact: true })).toBeVisible();
    await expect(sidebar(page).getByText(TESTER, { exact: true })).toBeVisible();
  });

  test("comes back to the screen that sent them to sign-in", async ({ page }) => {
    await signInAndOnboard(page, "tester");
    await sidebar(page).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/app\/sign-in$/);

    await page.goto(paths.memberApp.library);
    await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp%2Flibrary$/);
    await signInAsMember(page, "tester", paths.memberApp.library);

    await expect(page).toHaveURL(/\/app\/library$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Subjects and topics" }),
    ).toBeVisible();
    await expect(memberNav(page).getByRole("link", { name: /Library/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  for (const next of ["https://evil.example", "//evil.example", "/admin", "/app/../admin"]) {
    test(`goes to Home, not next=${next}`, async ({ page }) => {
      await signInAsMember(page, "tester", next);
      await expect(page).toHaveURL(/\/app\/consent\?next=%2Fapp$/);
      await agreeToConsent(page);
      await expect(page).toHaveURL(/\/app$/);
      await expect(onboardingHeading(page, "Bea")).toBeVisible();
    });
  }

  test("opens each screen that isn't built yet, and goes back Home", async ({ page }) => {
    await signInAndOnboard(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();

    // Billing has its own screen since Phase 4, ticket 06 (billing.spec.ts).
    for (const [label, path] of [["Courses", "/app/courses"]] as const) {
      await memberNav(page)
        .getByRole("link", { name: new RegExp(label) })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coming in the beta");
      await expect(memberNav(page).getByRole("link", { name: new RegExp(label) })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    await page.getByRole("link", { name: "Back to Home" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("signs out to the sign-in screen, and /app asks to sign in again", async ({ page }) => {
    await signInAndOnboard(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();

    await sidebar(page).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/app\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

    await page.goto(paths.memberApp.home);
    await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp$/);
  });

  test("is refused at their next click once an Owner removes them", async ({ page, browser }) => {
    await signInAndOnboard(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();

    const owner = await anotherPerson(browser);
    try {
      await signInToAdmin(owner.page, "owner", paths.admin.betaTesters);
      const testers = owner.page.getByRole("region", { name: "BETA TESTERS" });
      await testers.getByRole("button", { name: `Remove ${TESTER}` }).click();
      await owner.page
        .getByRole("dialog")
        .getByRole("button", { name: "Remove Beta Tester" })
        .click();
      await expect(testers.getByRole("status")).toContainText("✓ REMOVED");
    } finally {
      await owner.context.close();
    }

    await memberNav(page)
      .getByRole("link", { name: /Library/ })
      .click();
    await expect(page).toHaveURL(/\/app\/not-open-yet$/);
    await expect(notOpenYet(page)).toBeVisible();
  });
});

test.describe("the consent screen", () => {
  test("shows first, says what's kept, and keeps Agree disabled until both boxes are ticked", async ({
    page,
  }) => {
    await signInAsMember(page, "tester");

    await expect(page).toHaveURL(/\/app\/consent\?next=%2Fapp$/);
    await expect(page.getByText("BEFORE YOU START", { exact: true })).toBeVisible();
    await expect(consentHeading(page)).toBeVisible();
    await expect(
      page.getByRole("list", { name: "What we keep, and why" }).getByRole("listitem"),
    ).toHaveCount(5);
    // Outside the shell, as in the mockup: no menu yet.
    await expect(page.getByRole("navigation")).toHaveCount(0);

    const consent = consentScreen(page);
    await expect(consent.terms).not.toBeChecked();
    await expect(consent.privacy).not.toBeChecked();
    await expect(consent.agree).toBeDisabled();

    await consent.terms.check();
    await expect(consent.agree).toBeDisabled();
    await consent.terms.uncheck();
    await consent.privacy.check();
    await expect(consent.agree).toBeDisabled();
    await consent.terms.check();
    await expect(consent.agree).toBeEnabled();

    await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    await expect(consent.terms).toHaveAccessibleName(/version 2\.1/);
  });

  test("comes before every Member App address until the Member agrees", async ({ page }) => {
    await signInAsMember(page, "tester");
    await expect(consentHeading(page)).toBeVisible();

    for (const path of [
      paths.memberApp.home,
      paths.memberApp.library,
      paths.memberApp.plans,
      paths.memberApp.billing,
      paths.memberApp.account,
      paths.memberApp.support,
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/app/consent\\?next=${encodeURIComponent(path)}$`));
    }
  });

  test("agreeing continues to onboarding, then to where the Member goes, and isn't asked again", async ({
    page,
  }) => {
    await page.goto(paths.memberApp.plans);
    await signInAsMember(page, "tester", paths.memberApp.plans);
    await agreeToConsent(page);

    // A new Member has no Target Exam yet, so Home's onboarding comes first.
    await expect(page).toHaveURL(/\/app$/);
    await startCountdown(page);
    await page.goto(paths.memberApp.plans);
    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect(memberNav(page).getByRole("link", { name: /Plans/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // The agreement is kept: later visits, and the consent address itself, go straight on.
    await page.goto(paths.memberApp.home);
    await expect(welcome(page, "Bea")).toBeVisible();
    await page.goto(paths.memberApp.consent(paths.memberApp.library));
    await expect(page).toHaveURL(/\/app\/library$/);
  });

  // Legal v2.1 (Phase 4, ticket 13): the renewing tester starts having agreed
  // to v2.0, so their next visit asks once more, then goes on.
  test("asks a Member who agreed to v2.0 once more, for v2.1, then goes Home and doesn't ask again", async ({
    page,
  }) => {
    await signInAsMember(page, "renewing");
    await expect(page).toHaveURL(/\/app\/consent\?next=%2Fapp$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "We’ve updated our Terms and Privacy Policy" }),
    ).toBeVisible();
    const consent = consentScreen(page);
    await expect(consent.terms).toHaveAccessibleName(/version 2\.1/);
    await expect(consent.privacy).toHaveAccessibleName(/version 2\.1/);
    await expectNoBlockingViolations(page);

    await agreeToConsent(page);
    // Rae has no Target Exam yet, so Home shows onboarding.
    await expect(page).toHaveURL(/\/app$/);
    await expect(onboardingHeading(page, "Rae")).toBeVisible();

    // Asked once: later visits, and the consent address itself, go straight on.
    await page.goto(paths.memberApp.home);
    await expect(onboardingHeading(page, "Rae")).toBeVisible();
    await page.goto(paths.memberApp.consent(paths.memberApp.home));
    await expect(page).toHaveURL(/\/app$/);
  });

  test("offers Sign out to someone who doesn't want to agree", async ({ page }) => {
    await signInAsMember(page, "tester");
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/app\/sign-in$/);
    await page.goto(paths.memberApp.home);
    await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp$/);
  });

  test("is never shown to someone the gate doesn't let in", async ({ page }) => {
    await signInAsMember(page, "stranger");
    await expect(notOpenYet(page)).toBeVisible();

    await page.goto(paths.memberApp.consent());
    await expect(page).toHaveURL(/\/app\/not-open-yet$/);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the Menu button is in a bar across the top, which stays there as the page scrolls", async ({
    page,
  }) => {
    await signInAndOnboard(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();
    const bar = page.getByRole("navigation", { name: "Member App menu" });
    await expect(bar.getByRole("button", { name: "Menu" })).toBeVisible();
    expect((await bar.boundingBox())?.y).toBe(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect((await bar.boundingBox())?.y).toBe(0);
  });

  test("the Menu button opens the drawer; Escape, ✕ and the scrim close it", async ({ page }) => {
    await signInAndOnboard(page, "tester");
    await expect(welcome(page, "Bea")).toBeVisible();
    await expect(sidebar(page)).toBeHidden();

    const menu = page.getByRole("button", { name: "Menu" });
    const drawer = page.getByRole("dialog", { name: "Menu" });

    await menu.click();
    await expect(
      drawer.getByRole("navigation", { name: "Member App" }).getByRole("link"),
    ).toHaveCount(7);
    // The streak button (ticket 15) is in the drawer too.
    await expect(drawer.getByRole("link", { name: "START A STREAK STUDY TODAY" })).toBeVisible();
    await expect(drawer.getByText(TESTER, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    await menu.click();
    await drawer.getByRole("button", { name: "Close menu" }).click();
    await expect(drawer).toBeHidden();

    await menu.click();
    await expect(drawer).toBeVisible();
    // The drawer listens for a tap outside only once it has opened: wait for
    // its slide-in to finish. The scrim is everything to the right of it.
    await drawer.evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    await page.mouse.click(360, 400);
    await expect(drawer).toBeHidden();
  });

  test("a screen chosen in the drawer opens, and Sign out is in the drawer too", async ({
    page,
  }) => {
    await signInAndOnboard(page, "tester");
    await page.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await drawer.getByRole("link", { name: /Plans/ }).click();

    await expect(page).toHaveURL(/\/app\/plans$/);
    await expect(drawer).toBeHidden();

    await page.getByRole("button", { name: "Menu" }).click();
    await drawer.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/app\/sign-in$/);
  });
});

test.describe("active Staff", () => {
  test("the Owner reaches Home without being a Beta Tester, after agreeing", async ({ page }) => {
    await signInAsMember(page, "owner");
    await expect(consentHeading(page)).toBeVisible();
    await agreeToConsent(page);
    await expect(page).toHaveURL(/\/app$/);
    await expect(onboardingHeading(page, "Angel")).toBeVisible();
    await startCountdown(page);
    await expect(welcome(page, "Angel")).toBeVisible();
  });
});

test.describe("someone who is neither Staff nor a Beta Tester", () => {
  test("sees “Not open yet” with the support email, and can sign out", async ({ page }) => {
    await signInAsMember(page, "stranger");

    await expect(page).toHaveURL(/\/app\/not-open-yet$/);
    await expect(notOpenYet(page)).toBeVisible();
    await expect(page.getByText(STRANGER, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:.+@.+/);
    await expect(page.getByRole("navigation")).toHaveCount(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/app\/sign-in$/);
    await page.goto(paths.memberApp.home);
    await expect(page).toHaveURL(/\/app\/sign-in\?next=%2Fapp$/);
  });

  test("stays signed in, and is refused every Member App address they ask for", async ({
    page,
  }) => {
    await signInAsMember(page, "stranger");
    await expect(notOpenYet(page)).toBeVisible();

    for (const path of [paths.memberApp.home, paths.memberApp.library, paths.memberApp.account]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app\/not-open-yet$/);
    }
    // Signed in already, the sign-in screen sends them on, here again.
    await page.goto(paths.memberApp.signIn());
    await expect(page).toHaveURL(/\/app\/not-open-yet$/);
  });

  test("gets in the moment an Owner adds them, whatever case their email was typed in", async ({
    page,
    browser,
  }) => {
    await signInWithEmail(page, "late.joiner@example.com");
    await expect(notOpenYet(page)).toBeVisible();

    const owner = await anotherPerson(browser);
    try {
      await signInToAdmin(owner.page, "owner", paths.admin.betaTesters);
      const testers = owner.page.getByRole("region", { name: "BETA TESTERS" });
      await testers.getByLabel("GOOGLE ACCOUNT EMAIL").fill("Late.Joiner@Example.com");
      await testers.getByRole("button", { name: "Add Beta Tester" }).click();
      await expect(testers.getByRole("status")).toContainText("✓ ADDED");
    } finally {
      await owner.context.close();
    }

    await page.reload();
    await expect(page).toHaveURL(/\/app\/consent\?next=%2Fapp$/);
    await agreeToConsent(page);
    // They signed in while the gate refused them, so sign-in claimed no
    // device (ticket 04): one tap makes this browser their Active Device.
    await expect(page).toHaveURL(/\/app\/device\?next=%2Fapp$/);
    await page.getByRole("button", { name: "Use the Member App on this device" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(onboardingHeading(page, "late.joiner")).toBeVisible();
  });
});

test.describe("accessibility", () => {
  for (const size of [
    { name: "a desktop", viewport: { width: 1280, height: 800 } },
    { name: "a phone", viewport: { width: 375, height: 812 } },
  ] as const) {
    test.describe(`on ${size.name} (${size.viewport.width} px)`, () => {
      test.use({ viewport: size.viewport });

      test("no serious or critical violations on the sign-in screen, with Sign in as (or live, the password box) showing an error", async ({
        page,
      }) => {
        await page.goto(paths.memberApp.signIn());
        await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
        await expectNoBlockingViolations(page);

        if (LIVE) {
          // The password box, with its field errors showing.
          await waitForHydration(page);
          await passwordBox(page).getByRole("button", { name: "Sign in", exact: true }).click();
          await expect(passwordBox(page).getByText("Enter your email")).toBeVisible();
        } else {
          const list = await openSignInAs(page);
          await list.getByRole("button", { name: "Sign in", exact: true }).click();
          await expect(list.getByRole("alert")).toBeVisible();
        }
        await expectNoBlockingViolations(page);
      });

      test("no serious or critical violations on Home and a screen that isn't built yet", async ({
        page,
      }) => {
        await signInAndOnboard(page, "tester");
        await expect(welcome(page, "Bea")).toBeVisible();
        await expectNoBlockingViolations(page);

        // The Library, Plans and Billing are built (their checks are in
        // library.spec.ts, plans.spec.ts and billing.spec.ts); Courses isn't yet.
        await page.goto(paths.memberApp.courses);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coming in the beta");
        await expectNoBlockingViolations(page);
      });

      test("no serious or critical violations on the consent screen, before and after ticking", async ({
        page,
      }) => {
        await signInAsMember(page, "tester");
        await expect(consentHeading(page)).toBeVisible();
        await expectNoBlockingViolations(page);

        const consent = consentScreen(page);
        await consent.terms.check();
        await consent.privacy.check();
        await expect(consent.agree).toBeEnabled();
        await expectNoBlockingViolations(page);
      });

      test("no serious or critical violations on “Not open yet”", async ({ page }) => {
        await signInAsMember(page, "stranger");
        await expect(notOpenYet(page)).toBeVisible();
        await expectNoBlockingViolations(page);
      });
    });
  }
});
