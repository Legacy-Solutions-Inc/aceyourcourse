import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tryCards } from "@/content/home";

import { TryACard } from "./try-a-card";

// "Try a card · tap to flip" (docs/mockup/website/Home_v2.dc.html L33–57,
// L275–279): three sample cards, the topic on the front and the real card on
// the back. It turns over by itself every 3.2 s until the Visitor touches it,
// and never under reduced motion.

const AUTO_FLIP_MS = 3200;

function preferReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const flipButton = () => screen.getByRole("button", { name: "Flip card" });
const topic = () => screen.getByText(/^(Major head loss|Potential energy|Wave motion)$/);
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("TryACard", () => {
  beforeEach(() => {
    // Only the auto-flip's interval is faked, so user-event and Testing
    // Library keep their own real timeouts.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    preferReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the first card's front: its Exam, Subject and topic", () => {
    render(<TryACard cards={tryCards} />);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(topic()).toHaveTextContent("Major head loss");
    expect(screen.getAllByText("CE · HPGE")[0]).toBeVisible();
  });

  it("turns over to the real card by itself after 3.2 s, then moves to the next card", () => {
    render(<TryACard cards={tryCards} />);

    wait(AUTO_FLIP_MS - 1);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    wait(1);
    expect(flipButton()).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("img", { name: /Major head loss, Darcy-Weisbach/ }),
    ).toBeInTheDocument();

    wait(AUTO_FLIP_MS);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(topic()).toHaveTextContent("Potential energy");
  });

  it("stops turning by itself once the Visitor presses on it", async () => {
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);
    // Pressed but not yet released, so it hasn't flipped.
    await user.pointer({ keys: "[MouseLeft>]", target: flipButton() });

    wait(10_000);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(topic()).toHaveTextContent("Major head loss");
  });

  it("stops turning by itself after a touch", async () => {
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);
    await user.pointer({ keys: "[TouchA>]", target: flipButton() });

    wait(10_000);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(topic()).toHaveTextContent("Major head loss");
  });

  it("stops turning by itself once a keyboard user tabs into it", async () => {
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);
    await user.tab();
    expect(flipButton()).toHaveFocus();

    wait(10_000);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(topic()).toHaveTextContent("Major head loss");
  });

  it("never turns by itself for a Visitor who prefers reduced motion", () => {
    preferReducedMotion(true);
    render(<TryACard cards={tryCards} />);

    wait(10_000);
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
    expect(topic()).toHaveTextContent("Major head loss");
  });

  it("flips with Enter on the focused card, and back again", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);

    await user.tab();
    await user.keyboard("{Enter}");
    expect(flipButton()).toHaveAttribute("aria-pressed", "true");
    await user.keyboard(" ");
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("hides the face turned away from screen readers", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);
    expect(screen.queryByRole("img", { name: /Darcy-Weisbach/ })).toBeNull();
    expect(flipButton()).toHaveAccessibleDescription(/Major head loss/);

    await user.click(flipButton());
    expect(screen.getByRole("img", { name: /Darcy-Weisbach/ })).toBeInTheDocument();
    expect(flipButton()).toHaveAccessibleDescription(/Darcy-Weisbach/);
  });

  it("shows a card's front when its Exam dot is chosen", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);
    await user.click(flipButton());

    const eeDot = screen.getByRole("button", { name: "Show the EE card" });
    await user.click(eeDot);
    expect(topic()).toHaveTextContent("Wave motion");
    expect(screen.getAllByText("EE · ESAS")[0]).toBeVisible();
    expect(eeDot).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show the CE card" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(flipButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("cycles with Next card, back to the first after the last", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TryACard cards={tryCards} />);
    const next = screen.getByRole("button", { name: /Next card/ });

    await user.click(next);
    expect(topic()).toHaveTextContent("Potential energy");
    await user.click(next);
    expect(topic()).toHaveTextContent("Wave motion");
    await user.click(next);
    expect(topic()).toHaveTextContent("Major head loss");
  });

  it("renders nothing without cards", () => {
    const { container } = render(<TryACard cards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
