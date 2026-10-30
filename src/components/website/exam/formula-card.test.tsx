import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { sampleCards } from "@/content/exam-pages";

import { FormulaCard } from "./formula-card";

// "Try a {code} card": one sample formula card at a time, which flips to its
// formula on click, Enter or Space, with Previous and Next to step through the
// Exam's cards (docs/mockup/website/Exam_v2.dc.html L139–158).

const CARDS = sampleCards.CE ?? [];

const flipButton = () => screen.getByRole("button", { name: "Flip card" });

describe("FormulaCard", () => {
  it("shows the first card's front, describing the flip button with it", () => {
    render(<FormulaCard examCode="CE" cards={CARDS} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getAllByText("CE · MSTC")).not.toHaveLength(0);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(flipButton()).toHaveAccessibleDescription("Tangent distance of a simple curve");
  });

  it("flips to the formula on click, and back again", async () => {
    const user = userEvent.setup();
    render(<FormulaCard examCode="CE" cards={CARDS} />);

    await user.click(flipButton());
    expect(flipButton()).toHaveAttribute("aria-pressed", "true");
    expect(flipButton()).toHaveAccessibleDescription(
      "T = R tan(I/2) R = radius, I = central angle",
    );

    await user.click(flipButton());
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(flipButton()).toHaveAccessibleDescription("Tangent distance of a simple curve");
  });

  it("flips with Enter and with Space", async () => {
    const user = userEvent.setup();
    render(<FormulaCard examCode="CE" cards={CARDS} />);

    flipButton().focus();
    await user.keyboard("{Enter}");
    expect(flipButton()).toHaveAttribute("aria-pressed", "true");
    await user.keyboard(" ");
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("hides the face that's turned away from screen readers", async () => {
    const user = userEvent.setup();
    render(<FormulaCard examCode="CE" cards={CARDS} />);
    const formula = screen.getByText("T = R tan(I/2)");
    const prompt = screen.getByText("Tangent distance of a simple curve");
    expect(formula.closest("[aria-hidden='true']")).not.toBeNull();
    expect(prompt.closest("[aria-hidden='true']")).toBeNull();

    await user.click(flipButton());
    expect(formula.closest("[aria-hidden='true']")).toBeNull();
    expect(prompt.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("steps to the next card front side up, and back from the first to the last", async () => {
    const user = userEvent.setup();
    render(<FormulaCard examCode="CE" cards={CARDS} />);

    await user.click(flipButton());
    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(flipButton()).toHaveAccessibleDescription("Pressure at a depth in a liquid");

    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(flipButton()).toHaveAccessibleDescription("Balanced steel ratio");

    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("renders nothing without cards", () => {
    const { container } = render(<FormulaCard examCode="CE" cards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
