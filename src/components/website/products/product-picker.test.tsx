import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testLiveProduct } from "../../../../test/fixtures/catalogue";
import { ProductPicker } from "./product-picker";

// "Help me choose" on the Products page. Which Product it recommends is
// covered by src/lib/catalogue/picker.test.ts; this covers the questions, the
// result and "See all", which replaces the URL (the router is replaced) and
// scrolls to the grid.
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const PRODUCTS = [
  testLiveProduct({ id: "ce-cards", slug: "ce-formula-flash-cards", availableInApp: true }),
  testLiveProduct({
    id: "ce-posters",
    slug: "ultimate-ce-posters-2-0",
    shortName: "Ultimate CE Posters 2.0",
    format: "posters",
    priceFrom: 40000,
    priceTo: 125000,
    availableInApp: false,
  }),
  testLiveProduct({
    id: "me-cards",
    slug: "me-formula-flash-cards",
    examCode: "ME",
    shortName: "ME Formula Flash Cards",
    availableInApp: false,
  }),
];

function renderPicker({ memberAppLive = false, examCodes = ["CE", "ME"] } = {}) {
  return render(
    <>
      <ProductPicker products={PRODUCTS} examCodes={examCodes} memberAppLive={memberAppLive} />
      <section id="all" />
    </>,
  );
}

const examQuestion = () =>
  within(screen.getByRole("group", { name: "1. Which board are you taking?" }));
const styleQuestion = () =>
  within(screen.getByRole("group", { name: "2. How do you like to study?" }));
const result = () => screen.getByRole("status");

async function answer(exam: string, style: RegExp) {
  const user = userEvent.setup();
  await user.click(examQuestion().getByRole("button", { name: exam }));
  await user.click(styleQuestion().getByRole("button", { name: style }));
  return user;
}

describe("ProductPicker", () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    // jsdom doesn't lay out, so it has no scrollIntoView.
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("asks for the board, then the study style, before suggesting anything", async () => {
    renderPicker();

    expect(
      examQuestion()
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["CE", "ME"]);
    expect(styleQuestion().getAllByRole("button")).toHaveLength(4);
    expect(result()).toHaveTextContent(
      "Answer both questions and we’ll suggest one reviewer to start with.",
    );

    const user = userEvent.setup();
    await user.click(examQuestion().getByRole("button", { name: "CE" }));
    expect(examQuestion().getByRole("button", { name: "CE" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(result()).toHaveTextContent("Answer both questions");
  });

  it("recommends one Product, with its price and the reason", async () => {
    renderPicker();

    await answer("CE", /^On my wall/);

    expect(result()).toHaveTextContent("Start with this");
    expect(result()).toHaveTextContent("Ultimate CE Posters 2.0");
    expect(result()).toHaveTextContent("from ₱400");
    expect(result()).toHaveTextContent(
      "Posters keep every formula in view while you solve. Where there are no posters for your board, flash cards are the closest fit.",
    );
    expect(within(result()).getByRole("link", { name: "View reviewer" })).toHaveAttribute(
      "href",
      "/products/ultimate-ce-posters-2-0",
    );
  });

  it('shows every reviewer for the Exam with "See all", and scrolls to the grid', async () => {
    renderPicker();
    const user = await answer("CE", /^On the go/);

    await user.click(within(result()).getByRole("button", { name: "See all CE reviewers" }));

    expect(replace).toHaveBeenCalledWith("/products?exam=ce", { scroll: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("all"));
  });

  it("clears an answer when it's picked again", async () => {
    renderPicker();
    const user = await answer("CE", /^On my wall/);

    await user.click(examQuestion().getByRole("button", { name: "CE" }));

    expect(examQuestion().getByRole("button", { name: "CE" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(result()).toHaveTextContent("Answer both questions");
  });

  it("says so when the Exam has no reviewers out yet", async () => {
    renderPicker({ examCodes: ["CE", "EE"] });

    await answer("EE", /^Everything/);

    expect(result()).toHaveTextContent("No EE reviewers are out yet.");
    expect(within(result()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers no App option while the Member App switch is off", () => {
    renderPicker();
    expect(styleQuestion().queryByRole("button", { name: /^App/ })).not.toBeInTheDocument();
  });

  it("offers the App option while the Member App switch is on", async () => {
    renderPicker({ memberAppLive: true });
    expect(styleQuestion().getAllByRole("button")).toHaveLength(5);

    await answer("CE", /^App/);

    expect(result()).toHaveTextContent("Start in the app");
    expect(result()).toHaveTextContent("CE Formula Flash Cards");
    expect(result()).toHaveTextContent(
      "The app has digital flash cards, quizzes, reviewer PDFs, and video lessons for this exam",
    );
  });

  it('says "Start with this" when "App" falls back to a printed-only Product', async () => {
    renderPicker({ memberAppLive: true });

    await answer("ME", /^App/);

    expect(result()).toHaveTextContent("Start with this");
    expect(result()).not.toHaveTextContent("Start in the app");
    expect(result()).toHaveTextContent("For ME, the ME Formula Flash Cards is the closest fit.");
  });
});
