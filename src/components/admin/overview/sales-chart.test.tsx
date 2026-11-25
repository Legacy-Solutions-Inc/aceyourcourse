import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SalesDay } from "@/lib/payments/sales-figures";

import { SalesChart } from "./sales-chart";

// The Overview's paid-sales chart (Phase 4, ticket 11; BUILD-MAP §3.1): the
// last 14 days, or 30, one bar a day with today's highlighted. Its table
// gives every day's amount without the chart, a day with no sales at ₱0.

/** The 30 days to 25 Nov 2026, all ₱0 but the ones given (in pesos). */
function days(given: Record<string, number> = {}): SalesDay[] {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 27 + index)).toISOString().slice(0, 10);
    const net = (given[date] ?? 0) * 100;
    return { date, paidCentavos: net, refundedCentavos: 0, netCentavos: net };
  });
}

const rows = () =>
  within(screen.getByRole("table", { name: "Net paid by day" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);

describe("SalesChart", () => {
  beforeEach(() => {
    // jsdom lays nothing out, so the chart warns that it has no size: the
    // table is what these tests read.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // jsdom measures nothing: the chart's container watches its size with this.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the last 14 days by default, today last, a day with no sales at ₱0", () => {
    render(<SalesChart days={days({ "2026-11-12": 1_299, "2026-11-25": 6_240 })} />);

    expect(screen.getByRole("heading", { name: "Paid sales" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "14 DAYS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("NET PAID · LAST 14 DAYS · ₱7,539")).toBeInTheDocument();
    expect(rows()).toHaveLength(14);
    expect(rows()[0]).toBe("12 Nov₱1,299");
    expect(rows()[1]).toBe("13 Nov₱0");
    expect(rows().at(-1)).toBe("25 Nov, today₱6,240");
  });

  it("shows all 30 days when asked", async () => {
    const user = userEvent.setup();
    render(<SalesChart days={days({ "2026-10-27": 499 })} />);

    await user.click(screen.getByRole("button", { name: "30 DAYS" }));

    expect(screen.getByRole("button", { name: "30 DAYS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "14 DAYS" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("NET PAID · LAST 30 DAYS · ₱499")).toBeInTheDocument();
    expect(rows()).toHaveLength(30);
    expect(rows()[0]).toBe("27 Oct₱499");
  });
});
