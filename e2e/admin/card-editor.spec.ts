import path from "node:path";

import { type Browser, expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { signInAndOnboard } from "../member-app/helpers";
import { resetSampleData, signInAs } from "./helpers";

// The card editor (Phase 3, ticket 07; stories 125, 127, 128), on the sample
// data: an Editor writes cards with maths in a Topic's deck, with the live
// preview and "Save & add next", reorders them, and makes the deck Visible
// and Free Preview; a Member with no Access Pass then finds it open in the
// Library. The sample CE MSTC Topics are Simple Curves (a Visible, Free
// Preview deck with no cards yet), Spiral Curves, Surveying (no deck) and
// Algebra (a Hidden deck with no cards).

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const form = (page: Page) => page.getByRole("region", { name: "Card form" });
const cardList = (page: Page, topic: string) =>
  page.getByRole("list", { name: `Cards in ${topic}` }).getByRole("link");
const deckState = (page: Page) => page.getByRole("region", { name: /flashcards$/ });

/** Opens a CE MSTC Topic's deck from its Topics list, as an Editor. */
async function openDeck(page: Page, topic: string) {
  await signInAs(page, "editor", paths.admin.contentTopics("CE", "MSTC"));
  await page.getByRole("link", { name: `Flashcards in ${topic}` }).click();
  await expect(page).toHaveURL(/\/admin\/content\/deck\?topic=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 2, name: `${topic} flashcards` })).toBeVisible();
}

/** Writes a card in the form; the save is the caller's. */
async function writeCard(page: Page, front: string, back: string) {
  await form(page)
    .getByLabel(/^FRONT/)
    .fill(front);
  await form(page).getByLabel(/^BACK/).fill(back);
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

test.describe("an Editor", () => {
  test("writes cards with maths, reorders them, and makes the deck Visible and Free Preview", async ({
    page,
  }) => {
    await openDeck(page, "Algebra");
    const state = deckState(page);
    await expect(state).toContainText("CE · MSTC · 0 CARDS · HIDDEN");
    await expect(state.getByRole("switch", { name: "Visible to members" })).toBeDisabled();
    await expect(state).toContainText("ADD A CARD FIRST");

    // The first card, with maths, saved with "Save & add next".
    await writeCard(page, "Degree of curve", "$D = \\frac{1145.916}{R}$");
    const back = form(page).getByRole("figure", { name: "Card back" });
    await expect(back.locator(".katex")).toBeVisible();
    await form(page).getByRole("button", { name: "Save & add next" }).click();
    await expect(form(page).getByRole("status")).toHaveText(
      "✓ SAVED CARD 1 · WRITING THE NEXT ONE",
    );
    await expect(form(page).getByLabel(/^FRONT/)).toHaveValue("");
    await expect(cardList(page, "Algebra")).toHaveText(["Degree of curve"]);

    // The second, with a back image, saved with "Save".
    await writeCard(page, "Tangent distance", "$T = R \\tan(I/2)$");
    await form(page).getByLabel("Add an image").setInputFiles(fixture("product-photo.png"));
    await expect(back.getByRole("img", { name: "Image on the back of the card" })).toHaveAttribute(
      "src",
      /^blob:/,
    );
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/&card=[0-9a-f-]{36}$/);
    await expect(cardList(page, "Algebra")).toHaveText(["Degree of curve", "Tangent distance"]);
    // The saved image now comes from the Admin's Staff-only route.
    await expect(back.getByRole("img", { name: "Image on the back of the card" })).toHaveAttribute(
      "src",
      /^\/admin\/content\/deck\/image\/[0-9a-f-]{36}$/,
    );

    // A formula that won't render shows in the preview and isn't saved.
    await page.getByRole("link", { name: "+ Add card" }).click();
    await expect(form(page).getByRole("form", { name: "New card" })).toBeVisible();
    await writeCard(page, "Broken", "$\\frac{1}{$");
    await expect(form(page)).toContainText("The back has a formula that won’t render");
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(form(page).getByLabel(/^BACK/)).toHaveAttribute("aria-invalid", "true");
    await expect(cardList(page, "Algebra")).toHaveCount(2);

    // Reorder.
    await page.getByRole("button", { name: "Move up: card 2" }).click();
    await expect(cardList(page, "Algebra")).toHaveText(["Tangent distance", "Degree of curve"]);

    // Visible, then Free Preview.
    await state.getByRole("switch", { name: "Visible to members" }).click();
    await expect(state).toContainText("CE · MSTC · 2 CARDS · VISIBLE");
    await state.getByRole("switch", { name: "Free Preview" }).click();
    await expect(state).toContainText("CE · MSTC · 2 CARDS · VISIBLE · FREE PREVIEW");
  });

  test("deletes the last card of a Visible deck, which hides the deck and says so", async ({
    page,
  }) => {
    await openDeck(page, "Simple Curves");
    await writeCard(page, "Only card", "$x^2$");
    await form(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(cardList(page, "Simple Curves")).toHaveText(["Only card"]);

    await page.getByRole("button", { name: "Delete card 1" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Members who marked it lose that mark.");
    await dialog.getByRole("button", { name: "Delete card" }).click();

    await expect(
      deckState(page).getByText("The deck is now Hidden because it has no cards."),
    ).toBeVisible();
    await expect(deckState(page)).toContainText("CE · MSTC · 0 CARDS · HIDDEN");
  });
});

/** An Owner adds an email to the Beta Tester list in the Admin, in their own browser context. */
async function ownerAddsTester(browser: Browser, email: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInAs(page, "owner", paths.admin.betaTesters);
    const testers = page.getByRole("region", { name: "BETA TESTERS" });
    await testers.getByLabel("GOOGLE ACCOUNT EMAIL").fill(email);
    await testers.getByRole("button", { name: "Add Beta Tester" }).click();
    await expect(testers.getByRole("status")).toHaveText(/ADDED/);
  } finally {
    await context.close();
  }
}

test.describe("the Member App", () => {
  test("opens a deck made Visible and Free Preview for a Member with no Access Pass", async ({
    page,
    browser,
  }) => {
    const context = await browser.newContext();
    try {
      const admin = await context.newPage();
      await openDeck(admin, "Algebra");
      await writeCard(admin, "Quadratic formula", "$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$");
      await form(admin).getByRole("button", { name: "Save", exact: true }).click();
      await expect(cardList(admin, "Algebra")).toHaveText(["Quadratic formula"]);
      const state = deckState(admin);
      await state.getByRole("switch", { name: "Visible to members" }).click();
      await expect(state).toContainText("VISIBLE");
      await state.getByRole("switch", { name: "Free Preview" }).click();
      await expect(state).toContainText("FREE PREVIEW");
    } finally {
      await context.close();
    }

    await ownerAddsTester(browser, "stranger@example.com");
    await signInAndOnboard(page, "stranger", "CE");
    await page
      .getByRole("complementary")
      .getByRole("navigation", { name: "Member App" })
      .getByRole("link", { name: /Library/ })
      .click();
    const algebra = page
      .getByRole("list", { name: "MSTC Topics" })
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 3, name: /Algebra$/ }) });
    await expect(algebra.getByRole("link", { name: /^Flashcards/ })).toHaveText(
      "Flashcards · FREE PREVIEW",
    );
    await algebra.getByRole("link", { name: /^Flashcards/ }).click();
    // The flashcard player (ticket 08) opens on the card.
    await expect(page.getByRole("figure", { name: "Card front" })).toContainText(
      "Quadratic formula",
    );
  });
});
