import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SelectedPrice, VariationPicker, VariationProvider } from "./variation-picker";

const VARIATIONS = [
  { name: "CE POSTERS 2.0: MSTC, HPGE, PSAD", price: 125000 },
  { name: "CE POSTERS 2.0: MSTC ONLY", price: 40000 },
  { name: "CE POSTERS 2.0: HPGE ONLY", price: 47000 },
];

// The price row and the buy-box header both show the picked variation's price.
function renderPicker() {
  return render(
    <VariationProvider variations={VARIATIONS}>
      <p data-testid="price-row">
        <SelectedPrice fallback="₱400–₱1,250" />
      </p>
      <VariationPicker />
      <p data-testid="buy-box-header">
        Printed copy · <SelectedPrice fallback="₱400–₱1,250" />
      </p>
    </VariationProvider>,
  );
}

describe("VariationPicker", () => {
  it("shows the price range everywhere until a variation is picked", () => {
    renderPicker();
    expect(screen.getByTestId("price-row")).toHaveTextContent("₱400–₱1,250");
    expect(screen.getByTestId("buy-box-header")).toHaveTextContent("Printed copy · ₱400–₱1,250");
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("lists each variation without its prefix, with its price and no stock label", () => {
    renderPicker();
    expect(screen.getByRole("radiogroup", { name: /variation/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "MSTC ONLY ₱400" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "MSTC, HPGE, PSAD ₱1,250" })).toBeInTheDocument();
    expect(screen.queryByText(/CE POSTERS 2\.0:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/in stock/i)).not.toBeInTheDocument();
  });

  it("shows the picked variation's price in the price row and the buy-box header", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("radio", { name: "HPGE ONLY ₱470" }));
    expect(screen.getByRole("radio", { name: "HPGE ONLY ₱470" })).toBeChecked();
    expect(screen.getByTestId("price-row")).toHaveTextContent("₱470");
    expect(screen.getByTestId("buy-box-header")).toHaveTextContent("Printed copy · ₱470");
  });

  it("can be operated from the keyboard", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.tab();
    // Hold the key as a person does: Radix selects the option focus moves to
    // while an arrow key is down.
    await user.keyboard("{ArrowDown>}");
    await user.keyboard("{/ArrowDown}");
    expect(screen.getByRole("radio", { name: "MSTC ONLY ₱400" })).toBeChecked();
    expect(screen.getByTestId("price-row")).toHaveTextContent("₱400");
  });

  it("shows the fallback price outside a picker, such as a Product with no variations", () => {
    render(<SelectedPrice fallback="₱1,200" />);
    expect(screen.getByText("₱1,200")).toBeInTheDocument();
  });
});
