import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Marquee } from "./marquee";

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

const items = (
  <>
    <a href="/reviews">First</a>
    <span>Second</span>
  </>
);

describe("Marquee", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scrolls a second, hidden and inert copy of its items", () => {
    preferReducedMotion(false);
    render(<Marquee label="Reviews">{items}</Marquee>);
    const marquee = screen.getByRole("region", { name: "Reviews" });
    const copies = marquee.querySelectorAll("[data-marquee-copy]");
    expect(copies).toHaveLength(2);
    expect(copies[0]).not.toHaveAttribute("aria-hidden");
    expect(copies[1]).toHaveAttribute("aria-hidden", "true");
    expect(copies[1]).toHaveAttribute("inert");
    expect(screen.getAllByRole("link", { name: "First" })).toHaveLength(1);
    expect(marquee.querySelector(".animate-marquee")).not.toBeNull();
  });

  it("renders one static row with no animation under reduced motion", () => {
    preferReducedMotion(true);
    render(<Marquee label="Reviews">{items}</Marquee>);
    const marquee = screen.getByRole("region", { name: "Reviews" });
    expect(marquee.querySelectorAll("[data-marquee-copy]")).toHaveLength(1);
    expect(marquee.querySelector("[aria-hidden]")).toBeNull();
    expect(marquee.querySelector(".animate-marquee")).toBeNull();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("sets its scroll speed in pixels per second", () => {
    preferReducedMotion(false);
    render(
      <Marquee label="Ticker" speed={80}>
        {items}
      </Marquee>,
    );
    const track = screen.getByRole("region", { name: "Ticker" }).querySelector(".animate-marquee");
    expect(track).toHaveAttribute("data-speed", "80");
  });
});
