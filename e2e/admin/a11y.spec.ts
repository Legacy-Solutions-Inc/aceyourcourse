import { readFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import {
  LIVE,
  openSignInAs,
  resetSampleData,
  type SampleUserKey,
  signInAs,
  UPLOAD_URLS,
} from "./helpers";

// Every Admin screen and state, signed in where it needs it, through axe with
// every rule on, on a desktop and on a phone (ticket 12). Serious and critical
// issues block, as on the Website (e2e/a11y.spec.ts), and no screen may
// scroll sideways. On every screen, with its editor and dialog open, the
// keyboard alone reaches every control, each with a visible focus ring.
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

const SIZES = [
  { name: "a desktop", viewport: { width: 1280, height: 800 } },
  { name: "a phone", viewport: { width: 375, height: 812 } },
] as const;

/** No serious or critical axe issues, and the page doesn't scroll sideways. */
async function expectNoBlockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ""));
  const summary = blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);

  const sideways = await page.evaluate(() => {
    const scrolling = document.scrollingElement;
    return scrolling ? scrolling.scrollWidth - window.innerWidth : 0;
  });
  expect(sideways, "how far the page scrolls sideways, in px").toBeLessThanOrEqual(0);
}
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

/**
 * Tabs through `scope` (the page, or an open dialog, which keeps focus inside
 * it), and checks that it reaches every visible control there that isn't
 * disabled, and that each one shows a focus ring as it does: an outline, or a
 * ring drawn with a box shadow it hasn't at rest.
 */
async function expectKeyboardReachesEveryControl(page: Page, scope = page.locator("body")) {
  // No locator lists every focusable control, so the page marks its own, and
  // each Tab reads which mark has focus.
  const total = await scope.evaluate((root) => {
    for (const marked of document.querySelectorAll<HTMLElement>("[data-keyboard-check]")) {
      delete marked.dataset.keyboardCheck;
    }
    let count = 0;
    for (const element of root.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]",
    )) {
      const box = element.getBoundingClientRect();
      const usable =
        element.tabIndex >= 0 &&
        !element.matches(":disabled") &&
        !element.closest("[inert]") &&
        getComputedStyle(element).visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0;
      // Tab stops once in a group of radios, at the checked one (else the
      // first), and the arrow keys move within it.
      const radioStop =
        !(element instanceof HTMLInputElement) ||
        element.type !== "radio" ||
        element ===
          ([
            ...root.querySelectorAll<HTMLInputElement>(
              `input[type="radio"][name="${element.name}"]`,
            ),
          ].find((radio) => radio.checked) ??
            root.querySelector(`input[type="radio"][name="${element.name}"]`));
      if (!usable || !radioStop) continue;
      element.dataset.keyboardCheck = String(count++);
      // What the failure message calls it: its tag and role, and its name.
      const label =
        element.getAttribute("aria-label") ??
        (element instanceof HTMLInputElement ? element.labels?.[0]?.textContent : null) ??
        element.textContent;
      element.dataset.keyboardName = [
        element.tagName.toLowerCase(),
        element.getAttribute("type") ?? element.getAttribute("role") ?? "",
        `“${label?.trim().slice(0, 60) ?? ""}”`,
      ]
        .filter(Boolean)
        .join(" ");
      // A shadow it has at rest isn't a focus ring.
      element.dataset.restingShadow = getComputedStyle(element).boxShadow;
    }
    return count;
  });
  expect(total).toBeGreaterThan(0);

  const reached = new Set<string>();
  const withoutRing = new Set<string>();
  for (let press = 0; press < total * 2 + 10 && reached.size < total; press += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element.dataset.keyboardCheck === undefined) {
        return null;
      }
      const outlined = (style: CSSStyleDeclaration) =>
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const style = getComputedStyle(element);
      // A radio or checkbox inside its label may ring the label instead.
      const label = element.closest("label");
      return {
        id: element.dataset.keyboardCheck,
        name: element.dataset.keyboardName ?? "",
        ring:
          element.matches(":focus-visible") &&
          (outlined(style) ||
            style.boxShadow !== element.dataset.restingShadow ||
            (label !== null && outlined(getComputedStyle(label)))),
      };
    });
    // Judged as Tab arrives: further Tabs inside a date field reach its own
    // calendar button, which the browser rings itself.
    if (!focused || reached.has(focused.id)) continue;
    reached.add(focused.id);
    if (!focused.ring) withoutRing.add(focused.name);
  }

  const missed = await page.evaluate(
    (ids) =>
      [...document.querySelectorAll<HTMLElement>("[data-keyboard-check]")]
        .filter((element) => !ids.includes(element.dataset.keyboardCheck ?? ""))
        .map((element) => element.dataset.keyboardName ?? ""),
    [...reached],
  );
  expect(missed, "controls Tab never reached").toEqual([]);
  expect([...withoutRing], "controls with no visible focus ring").toEqual([]);
}

/**
 * The keyboard sweep's screens: each Admin screen with its editor open, and
 * the dialog it opens, if any.
 */
const KEYBOARD_SCREENS: {
  name: string;
  who: SampleUserKey;
  path: string;
  /** Something that shows once the screen is ready. */
  ready: (page: Page) => Locator;
  dialog?: { open: (page: Page) => Promise<void>; name: string | RegExp };
}[] = [
  {
    name: "the Overview",
    who: "owner",
    path: paths.admin.overview,
    ready: (page) => page.getByRole("heading", { level: 1, name: "Overview" }),
  },
  {
    name: "Products, with the Product editor and its typed-DELETE dialog",
    who: "editor",
    path: `${paths.admin.products}?product=prd-005`,
    ready: (page) => page.getByRole("complementary", { name: "Product editor" }).getByRole("form"),
    dialog: {
      open: (page) =>
        page
          .getByRole("complementary", { name: "Product editor" })
          .getByRole("button", { name: "Delete", exact: true })
          .click(),
      name: "Delete “Ultimate CE Posters 2.0”?",
    },
  },
  {
    name: "Reviews, with the Review editor and its delete dialog",
    who: "editor",
    path: `${paths.admin.reviews}?review=rev-014`,
    ready: (page) => page.getByRole("form", { name: "Edit review" }),
    dialog: {
      open: (page) =>
        page
          .getByRole("complementary", { name: "Review editor" })
          .getByRole("button", { name: "Delete" })
          .click(),
      name: "Delete this review?",
    },
  },
  {
    name: "FAQs, with the FAQ editor and its delete dialog",
    who: "editor",
    path: `${paths.admin.reviews}?tab=faqs&group=paper&faq=faq-005`,
    ready: (page) => page.getByRole("form", { name: "Edit question" }),
    dialog: {
      open: (page) =>
        page
          .getByRole("complementary", { name: "FAQ editor" })
          .getByRole("button", { name: "Delete" })
          .click(),
      name: /^Delete “/,
    },
  },
  {
    name: "Exam pages, with the Search & AI visibility editor",
    who: "editor",
    path: `${paths.admin.examPages}?exam=ce&section=seo`,
    ready: (page) =>
      page.getByRole("complementary", { name: "Exam page editor" }).getByLabel("PAGE TITLE"),
  },
  {
    name: "the Home promo banner",
    who: "editor",
    path: `${paths.admin.examPages}?page=promo`,
    ready: (page) => page.getByRole("form", { name: "Home promo banner" }),
  },
  {
    name: "the announcement bar",
    who: "editor",
    path: `${paths.admin.examPages}?page=announcement`,
    ready: (page) => page.getByRole("form", { name: "Announcement bar" }),
  },
  {
    name: "Settings, with the add-invite modal",
    who: "owner",
    path: paths.admin.settings,
    ready: (page) => page.getByRole("region", { name: "ADMIN ACCOUNTS" }),
    dialog: {
      open: (page) =>
        page
          .getByRole("region", { name: "ADMIN ACCOUNTS" })
          .getByRole("button", { name: "+ Authorise an account" })
          .click(),
      name: "Give someone admin access",
    },
  },
];

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

for (const size of SIZES) {
  test.describe(`on ${size.name} (${size.viewport.width} px)`, () => {
    test.use({ viewport: size.viewport });

    test("no serious or critical accessibility violations on the sign-in screen", async ({
      page,
    }) => {
      await page.goto("/admin/sign-in");
      await expectNoBlockingViolations(page);
    });

    test("no serious or critical accessibility violations on the open Sign in as list", async ({
      page,
    }) => {
      test.skip(LIVE, "The Sign in as list exists in sample mode only.");
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
      await expect(contact.getByText("ENTER A VALID EMAIL ADDRESS")).toBeVisible({
        timeout: 15_000,
      });
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
      await expect(
        modal.getByText("Enter a valid email address, like name@example.com."),
      ).toBeVisible({
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
      await expect(page.getByRole("form", { name: "New product" })).toBeVisible({
        timeout: 15_000,
      });
      await expectNoBlockingViolations(page);
    });

    test("no serious or critical accessibility violations on the photo strip with uploads, a failure and a refusal", async ({
      page,
    }) => {
      await signInAs(page, "editor", `${paths.admin.products}?product=prd-005`);
      const editor = page.getByRole("complementary", { name: "Product editor" });
      await expect(editor.getByRole("form")).toBeVisible({ timeout: 15_000 });
      let puts = 0;
      await page.route(UPLOAD_URLS, (route) => {
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
      await expect(editor.getByRole("form", { name: "Edit review" })).toBeVisible({
        timeout: 15_000,
      });
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
        page
          .getByRole("navigation", { name: "Reviews and FAQs" })
          .getByRole("link", { name: "FAQS" }),
      ).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
      await expectNoBlockingViolations(page);
    });

    test("no serious or critical accessibility violations on FAQs: the editor, its quote, its messages, a search and the delete dialog", async ({
      page,
    }) => {
      await signInAs(page, "editor", `${paths.admin.reviews}?tab=faqs&group=paper&faq=faq-005`);
      const editor = page.getByRole("complementary", { name: "FAQ editor" });
      await expect(editor.getByRole("form", { name: "Edit question" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(editor.getByText("★★★★★ · Ultimate CE Posters 2.0")).toBeVisible();
      await expectNoBlockingViolations(page);

      await editor.getByLabel("QUESTION", { exact: true }).fill("");
      await editor.getByLabel("ANSWER", { exact: true }).fill("a".repeat(401));
      await editor.getByRole("switch", { name: "Popular question" }).click();
      await editor.getByRole("button", { name: "Save question" }).click();
      await expect(editor.getByText("WRITE A QUESTION AND ANSWER TO SAVE")).toBeVisible({
        timeout: 15_000,
      });
      await expect(editor.getByText("WRITE THE CHIP LABEL")).toBeVisible();
      await expectNoBlockingViolations(page);

      await editor.getByRole("button", { name: "Delete" }).click();
      await settled(page.getByRole("dialog", { name: /^Delete “/ }));
      await expectNoBlockingViolations(page);

      await page.goto(`${paths.admin.reviews}?tab=faqs&group=buying&q=shopee&faq=new`);
      const newForm = page.getByRole("form", { name: "New question" });
      await expect(newForm).toBeVisible({ timeout: 15_000 });
      await newForm.getByLabel("FIND A REVIEW TO QUOTE").fill("glossy");
      await expect(newForm.getByRole("list", { name: "Matching reviews" })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Move up/ }).first()).toBeDisabled();
      await expectNoBlockingViolations(page);
    });

    test("no serious or critical accessibility violations on Exam pages: each editor, a field message and a hidden section", async ({
      page,
    }) => {
      await signInAs(page, "editor", `${paths.admin.examPages}?exam=ce&section=seo`);
      const editor = page.getByRole("complementary", { name: "Exam page editor" });
      await expect(editor.getByLabel("PAGE TITLE")).toBeVisible({ timeout: 15_000 });
      await editor.getByLabel("PAGE TITLE").fill("T".repeat(50));
      await editor.getByRole("button", { name: "Save" }).click();
      await expect(editor.getByText("KEEP THE WHOLE TITLE TO 60 CHARACTERS")).toBeVisible({
        timeout: 15_000,
      });
      await expectNoBlockingViolations(page);

      for (const [section, label] of [
        ["subjects", "EDIT · SUBJECTS COVERED"],
        ["reviewers", "EDIT · REVIEWERS"],
        ["bundle", "EDIT · BUNDLE OFFER"],
        ["date", "OFFICIAL EXAM DATE"],
      ]) {
        await page.goto(`${paths.admin.examPages}?exam=me&section=${section}`);
        await expect(
          editor.getByRole("heading", { level: 2, name: new RegExp(`^${label}`) }),
        ).toBeVisible({ timeout: 15_000 });
        await expectNoBlockingViolations(page);
      }

      await page.goto(`${paths.admin.examPages}?exam=me&section=reviews`);
      await page.getByRole("switch", { name: "Show Reviews on the ME page" }).click();
      await expect(editor.getByText("HIDDEN ON SITE")).toBeVisible({ timeout: 15_000 });
      await expectNoBlockingViolations(page);
    });

    test("no serious or critical accessibility violations on the promo banner, its messages and the turn-off dialog, and the announcement bar", async ({
      page,
    }) => {
      await signInAs(page, "editor", `${paths.admin.examPages}?page=promo`);
      const editor = page.getByRole("complementary", { name: "Page editor" });
      const banner = editor.getByRole("form", { name: "Home promo banner" });
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await banner.getByLabel("BANNER TEXT").fill("a".repeat(81));
      await banner.getByLabel("ENDS ON").fill("2026-11-01");
      await banner.getByRole("button", { name: "Save" }).click();
      await expect(banner.getByText("KEEP IT TO 80 CHARACTERS")).toBeVisible({ timeout: 15_000 });
      await expectNoBlockingViolations(page);

      // A banner on Home now, so "Turn off banner now" asks first.
      const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await banner.getByLabel("BANNER TEXT").fill("Payday sale");
      await banner.getByLabel("STARTS ON").fill(today);
      await banner.getByLabel("ENDS ON").fill(today);
      await banner.getByRole("button", { name: "Save" }).click();
      await expect(editor.getByRole("status")).toHaveText("✓ SAVED · LIVE ON HOME", {
        timeout: 15_000,
      });
      await editor.getByRole("switch", { name: "Show banner" }).click();
      await editor.getByRole("button", { name: "Turn off banner now" }).click({ timeout: 15_000 });
      await settled(page.getByRole("dialog"));
      await expectNoBlockingViolations(page);

      await page.goto(`${paths.admin.examPages}?page=announcement`);
      await editor.getByRole("group", { name: "MESSAGE 1" }).getByLabel("TEXT").fill("");
      await editor.getByRole("button", { name: "Save" }).click();
      await expect(editor.getByText("ADD THE MESSAGE")).toBeVisible({ timeout: 15_000 });
      await expectNoBlockingViolations(page);
    });

    for (const screen of KEYBOARD_SCREENS) {
      test(`the keyboard alone reaches every control on ${screen.name}, with a visible focus ring`, async ({
        page,
      }) => {
        await signInAs(page, screen.who, screen.path);
        await expect(screen.ready(page)).toBeVisible({ timeout: 15_000 });
        await expectKeyboardReachesEveryControl(page);

        if (screen.dialog) {
          await screen.dialog.open(page);
          const dialog = page.getByRole("dialog", { name: screen.dialog.name });
          await settled(dialog);
          await expectKeyboardReachesEveryControl(page, dialog);
        }
      });
    }
  });
}

test.describe("on a phone, with the drawer", () => {
  test.use({ viewport: SIZES[1].viewport });

  test("no serious or critical accessibility violations with the drawer open", async ({ page }) => {
    await signInAs(page, "owner");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await settled(page.getByRole("dialog", { name: "Menu" }));
    await expectNoBlockingViolations(page);
  });

  test("the keyboard alone reaches every control in the open drawer, with a visible focus ring", async ({
    page,
  }) => {
    await signInAs(page, "editor");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await settled(drawer);
    await expectKeyboardReachesEveryControl(page, drawer);
  });
});
