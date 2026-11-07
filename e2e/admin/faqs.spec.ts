import { expect as baseExpect, type Page, test } from "@playwright/test";

import { paths } from "../../src/paths";
import { resetSampleData, signInAs } from "./helpers";

// The FAQS tab on sample data (ticket 08): an Editor adds an FAQ to Buying
// with a quote from a real Review and sees it on /faq with its credit, in the
// FAQPage data and at its deep link; makes one popular; hides one; reorders a
// group; moves one to another group; and deletes one.

// Sign-in redirects and first visits wait for a dev server compiling routes.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAVED = "✓ SAVED · LIVE ON THE FAQ PAGE";
const QUESTION = "Can I pay by GCash?";
/** 120 characters. */
const ANSWER =
  "Not on this site. Every store we sell on takes GCash at checkout, so you pay as you would for any other order there too.";
/** Word for word from rev-014, on the posters. */
const QUOTE = "Malalaki printing ng formulas kaya mababasa mo mga 6ft away hahaha.";
const CREDIT = "★★★★★ · Ultimate CE Posters 2.0";

const editor = (page: Page) => page.getByRole("complementary", { name: "FAQ editor" });
const saveState = (page: Page) => editor(page).getByRole("status");
const questions = (page: Page) => page.getByRole("region", { name: "Questions" });
const row = (page: Page, question: string) =>
  questions(page).getByRole("listitem").filter({ hasText: question });

async function openFaqs(page: Page, search: string) {
  await signInAs(page, "editor", `${paths.admin.reviews}?tab=faqs${search}`);
  await expect(questions(page)).toBeVisible();
}

/** The deep-link slugs of a group's FAQs on /faq, in the page's order. */
async function faqPageGroup(page: Page, group: string): Promise<string[]> {
  await page.goto(paths.faq);
  const items = page.locator(`#topic-${group} [id^="faq-"]`);
  await expect(items.first()).toBeVisible();
  return items.evaluateAll((elements) => elements.map((element) => element.id.slice(4)));
}

interface FaqPageJsonLd {
  "@type": string;
  mainEntity: { name: string; acceptedAnswer: { text: string } }[];
}

/** The questions in the FAQ page's FAQPage data. */
async function jsonLdQuestions(page: Page): Promise<string[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faqPage = blocks
    .map((block) => JSON.parse(block) as FaqPageJsonLd)
    .find((block) => block["@type"] === "FAQPage");
  if (!faqPage) throw new Error("the page has no FAQPage JSON-LD");
  return faqPage.mainEntity.map((question) => question.name);
}

test.beforeEach(async ({ request }) => {
  await resetSampleData(request);
});

// Leave the shared dev server on the seed for whatever runs next.
test.afterAll(async ({ request }) => {
  await resetSampleData(request);
});

test("adds an FAQ to Buying with a Review quote: last in Buying on /faq, credited, in the FAQPage data, at its deep link", async ({
  page,
}) => {
  expect(ANSWER).toHaveLength(120);
  await openFaqs(page, "&group=buying");
  await expect(questions(page).getByText("BUYING · 6 QUESTIONS · ▲▼ TO REORDER")).toBeVisible();
  await questions(page).getByRole("link", { name: "+ Add question to Buying" }).click();

  const form = editor(page).getByRole("form", { name: "New question" });
  await expect(form.getByText("NEW QUESTION · BUYING")).toBeVisible();
  await form.getByLabel("QUESTION", { exact: true }).fill(QUESTION);
  await form.getByLabel("ANSWER", { exact: true }).fill(ANSWER);
  await expect(form.getByText("120 / 400 CHARACTERS")).toBeVisible();
  await expect(
    form.getByText("DEEP LINK · aceyourcourse.ph/faq#faq-can-i-pay-by-gcash"),
  ).toBeVisible();
  await form.getByLabel("FIND A REVIEW TO QUOTE").fill("glossy");
  await form.getByRole("button", { name: /^Quote this review: “Glossy type yung paper/ }).click();
  await form.getByLabel("QUOTE FROM A REAL REVIEW").fill(QUOTE);
  await expect(form.getByText(CREDIT)).toBeVisible();
  await form.getByRole("button", { name: "Add question" }).click();

  await expect(page).toHaveURL(/\/admin\/reviews\?tab=faqs&group=buying&faq=faq-019$/);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(row(page, QUESTION)).toContainText("WITH REVIEW QUOTE");
  await expect(
    page.getByRole("navigation", { name: "FAQ groups" }).getByRole("link", { name: /^Buying/ }),
  ).toHaveText("Buying7 questions");

  // The app-only Buying FAQs stay off the page while the Member App is off.
  expect(await faqPageGroup(page, "buying")).toEqual([
    "where-to-buy",
    "discounts",
    "installments",
    "can-i-pay-by-gcash",
  ]);
  expect(await jsonLdQuestions(page)).toContain(QUESTION);
  await expect(page.getByText("FAQ · 16 answers")).toBeVisible();

  // A Visitor arrives at the deep link on a fresh load. Only changing the hash
  // of the /faq already open could beat its hydration, and Next then restores
  // the URL it loaded with, dropping the hash.
  await page.goto("about:blank");
  await page.goto(`${paths.faq}#faq-can-i-pay-by-gcash`);
  const added = page.locator("#faq-can-i-pay-by-gcash");
  await expect(added.getByRole("button", { name: QUESTION })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(added).toContainText(ANSWER);
  await expect(added.getByRole("blockquote")).toHaveText(`“${QUOTE}”`);
  await expect(added.getByRole("figure")).toContainText(CREDIT);
});

test("a quote with one character changed is refused, and the form keeps it", async ({ page }) => {
  await openFaqs(page, "&group=paper&faq=faq-005");
  const form = editor(page).getByRole("form", { name: "Edit question" });
  const quote = form.getByLabel("QUOTE FROM A REAL REVIEW");
  await quote.fill("Glossy type yung paper, makapal siya.");
  await form.getByRole("button", { name: "Save question" }).click();

  await expect(saveState(page)).toHaveText("FIX THE FIELDS MARKED IN RED");
  await expect(form.getByText("This text isn’t in the Review word for word.")).toBeVisible();
  await expect(quote).toHaveValue("Glossy type yung paper, makapal siya.");
});

test("Popular question with a chip label adds that chip to /faq", async ({ page }) => {
  await openFaqs(page, "&group=shipping&faq=faq-002");
  const form = editor(page).getByRole("form", { name: "Edit question" });
  await form.getByRole("switch", { name: "Popular question" }).click();
  await form.getByLabel("CHIP LABEL").fill("Shipping time?");
  await form.getByRole("button", { name: "Save question" }).click();
  await expect(saveState(page)).toHaveText(SAVED);

  await page.goto(paths.faq);
  const chips = page.getByRole("group", { name: "Popular" }).getByRole("button");
  await expect(chips).toHaveText([
    "Where do orders ship from?",
    "Shipping time?",
    "How do I know I’m buying the original?",
  ]);
  await chips.filter({ hasText: "Shipping time?" }).click();
  await expect(page.locator("#faq-nationwide").getByRole("button")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("Show on FAQ page off hides the FAQ from /faq and its FAQPage data, and marks the row HIDDEN", async ({
  page,
}) => {
  await openFaqs(page, "&group=shipping&faq=faq-003");
  const form = editor(page).getByRole("form", { name: "Edit question" });
  await form.getByRole("switch", { name: "Show on FAQ page" }).click();
  await form.getByRole("button", { name: "Save question" }).click();

  await expect(saveState(page)).toHaveText(SAVED);
  await expect(row(page, "How do I track my order?")).toContainText("ANSWER ONLY · HIDDEN");

  expect(await faqPageGroup(page, "shipping")).toEqual(["ship", "nationwide"]);
  await expect(page.locator("#faq-tracking")).toHaveCount(0);
  expect(await jsonLdQuestions(page)).not.toContain("How do I track my order?");
});

test("▼ on the first Shipping question swaps it with the second on /faq", async ({ page }) => {
  await openFaqs(page, "&group=shipping");
  await expect(
    questions(page).getByRole("button", { name: "Move up: “Where do orders ship from?”" }),
  ).toBeDisabled();
  await expect(
    questions(page).getByRole("button", { name: "Move down: “How do I track my order?”" }),
  ).toBeDisabled();

  await questions(page)
    .getByRole("button", { name: "Move down: “Where do orders ship from?”" })
    .click();
  await expect(questions(page).getByRole("listitem").first()).toContainText(
    "Do you deliver nationwide?",
  );

  expect(await faqPageGroup(page, "shipping")).toEqual(["nationwide", "ship", "tracking"]);
});

test("while searching, every group's matches show with ▲▼ disabled", async ({ page }) => {
  await openFaqs(page, "&group=shipping");
  await questions(page)
    .getByRole("searchbox", { name: "Search questions in all groups" })
    .fill("notebook");

  await expect(questions(page).getByText("2 MATCHES IN ALL GROUPS")).toBeVisible();
  await expect(questions(page).getByRole("listitem")).toHaveCount(2);
  for (const button of await questions(page).getByRole("button", { name: /^Move/ }).all()) {
    await expect(button).toBeDisabled();
  }
});

test("moving an FAQ from Paper to Coverage puts it last there, and Paper closes the gap", async ({
  page,
}) => {
  await openFaqs(page, "&group=paper&faq=faq-004");
  const form = editor(page).getByRole("form", { name: "Edit question" });
  await form.getByLabel("GROUP", { exact: true }).selectOption({ label: "What’s covered" });
  await form.getByRole("button", { name: "Save question" }).click();

  await expect(page).toHaveURL(/group=coverage&faq=faq-004$/);
  await expect(saveState(page)).toHaveText(SAVED);
  await expect(questions(page).getByRole("listitem").last()).toContainText(
    "How thick are the flash cards?",
  );

  expect(await faqPageGroup(page, "coverage")).toEqual([
    "coverage",
    "one-subject",
    "on-its-own",
    "my-exam",
    "flash-cards",
  ]);
  expect(await faqPageGroup(page, "paper")).toEqual(["posters", "notebook"]);

  // Paper is 1, 2 again: ▲ on its new first question is the only one disabled.
  await page.goto(`${paths.admin.reviews}?tab=faqs&group=paper`);
  await expect(
    questions(page).getByRole("button", { name: "Move up: “What are the posters like?”" }),
  ).toBeDisabled();
  await questions(page)
    .getByRole("button", { name: "Move down: “What are the posters like?”" })
    .click();
  // The list shows the new order once the move has saved.
  await expect(questions(page).getByRole("listitem").first()).toContainText(
    "What size is the notebook?",
  );
  expect(await faqPageGroup(page, "paper")).toEqual(["notebook", "posters"]);
});

test("deletes an FAQ after the plain confirmation, and it's off /faq", async ({ page }) => {
  await openFaqs(page, "&group=shipping&faq=faq-002");
  await editor(page).getByRole("button", { name: "Delete" }).click();

  const dialog = page.getByRole("dialog", { name: "Delete “Do you deliver nationwide?”?" });
  await expect(dialog).toContainText("To keep it for later, turn off “Show on FAQ page” instead.");
  await dialog.getByRole("button", { name: "Delete question" }).click();

  await expect(page.getByText("✓ DELETED · THE QUESTION IS OFF THE FAQ PAGE")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/reviews\?tab=faqs&group=shipping$/);
  await expect(questions(page).getByText("SHIPPING · 2 QUESTIONS · ▲▼ TO REORDER")).toBeVisible();

  expect(await faqPageGroup(page, "shipping")).toEqual(["ship", "tracking"]);
  expect(await jsonLdQuestions(page)).not.toContain("Do you deliver nationwide?");
});
