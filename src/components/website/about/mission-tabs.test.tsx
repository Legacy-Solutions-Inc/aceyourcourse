import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ABOUT_DEFAULTS } from "@/lib/catalogue/about-content";

import { MissionTabs } from "./mission-tabs";

// "The mission" (docs/mockup/website/About_v2.dc.html L89–112, L163–167): four
// numbered principles as tabs down the side, the chosen one's copy beside them.

const tabs = () => screen.getAllByRole("tab");
const panel = () => within(screen.getByRole("tabpanel"));

describe("MissionTabs", () => {
  it("is a section headed “The mission”, with the four principles as tabs", () => {
    render(<MissionTabs copy={ABOUT_DEFAULTS.mission} />);
    expect(screen.getByRole("region", { name: "The mission" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Help more reviewees walk out of the exam room as registered professionals, without spending more than they have.",
      ),
    ).toBeVisible();
    const list = screen.getByRole("tablist", { name: "What we stand for" });
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      "01Board-focused, nothing extra→",
      "02Updated to the trend→",
      "03Made for tight budgets→",
      "04Original, and protected→",
    ]);
    // The numbers and arrows are visual only.
    expect(tabs()[0]).toHaveAccessibleName("Board-focused, nothing extra");
  });

  it("opens on the first principle", () => {
    render(<MissionTabs copy={ABOUT_DEFAULTS.mission} />);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(
      panel().getByRole("heading", { level: 3, name: "Board-focused, nothing extra" }),
    ).toBeVisible();
    expect(panel().getByText("01")).toBeInTheDocument();
    expect(panel().getByText(/so every card earns its place in your bag\.$/)).toBeVisible();
  });

  it("moves through the principles with the arrow keys, showing each one's copy", async () => {
    const user = userEvent.setup();
    render(<MissionTabs copy={ABOUT_DEFAULTS.mission} />);
    await user.tab();
    expect(tabs()[0]).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(tabs()[1]).toHaveFocus();
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(panel().getByRole("heading", { level: 3, name: "Updated to the trend" })).toBeVisible();
    expect(panel().getByText(/already on their second edition\.$/)).toBeVisible();

    await user.keyboard("{ArrowDown}");
    expect(
      panel().getByRole("heading", { level: 3, name: "Made for tight budgets" }),
    ).toBeVisible();
    expect(panel().getByText(/^Buy one subject at a time/)).toBeVisible();

    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    // Moving up from the first wraps round to the last.
    expect(tabs()[3]).toHaveFocus();
    expect(
      panel().getByRole("heading", { level: 3, name: "Original, and protected" }),
    ).toBeVisible();
    expect(panel().getByText("04")).toBeInTheDocument();
  });

  it("switches on a click", async () => {
    const user = userEvent.setup();
    render(<MissionTabs copy={ABOUT_DEFAULTS.mission} />);
    await user.click(screen.getByRole("tab", { name: "Original, and protected" }));
    expect(panel().getByText(/^Every reviewer is registered with IPOPHIL\./)).toBeVisible();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });
});
