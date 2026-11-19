import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs as signInToAdmin } from "../admin/helpers";
import { expectNoBlockingViolations, LIVE, signInAndOnboard, SKIP_LIVE } from "./helpers";

// Studying flashcards on sample data (Phase 3, ticket 08; stories 95–97, 104
// and 106): the lapsed tester, whose CE pass ended, studies a Free Preview
// deck with the keyboard and a swipe, drills their misses with "Review the
// N", and picks up where they left off; a new tester with no pass finds a
// locked deck's unlock prompt and none of its cards. The sample decks start
// with no cards, so an Editor writes them first in the Admin's card editor.
// The sample CE MSTC decks: Simple Curves' is Visible and Free Preview,
// Spiral Curves' Visible.

const expect = baseExpect.configure({ timeout: 15_000 });

const CARDS = [
  { front: "Degree of curve", back: "$D = \\dfrac{1145.916}{R}$" },
  { front: "Tangent distance", back: "$T = R \\tan\\dfrac{I}{2}$" },
  { front: "Long chord", back: "$C = 2R \\sin\\dfrac{I}{2}$" },
];

const memberNav = (page: Page) =>
  page.getByRole("complementary").getByRole("navigation", { name: "Member App" });
const topicRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "MSTC Topics" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`${name}$`) }) });
const front = (page: Page) => page.getByRole("figure", { name: "Card front" });
const summary = (page: Page) => page.getByRole("heading", { level: 2 });

/** An Editor writes cards in a CE MSTC Topic's deck, in the Admin, in their own browser context. */
async function editorWritesCards(browser: Browser, topic: string, cards: typeof CARDS) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
    await page.getByRole("link", { name: `Flashcards in ${topic}` }).click();
    const form = page.getByRole("region", { name: "Card form" });
    for (const [index, card] of cards.entries()) {
      await form.getByLabel(/^FRONT/).fill(card.front);
      await form.getByLabel(/^BACK/).fill(card.back);
      await form.getByRole("button", { name: "Save & add next" }).click();
      await expect(form.getByRole("status")).toHaveText(
        `✓ SAVED CARD ${index + 1} · WRITING THE NEXT ONE`,
      );
    }
  } finally {
    await context.close();
  }
}

/** An Owner adds an email to the Beta Tester list in the Admin, in their own browser context. */
async function ownerAddsTester(browser: Browser, email: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInToAdmin(page, "owner", paths.admin.betaTesters);
    const testers = page.getByRole("region", { name: "BETA TESTERS" });
    await testers.getByLabel("GOOGLE ACCOUNT EMAIL").fill(email);
    await testers.getByRole("button", { name: "Add Beta Tester" }).click();
    await expect(testers.getByRole("status")).toHaveText(/ADDED/);
  } finally {
    await context.close();
  }
}

/** Opens a Topic's deck from the Library's MSTC Topics. */
async function openDeck(page: Page, topic: string, link: RegExp | string = /^Flashcards/) {
  await memberNav(page)
    .getByRole("link", { name: /Library/ })
    .click();
  await topicRow(page, topic).getByRole("link", { name: link }).click();
  await expect(page).toHaveURL(/\/app\/library\/deck\/[0-9a-f-]{36}$/);
}

/** Waits for the player's save of a mark or position to reach the server. */
const saved = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && /\/app\/library\/deck\//.test(response.url()),
  );

/** Drags the card across by `dx` pixels with the mouse, as a finger would swipe it. */
async function swipe(page: Page, dx: number) {
  const box = await front(page).boundingBox();
  if (!box) throw new Error("No card to swipe");
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 8 });
  await page.mouse.up();
}

test.skip(LIVE, SKIP_LIVE);

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("a Member with no pass, on a Free Preview deck", () => {
  test("studies with the keyboard and a swipe, drills the misses, and picks up where they left off", async ({
    page,
    browser,
  }) => {
    await editorWritesCards(browser, "Simple Curves", CARDS);
    await signInAndOnboard(page, "lapsed", "CE");
    await openDeck(page, "Simple Curves", "Flashcards · FREE PREVIEW");

    await expect(page.getByRole("heading", { level: 1, name: "Simple Curves" })).toBeVisible();
    await expect(page.getByText("CARD 1 / 3")).toBeVisible();
    await expect(front(page)).toContainText("Degree of curve");
    // The watermark is a picture over the card, not text on it.
    await expect(front(page).locator("[data-watermark]")).toHaveCSS(
      "background-image",
      /data:image\/svg\+xml/,
    );
    await expectNoBlockingViolations(page);

    // Space flips to the back, with the formula rendered.
    await page.keyboard.press("Space");
    await expect(page.getByRole("figure", { name: "Card back" }).locator(".katex")).toBeVisible();

    // → Got it, a swipe left for Review again, → Got it: the summary.
    await page.keyboard.press("ArrowRight");
    await expect(front(page)).toContainText("Tangent distance");
    await swipe(page, -160);
    await expect(front(page)).toContainText("Long chord");
    const last = saved(page);
    await page.keyboard.press("ArrowRight");
    await last;
    await expect(summary(page)).toHaveText("2 of 3 got it · 1 to review again");
    await expect(page.getByRole("list", { name: "Cards to review again" })).toHaveText(
      "Tangent distance",
    );
    await expectNoBlockingViolations(page);

    // "Review the 1" drills just that card.
    await page.getByRole("button", { name: "Review the 1" }).click();
    await expect(page.getByText("REVIEW · CARD 1 / 1")).toBeVisible();
    await expect(front(page)).toContainText("Tangent distance");
    const reviewed = saved(page);
    await page.keyboard.press("ArrowRight");
    await reviewed;
    await expect(summary(page)).toHaveText("1 of 1 got it · 0 to review again");

    // Finished, the deck opens at its first card. Mark one, leave, and come back.
    await page.getByRole("link", { name: "Back to MSTC topics" }).click();
    await openDeck(page, "Simple Curves");
    await expect(front(page)).toContainText("Degree of curve");
    const moved = saved(page);
    await page.keyboard.press("ArrowLeft");
    await moved;
    await page.reload();

    await expect(
      page.getByRole("heading", { level: 2, name: "You stopped at card 2 of 3" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue at card 2" }).click();
    await expect(front(page)).toContainText("Tangent distance");
    await expect(page.getByText("CARD 2 / 3")).toBeVisible();

    // Every mark was kept: Finish deck counts them all.
    await page.getByRole("button", { name: "Finish deck →" }).click();
    await expect(summary(page)).toHaveText("2 of 3 got it · 1 to review again");
  });
});

test.describe("a new tester with no pass, on a locked deck", () => {
  test("sees the unlock prompt, and none of the deck's cards", async ({ page, browser }) => {
    await editorWritesCards(browser, "Spiral Curves", [
      { front: "A locked formula", back: "$L_s = \\dfrac{0.036 V^3}{R}$" },
    ]);
    await ownerAddsTester(browser, "stranger@example.com");
    await signInAndOnboard(page, "stranger", "CE");
    await openDeck(page, "Spiral Curves", "Flashcards, locked: unlock with CE All-Access");

    await expect(
      page.getByRole("heading", { level: 2, name: "Unlock with CE All-Access" }),
    ).toBeVisible();
    await expect(page.getByText(/During the beta, access comes from AYC/)).toBeVisible();
    expect(await page.content()).not.toContain("A locked formula");
    await expectNoBlockingViolations(page);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the deck is a focus screen: a back bar, and no Menu button", async ({ page, browser }) => {
    await editorWritesCards(browser, "Simple Curves", CARDS.slice(0, 1));
    await signInAndOnboard(page, "lapsed", "CE");
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByRole("dialog", { name: "Menu" })
      .getByRole("link", { name: /Library/ })
      .click();
    await topicRow(page, "Simple Curves")
      .getByRole("link", { name: /^Flashcards/ })
      .click();

    const backBar = page.getByRole("navigation", { name: "Back" });
    await expect(backBar.getByRole("link", { name: "Back to MSTC topics" })).toBeVisible();
    await expect(backBar).toContainText("MSTC · FLASHCARDS");
    await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
    await expect(front(page)).toContainText("Degree of curve");
    await expectNoBlockingViolations(page);
  });
});
