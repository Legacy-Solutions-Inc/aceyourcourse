import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testFaq, testFaqGroups } from "../../../../test/fixtures/catalogue";
import { FaqExplorer } from "./faq-explorer";

vi.mock("next/navigation", () => ({ usePathname: () => "/faq" }));

const SHOPEE_SHOP = "https://shopee.ph/aceyourcourse";
const scrollIntoView = vi.fn();

function renderExplorer(props: Partial<React.ComponentProps<typeof FaqExplorer>> = {}) {
  return render(
    <FaqExplorer
      groups={testFaqGroups()}
      hero={<h1>Questions reviewees always ask</h1>}
      coverageTable={null}
      shopeeShop={SHOPEE_SHOP}
      contactEmail="aceyourcourseinc@gmail.com"
      memberAppLive={false}
      {...props}
    />,
  );
}

/** An FAQ's accordion button. A popular chip has the same name but no aria-expanded. */
function faqButton(question: string): HTMLElement {
  const button = screen
    .queryAllByRole("button", { name: question })
    .find((element) => element.hasAttribute("aria-expanded"));
  if (!button) throw new Error(`no FAQ button "${question}"`);
  return button;
}

/** The FAQ questions on screen, in order, without each button's decorative "+". */
const questions = () =>
  screen
    .queryAllByRole("button")
    .filter((element) => element.hasAttribute("aria-expanded"))
    .map((element) => element.textContent?.replace(/\+$/, ""));

const ALL_QUESTIONS = [
  "Where do orders ship from?",
  "How do I track my order?",
  "What are the posters like?",
  "How do I know I’m buying the original?",
];

describe("FaqExplorer", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    scrollIntoView.mockReset();
    window.history.replaceState(null, "", "/faq");
  });

  it("shows every group with its FAQs, with only the first one open", () => {
    renderExplorer();
    // Each group's number is decorative, so screen readers hear only its title.
    for (const [number, title] of [
      ["01", "Shipping"],
      ["02", "Paper and print"],
      ["03", "Authenticity"],
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toHaveTextContent(
        `${number}${title}`,
      );
    }
    expect(questions()).toEqual(ALL_QUESTIONS);
    expect(faqButton("Where do orders ship from?")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Every order ships from Iloilo City.")).toBeVisible();
    expect(faqButton("How do I track my order?")).toHaveAttribute("aria-expanded", "false");
    // A closed answer is still in the page, for search engines, but hidden.
    expect(screen.getByText("In the Shopee app, under My Purchases.")).not.toBeVisible();
    expect(document.getElementById("faq-tracking")).not.toBeNull();
  });

  it("lists each topic with its count, linking to its group", () => {
    renderExplorer();
    const topics = within(screen.getByRole("navigation", { name: "Topics" }));
    expect(topics.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "#topic-shipping",
      "#topic-paper",
      "#topic-authenticity",
    ]);
    expect(topics.getByRole("link", { name: "Shipping 2 answers" })).toHaveTextContent(
      "01Shipping2",
    );
    expect(topics.getByRole("link", { name: "Paper and print 1 answer" })).toBeVisible();
    expect(document.getElementById("topic-paper")).not.toBeNull();
  });

  it("offers a popular chip for each FAQ that has one", () => {
    renderExplorer();
    const chips = within(screen.getByRole("group", { name: "Popular" }));
    expect(chips.getAllByRole("button").map((chip) => chip.textContent)).toEqual([
      "Where do orders ship from?",
      "How do I know I’m buying the original?",
    ]);
  });

  it("narrows the FAQs as the Visitor types, opens the matches and updates the counts", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.type(screen.getByRole("searchbox", { name: "Search the FAQ" }), "iloilo");

    expect(questions()).toEqual([
      "Where do orders ship from?",
      "How do I know I’m buying the original?",
    ]);
    expect(faqButton("How do I know I’m buying the original?")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 answers for “ILOILO”");
    const topics = within(screen.getByRole("navigation", { name: "Topics" }));
    expect(topics.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "#topic-shipping",
      "#topic-authenticity",
    ]);
    expect(topics.getByRole("link", { name: "Shipping 1 answer" })).toBeVisible();
    // Groups keep their numbers while searching.
    expect(topics.getByRole("link", { name: "Authenticity 1 answer" })).toHaveTextContent(
      "03Authenticity1",
    );
  });

  it("lets the Visitor close a match while searching", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.type(screen.getByRole("searchbox", { name: "Search the FAQ" }), "iloilo");
    await user.click(faqButton("Where do orders ship from?"));
    expect(faqButton("Where do orders ship from?")).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the no-results state, and Clear search brings every FAQ back", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.type(screen.getByRole("searchbox", { name: "Search the FAQ" }), "zzzz");

    expect(questions()).toEqual([]);
    expect(screen.getByText("No answers for “zzzz” yet.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("0 answers for “ZZZZ”");
    expect(
      screen.getByRole("link", { name: "Chat us on Shopee (opens in a new tab)" }),
    ).toHaveAttribute("href", SHOPEE_SHOP);

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(questions()).toEqual(ALL_QUESTIONS);
    expect(screen.getByRole("searchbox", { name: "Search the FAQ" })).toHaveValue("");
    expect(screen.queryByText(/No answers for/)).not.toBeInTheDocument();
  });

  it("hides Chat us on Shopee when there is no Shopee shop, and offers the email instead", async () => {
    const user = userEvent.setup();
    renderExplorer({ shopeeShop: null });
    await user.type(screen.getByRole("searchbox", { name: "Search the FAQ" }), "zzzz");

    expect(screen.queryByRole("link", { name: /Chat us on Shopee/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Shopee chat/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "aceyourcourseinc@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:aceyourcourseinc@gmail.com",
    );
  });

  it("clears the search from the search box's own Clear button", async () => {
    const user = userEvent.setup();
    renderExplorer();
    const search = screen.getByRole("searchbox", { name: "Search the FAQ" });
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    await user.type(search, "posters");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(search).toHaveValue("");
    expect(questions()).toEqual(ALL_QUESTIONS);
  });

  it("opens every FAQ with Expand all and closes them with Collapse all", async () => {
    const user = userEvent.setup();
    renderExplorer();
    const buttons = () => ALL_QUESTIONS.map((question) => faqButton(question));

    await user.click(screen.getByRole("button", { name: "Expand all" }));
    for (const button of buttons()) expect(button).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    for (const button of buttons()) expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and scrolls to an FAQ from its popular chip, clearing any search", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.type(screen.getByRole("searchbox", { name: "Search the FAQ" }), "track");
    const chips = within(screen.getByRole("group", { name: "Popular" }));
    await user.click(chips.getByRole("button", { name: "How do I know I’m buying the original?" }));

    expect(screen.getByRole("searchbox", { name: "Search the FAQ" })).toHaveValue("");
    expect(questions()).toEqual(ALL_QUESTIONS);
    expect(faqButton("How do I know I’m buying the original?")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("faq-original"));
    expect(faqButton("How do I know I’m buying the original?")).toHaveFocus();
  });

  it("opens and scrolls to the FAQ named in the URL on load", () => {
    window.history.replaceState(null, "", "/faq#faq-tracking");
    renderExplorer();
    expect(faqButton("How do I track my order?")).toHaveAttribute("aria-expanded", "true");
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("faq-tracking"));
  });

  it("opens an FAQ when the URL's hash changes to it", () => {
    renderExplorer();
    act(() => {
      window.history.replaceState(null, "", "/faq#faq-posters");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(faqButton("What are the posters like?")).toHaveAttribute("aria-expanded", "true");
  });

  it("loads normally, with the first FAQ open, for an unknown FAQ in the URL", () => {
    window.history.replaceState(null, "", "/faq#faq-nope");
    renderExplorer();
    expect(faqButton("Where do orders ship from?")).toHaveAttribute("aria-expanded", "true");
    expect(questions()).toEqual(ALL_QUESTIONS);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("shows a quote as From a review, credited to its stars, Product and variation", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(faqButton("What are the posters like?"));
    const quote = screen.getByRole("figure");
    expect(quote).toHaveTextContent("From a review");
    expect(within(quote).getByText("“Readable fonts.”")).toBeVisible();
    expect(within(quote).getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();
    expect(quote).toHaveTextContent("Ultimate CE Posters 2.0 · MSTC, HPGE, PSAD");
  });

  it("shows the coverage table under the FAQ that has it, and no other", async () => {
    const user = userEvent.setup();
    renderExplorer({
      groups: [
        {
          group: "coverage",
          title: "What’s covered",
          items: [
            testFaq({ slug: "coverage", group: "coverage", showCoverageTable: true }),
            testFaq({
              id: "faq-test-2",
              slug: "on-its-own",
              group: "coverage",
              order: 2,
              question: "Is it enough on its own?",
            }),
          ],
        },
      ],
      coverageTable: <p>Coverage table</p>,
    });
    expect(screen.getAllByText("Coverage table")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getAllByText("Coverage table")).toHaveLength(1);
  });

  it("keeps the Member App out of the search placeholder while the switch is off", () => {
    renderExplorer({ memberAppLive: false });
    expect(screen.getByRole("searchbox", { name: "Search the FAQ" })).toHaveAttribute(
      "placeholder",
      "Search: shipping, paper, coverage…",
    );
  });

  it("suggests app searches in the placeholder while the switch is on", () => {
    renderExplorer({ memberAppLive: true });
    expect(screen.getByRole("searchbox", { name: "Search the FAQ" })).toHaveAttribute(
      "placeholder",
      "Search: shipping, SPayLater, two devices…",
    );
  });
});
