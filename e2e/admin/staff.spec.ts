import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, sampleEmail, signInAs, signInWithEmail } from "./helpers";

// Admin accounts on sample data (ticket 03): an Owner invites by Google email,
// copies the invite message, renews and cancels Invites, changes a Staff
// Role and removes Staff. The staff list is read on every request, so each
// change applies to the other person's next click.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const NEW_EDITOR = "new.editor@example.com";
const EDITOR = sampleEmail("editor");
const KIM = sampleEmail("invited");
const EXPIRED = sampleEmail("expired");

const DAY = 24 * 60 * 60 * 1000;
const EXPIRY_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** The Manila day an Invite made at `madeAt` expires, as the message writes it: "Sat, 8 Nov 2026". */
function expiryDay(madeAt: number) {
  const part = Object.fromEntries(
    EXPIRY_DAY.formatToParts(new Date(madeAt + 7 * DAY)).map((p) => [p.type, p.value]),
  );
  return `${part.weekday}, ${part.day} ${part.month} ${part.year}`;
}

const accounts = (page: Page) => page.getByRole("region", { name: "ADMIN ACCOUNTS" });
const accountsStatus = (page: Page) => accounts(page).getByRole("status");
const row = (page: Page, email: string) =>
  accounts(page)
    .getByRole("list", { name: "Admin accounts" })
    .getByRole("listitem")
    .filter({ hasText: email });

async function openSettings(page: Page) {
  await signInAs(page, "owner", paths.admin.settings);
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(accounts(page)).toBeVisible();
}

/** A second person, in their own browser context, signed in with `email`. */
async function signedInElsewhere(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await signInWithEmail(page, email);
  return page;
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("with the clipboard allowed", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("an Owner invites an Editor and copies the message; signing in with that email activates the Invite", async ({
    page,
    browser,
  }) => {
    await openSettings(page);
    await accounts(page).getByRole("button", { name: "+ Authorise an account" }).click();
    const modal = page.getByRole("dialog", { name: "Give someone admin access" });
    await modal.getByLabel("GOOGLE ACCOUNT EMAIL").fill(NEW_EDITOR);
    await expect(modal.getByRole("radio", { name: /^Editor/ })).toBeChecked();
    await expect(modal).not.toContainText("They get an email");
    const before = Date.now();
    await modal.getByRole("button", { name: "Add invite" }).click();

    const invited = page.getByRole("dialog", { name: "Now send them the invite" });
    await expect(invited).toBeVisible();
    const after = Date.now();
    const days = [...new Set([expiryDay(before), expiryDay(after)])].join("|");
    const message = await invited.getByLabel("INVITE MESSAGE").inputValue();
    expect(message).toMatch(
      new RegExp(
        `^Hi! You've been added to the Ace Your Course Admin as an Editor\\. Open http://localhost:\\d+/admin, choose “Continue with Google” and sign in as new\\.editor@example\\.com\\. Please sign in by (${days}), when the invite expires\\.$`,
      ),
    );
    await invited.getByRole("button", { name: "Copy invite message" }).click();
    await expect(invited.getByRole("status")).toHaveText(
      "✓ COPIED · PASTE IT INTO AN EMAIL OR CHAT",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(message);
    await invited.getByRole("button", { name: "Done" }).click();

    await expect(row(page, NEW_EDITOR)).toContainText("INVITED");
    await expect(row(page, NEW_EDITOR)).toContainText("EXPIRES IN 7 DAYS · RENEW");

    // The new Editor signs in for the first time, in their own browser.
    const newEditor = await signedInElsewhere(browser, NEW_EDITOR);
    await expect(newEditor).toHaveURL(/\/admin$/);
    await expect(newEditor.getByRole("heading", { level: 1 })).toHaveText("Overview");
    await newEditor.context().close();

    await page.reload();
    await expect(row(page, NEW_EDITOR)).toContainText("EDITOR");
    await expect(row(page, NEW_EDITOR)).toContainText("LAST SIGNED IN TODAY");
    await expect(row(page, NEW_EDITOR)).not.toContainText("INVITED");
  });

  test("Copy invite message on an Invite's row copies its message", async ({ page }) => {
    await openSettings(page);
    await row(page, KIM)
      .getByRole("button", { name: /^Copy invite message/ })
      .click();
    await expect(accountsStatus(page)).toHaveText(
      "✓ INVITE MESSAGE COPIED · SEND IT TO KIM.REYES@GMAIL.COM",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      `sign in as ${KIM}.`,
    );
  });
});

test("when the clipboard is refused, the message is shown selected, to copy by hand", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  await openSettings(page);
  await row(page, KIM)
    .getByRole("button", { name: /^Copy invite message/ })
    .click();

  const dialog = page.getByRole("dialog", { name: "Copy the invite message" });
  await expect(dialog.getByText("Couldn’t copy it for you. Copy it from here.")).toBeVisible();
  const field = dialog.getByLabel("INVITE MESSAGE");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(/^Hi! You've been added .* sign in as kim\.reyes@gmail\.com\./);
  expect(
    await field.evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    ),
  ).toBe(await field.inputValue());
});

test("the invite form refuses a bad email, and an email already on the staff list", async ({
  page,
}) => {
  await openSettings(page);
  await accounts(page).getByRole("button", { name: "+ Authorise an account" }).click();
  const modal = page.getByRole("dialog", { name: "Give someone admin access" });
  const email = modal.getByLabel("GOOGLE ACCOUNT EMAIL");

  await email.fill("bad");
  await modal.getByRole("button", { name: "Add invite" }).click();
  await expect(email).toHaveAccessibleDescription(
    "Enter a valid email address, like name@example.com.",
  );

  await email.fill("KIM.REYES@gmail.com");
  await modal.getByRole("button", { name: "Add invite" }).click();
  await expect(email).toHaveAccessibleDescription("This email is already on the staff list.");

  await email.fill(sampleEmail("owner"));
  await modal.getByRole("button", { name: "Add invite" }).click();
  await expect(email).toHaveAccessibleDescription("This email is already on the staff list.");

  await modal.getByRole("button", { name: "Cancel" }).click();
  await expect(row(page, "Invited")).toHaveCount(2);
});

test("the Owner's own row can't be removed or changed", async ({ page }) => {
  await openSettings(page);
  const you = row(page, sampleEmail("owner"));
  await expect(you).toContainText("YOU · CAN’T BE REMOVED");
  await expect(you.getByRole("button")).toHaveCount(0);
});

test("Renew restarts an expired Invite's 7 days, and its email can then sign in", async ({
  page,
  browser,
}) => {
  await openSettings(page);
  await expect(row(page, EXPIRED)).toContainText("EXPIRED · RENEW");

  await row(page, EXPIRED)
    .getByRole("button", { name: /^RENEW/ })
    .click();
  await expect(row(page, EXPIRED)).toContainText("EXPIRES IN 7 DAYS · RENEW");
  await expect(accountsStatus(page)).toHaveText(
    "✓ RENEWED · EXPIRED.INVITE@EXAMPLE.COM HAS 7 DAYS TO SIGN IN",
  );

  const invited = await signedInElsewhere(browser, EXPIRED);
  await expect(invited).toHaveURL(/\/admin$/);
  await invited.context().close();
});

test("Cancel invite asks first, then its email signs in to the not-staff 403 screen", async ({
  page,
  browser,
}) => {
  await openSettings(page);
  await row(page, KIM)
    .getByRole("button", { name: /^Cancel invite/ })
    .click();
  const dialog = page.getByRole("dialog", { name: `Cancel the invite to ${KIM}?` });
  await expect(dialog).toContainText("They can’t use it to sign in.");
  await dialog.getByRole("button", { name: "Cancel invite" }).click();
  await expect(row(page, KIM)).toHaveCount(0);

  const kim = await signedInElsewhere(browser, KIM);
  await expect(kim).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
  await expect(kim.getByRole("main")).toContainText("which isn’t on the admin list");
  await kim.context().close();
});

test("renewing an Invite someone else already cancelled says so, and the list catches up", async ({
  browser,
}) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  await openSettings(first);
  await openSettings(second);

  await row(first, KIM)
    .getByRole("button", { name: /^Cancel invite/ })
    .click();
  await first.getByRole("dialog").getByRole("button", { name: "Cancel invite" }).click();
  await expect(row(first, KIM)).toHaveCount(0);

  await row(second, KIM)
    .getByRole("button", { name: /^RENEW/ })
    .click();
  await expect(accountsStatus(second)).toHaveText(
    "That’s no longer on the staff list, so nothing was changed. The list is up to date.",
  );
  await expect(row(second, KIM)).toHaveCount(0);
  await first.context().close();
  await second.context().close();
});

test("making the Editor an Owner shows them Settings on their next request; making them an Editor hides it", async ({
  page,
  browser,
}) => {
  const editor = await signedInElsewhere(browser, EDITOR);
  await expect(editor).toHaveURL(/\/admin$/);
  const settingsLink = editor
    .getByRole("navigation", { name: "Admin" })
    .first()
    .getByRole("link", { name: "Settings" });
  await expect(settingsLink).toHaveCount(0);

  await openSettings(page);
  await row(page, EDITOR)
    .getByRole("button", { name: /Make Owner$/ })
    .click();
  await expect(row(page, EDITOR)).toContainText("OWNER");
  await expect(accountsStatus(page)).toHaveText("✓ AYC CONTENT TEAM IS NOW AN OWNER");

  await editor.reload();
  await expect(settingsLink).toHaveCount(1);
  await editor.goto(paths.admin.settings);
  await expect(editor).toHaveURL(/\/admin\/settings$/);

  await row(page, EDITOR)
    .getByRole("button", { name: /Make Editor$/ })
    .click();
  await expect(row(page, EDITOR)).toContainText("EDITOR");

  await editor.goto(paths.admin.overview);
  await expect(settingsLink).toHaveCount(0);
  await editor.goto(paths.admin.settings);
  await expect(editor).toHaveURL(/\/admin\/denied\?reason=owners-only$/);
  await editor.context().close();
});

test("removing the Editor while they're signed in elsewhere denies their next request", async ({
  page,
  browser,
}) => {
  const editor = await signedInElsewhere(browser, EDITOR);
  await expect(editor).toHaveURL(/\/admin$/);

  await openSettings(page);
  await row(page, EDITOR)
    .getByRole("button", { name: /^Remove/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "Remove AYC Content Team as an admin?" });
  await expect(dialog).toContainText(`${EDITOR} loses access right away. Their edits stay.`);
  await expect(dialog).not.toContainText("signed out");
  await dialog.getByRole("button", { name: "Remove access" }).click();
  await expect(row(page, EDITOR)).toHaveCount(0);

  // Their next click, without signing in again.
  await editor
    .getByRole("navigation", { name: "Admin" })
    .first()
    .getByRole("link", { name: /Products/ })
    .click();
  await expect(editor).toHaveURL(/\/admin\/denied\?reason=not-staff$/);
  await expect(editor.getByRole("main")).toContainText(EDITOR);
  await editor.context().close();
});
