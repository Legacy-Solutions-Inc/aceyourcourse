import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import ReviewsPage from "./page";

// Reviews & FAQs, rendered from the sample data with its tab, filters and
// selection read from the URL. The cookie jar and the router are the framework
// boundary, so they are replaced.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/reviews",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

type Params = Record<string, string | string[] | undefined>;

async function renderPage(params: Params = {}) {
  render(await ReviewsPage({ searchParams: Promise.resolve(params) }));
}

const list = () => screen.getByRole("region", { name: "Reviews" });
const rows = () => within(list()).queryAllByRole("listitem");

describe("Reviews page", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    jar.set("ayc_admin_sample", "content@aceyourcourse.ph");
  });

  it("shows the REVIEWS tab: every Review with its stars, excerpt, meta and HOME switch", async () => {
    await renderPage();

    const tabs = screen.getByRole("navigation", { name: "Reviews and FAQs" });
    expect(within(tabs).getByRole("link", { name: "REVIEWS" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: "FAQS" })).toHaveAttribute(
      "href",
      "/admin/reviews?tab=faqs",
    );
    expect(rows()).toHaveLength(16);
    expect(within(list()).getByText("16 REVIEWS")).toBeInTheDocument();
    expect(within(list()).getByText("9 OF 9 PINNED ON HOME")).not.toHaveClass("text-destructive");

    const posters = rows()[12];
    if (!posters) throw new Error("No 13th row");
    expect(within(posters).getByRole("img", { name: "5 out of 5 stars" })).toBeInTheDocument();
    expect(
      within(posters).getByText(
        "CE · ULTIMATE CE POSTERS 2.0 · MSTC, HPGE, PSAD · SHOPEE · 19 HELPFUL",
      ),
    ).toBeInTheDocument();
    expect(
      within(posters).getByRole("switch", { name: /^Pin on Home: “Perfect quality for/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText(
        "EVERY REVIEW SHOWS ON ITS PRODUCT PAGE AND EXAM PAGE · PINNED ONES ALSO SHOW ON HOME",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Add review" })).toHaveAttribute(
      "href",
      "/admin/reviews?review=new",
    );
  });

  it("shows a Review's real Marketplace in its meta line", async () => {
    const lazada = getSampleStore().catalogue.reviews.find((r) => r.id === "rev-002");
    if (lazada) lazada.marketplace = "lazada";
    await renderPage();

    expect(
      within(list()).getByText("CE · CE FORMULA FLASH CARDS · LAZADA · 5 HELPFUL"),
    ).toBeInTheDocument();
  });

  it("filters by the URL's search, Exam and stars, and marks the chips that are on", async () => {
    await renderPage({ q: "glossy", exam: "ce", stars: "5" });

    expect(rows()).toHaveLength(1);
    expect(screen.getByRole("searchbox", { name: "Search review text" })).toHaveValue("glossy");
    const exam = screen.getByRole("group", { name: "Exam" });
    expect(within(exam).getByRole("link", { name: "CE" })).toHaveAttribute("aria-current", "true");
    const stars = screen.getByRole("group", { name: "Stars" });
    expect(within(stars).getByRole("link", { name: "5★" })).toHaveAttribute("aria-current", "true");
    expect(within(stars).getByRole("link", { name: "3★ AND BELOW" })).toHaveAttribute(
      "href",
      "/admin/reviews?q=glossy&exam=ce&stars=3",
    );
    expect(screen.getByRole("link", { name: "Pinned on Home only" })).toHaveAttribute(
      "href",
      "/admin/reviews?q=glossy&exam=ce&stars=5&pinned=1",
    );
  });

  it("says when nothing matches, with Clear filters", async () => {
    await renderPage({ q: "glossy", exam: "me" });

    expect(screen.getByText("No reviews match. Clear the search or filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/admin/reviews",
    );
  });

  it("says no reviews have been added when the catalogue has none", async () => {
    const { catalogue } = getSampleStore();
    catalogue.reviews = [];
    catalogue.faqs = catalogue.faqs.map((faq) => ({ ...faq, reviewQuote: null }));
    await renderPage();

    expect(screen.getByText("No reviews added yet")).toBeInTheDocument();
    expect(screen.getByText("0 OF 9 PINNED ON HOME")).toBeInTheDocument();
  });

  it("lists the pins in the Home order with ▲▼, the first ▲ and the last ▼ disabled", async () => {
    await renderPage({ pinned: "1" });

    expect(rows()).toHaveLength(9);
    const [first, second] = rows();
    const last = rows().at(-1);
    if (!first || !second || !last) throw new Error("Missing rows");
    expect(within(first).getByRole("button", { name: /^Move up on Home/ })).toBeDisabled();
    expect(within(first).getByRole("button", { name: /^Move down on Home/ })).toBeEnabled();
    expect(within(second).getByRole("button", { name: /^Move up on Home/ })).toBeEnabled();
    expect(within(last).getByRole("button", { name: /^Move down on Home/ })).toBeDisabled();
  });

  it("disables ▲▼ while another filter is on, saying why", async () => {
    await renderPage({ pinned: "1", exam: "ce" });

    for (const button of within(list()).getAllByRole("button", {
      name: /^Move (up|down) on Home/,
    })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByText("Clear the search, Exam and stars to reorder.")).toBeInTheDocument();
  });

  it("has no ▲▼ without “Pinned on Home only”", async () => {
    await renderPage();

    expect(screen.queryByRole("button", { name: /^Move up on Home/ })).not.toBeInTheDocument();
  });

  it("warns in red above 9 pins: Home shows the first 9", async () => {
    const extra = getSampleStore().catalogue.reviews.find((r) => r.id === "rev-002");
    if (extra) extra.homePin = 10;
    await renderPage();

    expect(within(list()).getByText("10 OF 9 PINNED ON HOME · HOME SHOWS THE FIRST 9")).toHaveClass(
      "text-destructive",
    );
  });

  it("counts only the pins Home can show, leaving out a hidden Product's", async () => {
    const cards = getSampleStore().catalogue.products.find((p) => p.id === "prd-001");
    if (cards) cards.showOnWebsite = false;
    await renderPage({ pinned: "1" });

    // rev-001 and rev-004 stay in the Home order, but Home skips them.
    expect(rows()).toHaveLength(9);
    expect(within(list()).getByText("7 OF 9 PINNED ON HOME")).toBeInTheDocument();
  });

  it("opens the selected Review in the editor, even when the filters leave it out", async () => {
    await renderPage({ exam: "me", review: "rev-014" });

    const editor = screen.getByRole("form", { name: "Edit review" });
    expect(within(editor).getByLabelText("REVIEW TEXT · COPY WORD FOR WORD")).toHaveDisplayValue(
      /^Glossy type yung paper/,
    );
    expect(within(editor).getByLabelText("PRODUCT")).toHaveValue("prd-005");
    expect(within(editor).getByRole("figure")).toBeInTheDocument();
  });

  it("opens a new Review's editor at review=new", async () => {
    await renderPage({ review: "new" });
    expect(screen.getByRole("form", { name: "New review" })).toBeInTheDocument();
  });

  it("prompts to pick a Review when none, or one that's gone, is selected", async () => {
    await renderPage({ review: "rev-999" });
    expect(screen.getByText("Select a review")).toBeInTheDocument();
  });
});

describe("Reviews page: the FAQS tab", () => {
  beforeEach(() => {
    jar.clear();
    resetSampleStore();
    jar.set("ayc_admin_sample", "content@aceyourcourse.ph");
  });

  const questions = () => screen.getByRole("region", { name: "Questions" });

  it("shows GROUPS with counts and the first group's questions, with + Add for an FAQ", async () => {
    await renderPage({ tab: "faqs" });

    const tabs = screen.getByRole("navigation", { name: "Reviews and FAQs" });
    expect(within(tabs).getByRole("link", { name: "FAQS" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("region", { name: "Reviews" })).not.toBeInTheDocument();
    const groups = screen.getByRole("navigation", { name: "FAQ groups" });
    expect(
      within(groups)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Shipping3 questions",
      "Paper and print3 questions",
      "What’s covered4 questions",
      "Buying6 questions",
      "Authenticity2 questions",
    ]);
    expect(
      within(questions()).getByText("SHIPPING · 3 QUESTIONS · ▲▼ TO REORDER"),
    ).toBeInTheDocument();
    expect(within(questions()).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "+ Add question" })).toHaveAttribute(
      "href",
      "/admin/reviews?tab=faqs&group=shipping&faq=new",
    );
    expect(screen.getByText("Select a question")).toBeInTheDocument();
  });

  it("lists the group in the URL, its hidden and app-only questions included", async () => {
    await renderPage({ tab: "faqs", group: "buying" });

    expect(
      within(questions()).getByText("BUYING · 6 QUESTIONS · ▲▼ TO REORDER"),
    ).toBeInTheDocument();
    expect(within(questions()).getAllByText("ANSWER ONLY · MEMBER APP ONLY")).toHaveLength(3);
  });

  it("searches every group from the URL", async () => {
    await renderPage({ tab: "faqs", group: "buying", q: "notebook" });

    expect(within(questions()).getByText("2 MATCHES IN ALL GROUPS")).toBeInTheDocument();
    expect(within(questions()).getByRole("searchbox")).toHaveValue("notebook");
  });

  it("opens the selected FAQ in the editor, and a new one at faq=new in the group", async () => {
    await renderPage({ tab: "faqs", group: "paper", faq: "faq-005" });

    const editor = screen.getByRole("form", { name: "Edit question" });
    expect(within(editor).getByLabelText("QUESTION")).toHaveValue("What are the posters like?");
    expect(within(editor).getByText("★★★★★ · Ultimate CE Posters 2.0")).toBeInTheDocument();
  });

  it("opens a new FAQ's editor in the URL's group", async () => {
    await renderPage({ tab: "faqs", group: "buying", faq: "new" });

    expect(screen.getByRole("form", { name: "New question" })).toHaveTextContent(
      "NEW QUESTION · BUYING",
    );
  });

  it("prompts to pick a question when the selected one is gone", async () => {
    await renderPage({ tab: "faqs", faq: "faq-999" });

    expect(screen.getByText("Select a question")).toBeInTheDocument();
  });
});
