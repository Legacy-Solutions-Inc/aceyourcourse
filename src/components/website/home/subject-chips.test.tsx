import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SubjectChips } from "./subject-chips";

// An Exam's Subject chips in "Find your exam": the code shows, screen readers
// hear the full name as part of the chip's name, and hovering or focusing a
// chip shows the full name in a tooltip that can be hovered and dismissed
// with Escape (WCAG 1.4.13). The tooltip is visual only, so it isn't read twice.

const SUBJECTS = [
  { code: "MSTC", name: "Mathematics, Surveying & Transportation Engineering" },
  { code: "HPGE", name: "Hydraulics & Geotechnical Engineering" },
];

const renderChips = () =>
  render(
    <>
      <p id="label">Subjects covered</p>
      <SubjectChips subjects={SUBJECTS} labelledBy="label" />
      <button type="button">Elsewhere</button>
    </>,
  );
const tooltip = () => document.querySelector("[data-subject-tooltip]");
const chip = (code: string) => screen.getByRole("button", { name: new RegExp(`^${code} · `) });

describe("SubjectChips", () => {
  it("lists each Subject by code, named in full for screen readers", () => {
    renderChips();
    const list = screen.getByRole("list", { name: "Subjects covered" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(chip("MSTC")).toHaveAccessibleName(
      "MSTC · Mathematics, Surveying & Transportation Engineering",
    );
    expect(chip("MSTC").firstChild?.textContent).toBe("MSTC");
    expect(tooltip()).toBeNull();
  });

  // Moving the pointer onto the tooltip is checked in e2e/home.spec.ts: jsdom's
  // pointer events carry no relatedTarget, so React reads any move as leaving.
  it("shows the full name on hover, and hides it once the pointer leaves", async () => {
    const user = userEvent.setup();
    renderChips();
    await user.hover(chip("HPGE"));
    expect(tooltip()).toHaveTextContent("Hydraulics & Geotechnical Engineering");
    expect(tooltip()).toHaveAttribute("aria-hidden", "true");

    await user.unhover(screen.getByRole("list"));
    expect(tooltip()).toBeNull();
  });

  it("shows the full name on keyboard focus, until Escape or focus moves on", async () => {
    const user = userEvent.setup();
    renderChips();
    await user.tab();
    expect(chip("MSTC")).toHaveFocus();
    expect(tooltip()).toHaveTextContent("Mathematics, Surveying & Transportation Engineering");

    await user.keyboard("{Escape}");
    expect(tooltip()).toBeNull();
    expect(chip("MSTC")).toHaveFocus();

    await user.tab();
    expect(tooltip()).toHaveTextContent("Hydraulics & Geotechnical Engineering");
    await user.tab();
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
    expect(tooltip()).toBeNull();
  });

  it("hides a hover tooltip with Escape, without moving the pointer", async () => {
    const user = userEvent.setup();
    renderChips();
    await user.hover(chip("MSTC"));
    await user.keyboard("{Escape}");
    expect(tooltip()).toBeNull();
  });
});
