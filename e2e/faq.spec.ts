import { expect, type Page, test } from "@playwright/test";

// The FAQ page on a real browser, with the Member App switch off (the launch
// default). Expected copy is the FAQ seed in src/services/mock/catalogue.ts;
// the switch-on page is covered by src/app/(website)/faq/page.test.tsx.

const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";
const EMAIL = "aceyourcourseinc@gmail.com";
const VISIBLE_FAQS = 15;

/** An FAQ's accordion item, by its deep-link id (#faq-{slug}), which is under test too. */
const faq = (page: Page, slug: string) => page.locator(`#faq-${slug}`);
const faqButton = (page: Page, slug: string) => faq(page, slug).getByRole("button");
// In the page's main content, only the FAQ accordions expand.
const openFaqs = (page: Page) => page.getByRole("main").getByRole("button", { expanded: true });
const closedFaqs = (page: Page) => page.getByRole("main").getByRole("button", { expanded: false });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search the FAQ" });

/** Text as React writes it into HTML. */
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

interface FaqPageJsonLd {
  "@type": string;
  mainEntity: { "@type": string; name: string; acceptedAnswer: { text: string } }[];
}

async function faqJsonLd(page: Page): Promise<FaqPageJsonLd> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const found = blocks
    .map((block) => JSON.parse(block) as FaqPageJsonLd)
    .find((block) => block["@type"] === "FAQPage");
  if (!found) throw new Error("the page has no FAQPage JSON-LD");
  return found;
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

test.describe("the FAQ page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/faq");
  });

  test("shows the FAQs in their five groups, with the first one open", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Questions reviewees always ask",
    );
    await expect(page.getByText(`FAQ · ${VISIBLE_FAQS} answers`)).toBeVisible();
    await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
      /Shipping$/,
      /Paper and print$/,
      /What’s covered$/,
      /Buying$/,
      /Authenticity$/,
      "Still have a question?",
    ]);
    await expect(openFaqs(page)).toHaveCount(1);
    await expect(closedFaqs(page)).toHaveCount(VISIBLE_FAQS - 1);
    await expect(faqButton(page, "ship")).toHaveAttribute("aria-expanded", "true");

    const topics = page.getByRole("navigation", { name: "Topics" });
    await expect(topics.getByRole("link")).toHaveCount(5);
    await expect(topics.getByRole("link", { name: "Shipping 3 answers" })).toHaveAttribute(
      "href",
      "#topic-shipping",
    );
    await expect(topics.getByRole("link", { name: "Buying 3 answers" })).toBeVisible();

    await expect(page.getByRole("group", { name: "Popular" }).getByRole("button")).toHaveText([
      "Where do orders ship from?",
      "How do I know I’m buying the original?",
    ]);
    // The hero's email (the footer has it too).
    await expect(page.getByRole("main").getByRole("link", { name: EMAIL })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );
  });

  test("narrows the list as the Visitor types, and updates the counts", async ({ page }) => {
    await search(page).fill("Iloilo");
    await expect(openFaqs(page)).toHaveCount(2);
    await expect(closedFaqs(page)).toHaveCount(0);
    await expect(faq(page, "ship")).toBeVisible();
    await expect(faq(page, "original")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("2 answers for “ILOILO”");
    const topics = page.getByRole("navigation", { name: "Topics" });
    await expect(topics.getByRole("link")).toHaveCount(2);
    await expect(topics.getByRole("link", { name: "Authenticity 1 answer" })).toBeVisible();
  });

  test("shows the no-results state, and Clear search brings everything back", async ({ page }) => {
    await search(page).fill("zzzz");
    await expect(openFaqs(page)).toHaveCount(0);
    await expect(closedFaqs(page)).toHaveCount(0);
    await expect(page.getByText("No answers for “zzzz” yet.")).toBeVisible();
    const chat = page
      .getByRole("main")
      .getByRole("link", { name: "Chat us on Shopee (opens in a new tab)" })
      .first();
    await expect(chat).toHaveAttribute("href", SHOPEE_SHOP);
    await expect(chat).toHaveAttribute("target", "_blank");

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search(page)).toHaveValue("");
    await expect(openFaqs(page)).toHaveCount(1);
    await expect(closedFaqs(page)).toHaveCount(VISIBLE_FAQS - 1);
    await expect(page.getByText(/No answers for/)).toHaveCount(0);
  });

  test("opens and scrolls to an FAQ from its popular chip", async ({ page }) => {
    await page
      .getByRole("group", { name: "Popular" })
      .getByRole("button", { name: "How do I know I’m buying the original?" })
      .click();
    await expect(faqButton(page, "original")).toHaveAttribute("aria-expanded", "true");
    await expect(faq(page, "original")).toBeInViewport();
    await expect(faq(page, "original")).toContainText("Ships from Iloilo City, Iloilo.");
  });

  test("opens every FAQ with Expand all and closes them with Collapse all", async ({ page }) => {
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(openFaqs(page)).toHaveCount(VISIBLE_FAQS);
    await expect(closedFaqs(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(openFaqs(page)).toHaveCount(0);
    await expect(closedFaqs(page)).toHaveCount(VISIBLE_FAQS);
  });

  test("links the coverage table to every Exam page", async ({ page }) => {
    await faqButton(page, "coverage").click();
    const table = page.getByRole("list", { name: "Subjects per exam" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("link").first()).toContainText("MSTC");
    const hrefs = await table
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["/exams/ce", "/exams/me", "/exams/ee", "/exams/mt", "/exams/cpa"]);
  });

  test("offers Email us and Chat us on Shopee under Still have a question?", async ({ page }) => {
    const band = page.getByRole("region", { name: "Still have a question?" });
    await expect(band.getByRole("link", { name: "Email us" })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );
    await expect(
      band.getByRole("link", { name: "Chat us on Shopee (opens in a new tab)" }),
    ).toHaveAttribute("href", SHOPEE_SHOP);
  });

  test("has one FAQPage Question per visible FAQ, matching the page", async ({ page }) => {
    const jsonLd = await faqJsonLd(page);
    expect(jsonLd.mainEntity).toHaveLength(VISIBLE_FAQS);
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(openFaqs(page)).toHaveCount(VISIBLE_FAQS);
    const questions = await openFaqs(page).allInnerTexts();
    expect(jsonLd.mainEntity.map((q) => q.name)).toEqual(
      questions.map((text) => squash(text.replace(/\+$/, ""))),
    );

    const main = squash(await page.getByRole("main").innerText());
    for (const question of jsonLd.mainEntity) {
      expect(main).toContain(squash(question.acceptedAnswer.text));
    }
  });

  test("serves every answer and the coverage table's links in the HTML, before any click", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/faq")).text();
    for (const question of (await faqJsonLd(page)).mainEntity) {
      expect(html).toContain(escapeHtml(question.acceptedAnswer.text));
    }
    for (const code of ["ce", "me", "ee", "mt", "cpa"]) {
      expect(html).toContain(`href="/exams/${code}"`);
    }
    // In the browser, a closed answer stays hidden until it's opened.
    await expect(page.getByText("Our notebooks are A5 size.")).toBeHidden();
    await faqButton(page, "notebook").click();
    await expect(page.getByText("Our notebooks are A5 size.")).toBeVisible();
  });

  test("says nothing about the Member App while the switch is off", async ({ page }) => {
    await page.getByRole("button", { name: "Expand all" }).click();
    const text = await page.getByRole("main").innerText();
    expect(text).not.toMatch(/subscription|PayMongo|Billing page|here in the app/i);
    expect(text).not.toContain("Can I use my account on two devices?");
    expect(text).not.toContain("Does my Plan renew automatically?");
    expect(JSON.stringify(await faqJsonLd(page))).not.toMatch(
      /subscription|PayMongo|Billing page|two devices/i,
    );
    // No role query filters by href, so this one stays a CSS selector.
    await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
    await expect(search(page)).toHaveAttribute("placeholder", "Search: shipping, paper, coverage…");
  });
});

test.describe("deep links to one FAQ", () => {
  test("/faq#faq-ship loads with that FAQ open and in view", async ({ page }) => {
    await page.goto("/faq#faq-ship");
    await expect(faqButton(page, "ship")).toHaveAttribute("aria-expanded", "true");
    await expect(faq(page, "ship")).toBeInViewport();
  });

  test("a deep link further down opens that FAQ and scrolls to it", async ({ page }) => {
    await page.goto("/faq#faq-copies");
    await expect(faqButton(page, "copies")).toHaveAttribute("aria-expanded", "true");
    await expect(faq(page, "copies")).toBeInViewport();
    await expect(faq(page, "copies")).toContainText("registered with IPOPHIL");
  });

  test("an unknown FAQ loads the page normally, with the first FAQ open", async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await page.goto("/faq#faq-nope");
    await expect(faqButton(page, "ship")).toHaveAttribute("aria-expanded", "true");
    await expect(openFaqs(page)).toHaveCount(1);
    await expect(closedFaqs(page)).toHaveCount(VISIBLE_FAQS - 1);
    expect(errors).toEqual([]);
  });
});
