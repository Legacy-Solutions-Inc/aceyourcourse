import { expect as baseExpect, type Locator, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The REVIEWS tab on sample data (ticket 07): an Editor adds a Review and sees
// it on its Product page, its Exam page and /reviews; pins one on Home and
// moves it up the Home order; and deletes a Review an FAQ quotes, which takes
// the quote off the FAQ page. Every refusal keeps the form.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAVED = "✓ SAVED · LIVE ON THE SITE";
const NEW_TEXT = "Sulit! Dumating agad sa Iloilo.\nAng linaw ng formulas, pang-board talaga.";
/** rev-002, on CE Formula Flash Cards, isn't pinned on Home. */
const UNPINNED = "hiii kaka receive ko lang sa order ko";
/** rev-004, last in the seed's Home order. */
const LAST_PINNED = "Suitability: The flashcards are very useful";
/** rev-014, quoted by "What are the posters like?". */
const QUOTED = "Glossy type yung paper, makapal sya.";
const POSTERS_FAQ = "What are the posters like?";

const list = (page: Page) => page.getByRole("region", { name: "Reviews" });
const row = (page: Page, text: string) =>
  list(page).getByRole("listitem").filter({ hasText: text });
const editor = (page: Page) => page.getByRole("complementary", { name: "Review editor" });
const saveState = (page: Page) => editor(page).getByRole("status");
const homeCards = (page: Page) => page.locator("#reviews").getByRole("figure");

async function openReviews(page: Page, search = "") {
  await signInAs(page, "editor", `${paths.admin.reviews}${search}`);
  await expect(list(page)).toBeVisible();
}

/** The HOME switch of the row with this text, once it says `pinned`. */
async function pinSwitch(page: Page, text: string, pinned: boolean): Promise<Locator> {
  const toggle = row(page, text).getByRole("switch", { name: /^Pin on Home/ });
  await expect(toggle).toHaveAttribute("aria-checked", String(pinned));
  return toggle;
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("adds a Review, previewed as the Website's card, live on its Product page, Exam page and /reviews", async ({
  page,
}) => {
  await openReviews(page, "?review=new");
  const form = editor(page).getByRole("form", { name: "New review" });
  await expect(form).toBeVisible();
  await expect(form.getByText("The card preview appears once you paste the review.")).toBeVisible();

  await form.getByRole("radio", { name: "5 stars" }).check();
  await form.getByLabel("REVIEW TEXT · COPY WORD FOR WORD").fill(NEW_TEXT);
  await form.getByLabel("PRODUCT").selectOption({ label: "CE · CE Formula Flash Cards" });
  await form.getByLabel("STORE").selectOption({ label: "Lazada" });
  await form.getByLabel("HELPFUL VOTES").fill("3");
  const preview = form.getByRole("figure");
  await expect(preview).toContainText("Sulit! Dumating agad sa Iloilo.");
  await expect(preview).toContainText("CE Formula Flash Cards");
  await expect(preview).toContainText("Variation not specified");
  await expect(preview).toContainText("3 found this helpful");
  await form.getByRole("button", { name: "Add review" }).click();

  await expect(page).toHaveURL(/\/admin\/reviews\?review=rev-017$/);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(row(page, "Sulit! Dumating agad")).toContainText(
    "CE · CE FORMULA FLASH CARDS · LAZADA · 3 HELPFUL",
  );
  await expect(list(page).getByText("17 REVIEWS")).toBeVisible();

  for (const path of [
    paths.products.details("ce-formula-flash-cards"),
    paths.exams.details("CE"),
    paths.reviews,
  ]) {
    await page.goto(path);
    const card = page.getByRole("figure").filter({ hasText: "Sulit! Dumating agad sa Iloilo." });
    await expect(card, path).toBeVisible();
    // Word for word, with its line break.
    await expect(card.getByRole("blockquote"), path).toHaveText(NEW_TEXT, { useInnerText: true });
  }
});

test("refuses a Review with no text: PASTE THE REVIEW TEXT TO SAVE, adding nothing", async ({
  page,
}) => {
  await openReviews(page, "?review=new");
  await editor(page).getByRole("button", { name: "Add review" }).click();

  await expect(saveState(page)).toHaveText("PASTE THE REVIEW TEXT TO SAVE");
  await expect(page).toHaveURL(/\?review=new$/);
  await expect(list(page).getByText("16 REVIEWS")).toBeVisible();
});

test("pins a Review on Home: last on Home, then first after ▲ in Pinned on Home only", async ({
  page,
}) => {
  await openReviews(page);
  const pinLine = list(page).getByText(/OF 9 PINNED ON HOME/);
  await expect(pinLine).toHaveText("9 OF 9 PINNED ON HOME");

  // A 10th pin: the warning, and Home still shows the first 9.
  await (await pinSwitch(page, UNPINNED, false)).click();
  await pinSwitch(page, UNPINNED, true);
  await expect(pinLine).toHaveText("10 OF 9 PINNED ON HOME · HOME SHOWS THE FIRST 9");
  await expect(pinLine).toHaveClass(/\btext-destructive\b/);
  await page.goto(paths.home);
  await expect(homeCards(page)).toHaveCount(9);
  await expect(homeCards(page).filter({ hasText: UNPINNED })).toHaveCount(0);

  // Unpinning the last one makes room: the new pin is last on Home.
  await page.goto(paths.admin.reviews);
  await (await pinSwitch(page, LAST_PINNED, true)).click();
  await pinSwitch(page, LAST_PINNED, false);
  await expect(pinLine).toHaveText("9 OF 9 PINNED ON HOME");
  await page.goto(paths.home);
  await expect(homeCards(page)).toHaveCount(9);
  await expect(homeCards(page).last()).toContainText(UNPINNED);

  // ▲ until it's first: ▲ is disabled there, and Home leads with it.
  await page.goto(`${paths.admin.reviews}?pinned=1`);
  const pinned = list(page).getByRole("listitem");
  await expect(pinned).toHaveCount(9);
  await expect(pinned.last()).toContainText(UNPINNED);
  await expect(pinned.last().getByRole("button", { name: /^Move down on Home/ })).toBeDisabled();
  for (let place = 9; place > 1; place -= 1) {
    await expect(pinned.nth(place - 1)).toContainText(UNPINNED);
    await pinned
      .nth(place - 1)
      .getByRole("button", { name: /^Move up on Home/ })
      .click();
    await expect(pinned.nth(place - 2)).toContainText(UNPINNED);
  }
  await expect(pinned.first().getByRole("button", { name: /^Move up on Home/ })).toBeDisabled();
  await page.goto(paths.home);
  await expect(homeCards(page).first()).toContainText(UNPINNED);
});

test("refuses an edit that removes the words an FAQ quotes, naming the FAQ", async ({ page }) => {
  await openReviews(page, "?review=rev-014");
  const text = editor(page).getByLabel("REVIEW TEXT · COPY WORD FOR WORD");
  await text.fill("Quality 10/10.");
  await editor(page).getByRole("button", { name: "Save review" }).click();

  await expect(saveState(page)).toHaveText(
    "The FAQ “What are the posters like?” quotes this Review. Edit that quote first.",
  );
  await expect(text).toHaveValue("Quality 10/10.");
  await page.reload();
  await expect(editor(page).getByLabel("REVIEW TEXT · COPY WORD FOR WORD")).toHaveValue(
    new RegExp(`^${QUOTED}`),
  );
});

test("deletes a Review an FAQ quotes: the FAQ page shows that FAQ without the quote", async ({
  page,
}) => {
  await page.goto(paths.faq);
  const faq = page.locator(`#faq-posters`);
  await faq.getByRole("button", { name: POSTERS_FAQ }).click();
  await expect(faq.getByRole("blockquote")).toContainText(QUOTED);

  await openReviews(page, "?exam=ce&review=rev-014");
  await editor(page).getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this review?" });
  await expect(dialog).toContainText("1 FAQ quote from this Review is removed.");
  await expect(dialog).toContainText("The original stays on the store.");
  await dialog.getByRole("button", { name: "Delete review" }).click();

  await expect(page).toHaveURL(/\/admin\/reviews\?exam=ce$/);
  // Shown once: the root layout's is the only toaster.
  await expect(page.getByText("✓ DELETED · THE REVIEW IS OFF THE SITE")).toBeVisible();
  await expect(row(page, QUOTED)).toHaveCount(0);

  await page.goto(paths.faq);
  await faq.getByRole("button", { name: POSTERS_FAQ }).click();
  await expect(faq).toContainText("A3 size, printed big enough");
  await expect(faq.getByRole("blockquote")).toHaveCount(0);
  await page.goto(paths.products.details("ultimate-ce-posters-2-0"));
  await expect(page.getByRole("figure").filter({ hasText: QUOTED })).toHaveCount(0);
});

test("filters by search, Exam and stars, kept in the URL", async ({ page }) => {
  await openReviews(page);
  await list(page).getByRole("searchbox", { name: "Search review text" }).fill("glossy");
  await expect(page).toHaveURL(/\?q=glossy$/);
  // Each chip's link keeps the other filters, once the list has been read again.
  await list(page).getByRole("group", { name: "Exam" }).getByRole("link", { name: "CE" }).click();
  await expect(page).toHaveURL(/\?q=glossy&exam=ce$/);
  await expect(
    list(page).getByRole("group", { name: "Stars" }).getByRole("link", { name: "5★" }),
  ).toHaveAttribute("href", "/admin/reviews?q=glossy&exam=ce&stars=5");
  await list(page).getByRole("group", { name: "Stars" }).getByRole("link", { name: "5★" }).click();

  await expect(page).toHaveURL(/\?q=glossy&exam=ce&stars=5$/);
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
  await expect(list(page).getByText("1 REVIEW", { exact: true })).toBeVisible();
  await page.reload();
  await expect(list(page).getByRole("searchbox", { name: "Search review text" })).toHaveValue(
    "glossy",
  );
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
});
