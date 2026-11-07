import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterChip, FilterChipGroup } from "./filter-chips";

// The filter chips the Products and Reviews pages share: a pressed state, a
// count read with its noun, and no dead ends (a chip with nothing to show is
// disabled unless it's the one picked).

const REVIEWS = { one: "review", other: "reviews" };

function renderGroup(chips: { label: string; count: number; pressed?: boolean }[]) {
  const onClick = vi.fn();
  render(
    <FilterChipGroup label="Stars">
      {chips.map((chip) => (
        <FilterChip
          key={chip.label}
          pressed={chip.pressed ?? false}
          count={chip.count}
          noun={REVIEWS}
          onClick={() => onClick(chip.label)}
        >
          {chip.label}
        </FilterChip>
      ))}
    </FilterChipGroup>,
  );
  return { onClick, group: within(screen.getByRole("group", { name: "Stars" })) };
}

describe("FilterChip", () => {
  it("is named by its label and count, with the count's noun for screen readers", () => {
    const { group } = renderGroup([
      { label: "All", count: 16, pressed: true },
      { label: "MT", count: 1 },
    ]);

    expect(group.getByRole("button", { name: "All 16 reviews" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(group.getByRole("button", { name: "MT 1 review" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is disabled with nothing to show, unless it's the one picked", () => {
    const { group } = renderGroup([
      { label: "4★", count: 0 },
      { label: "PHLE", count: 0, pressed: true },
    ]);

    expect(group.getByRole("button", { name: "4★ 0 reviews" })).toBeDisabled();
    expect(group.getByRole("button", { name: "PHLE 0 reviews" })).toBeEnabled();
  });

  it("reports a pick", async () => {
    const user = userEvent.setup();
    const { group, onClick } = renderGroup([{ label: "CE", count: 8 }]);

    await user.click(group.getByRole("button", { name: "CE 8 reviews" }));

    expect(onClick).toHaveBeenCalledWith("CE");
  });
});
