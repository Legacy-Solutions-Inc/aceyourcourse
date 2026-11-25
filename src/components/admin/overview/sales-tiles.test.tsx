import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SalesTile } from "@/lib/admin/sales-view";

import { SalesTiles } from "./sales-tiles";

// The Overview's KPI tiles (Phase 4, ticket 11; BUILD-MAP §3.1): each opens
// the Orders or the Users behind its figure; a money tile says what was
// refunded in its days.
const TILES: SalesTile[] = [
  {
    label: "PAID TODAY",
    value: "₱999",
    change: "−₱4,121 vs yesterday",
    trend: "down",
    refunded: "₱300 refunded",
    href: "/admin/orders?status=paid&range=7d",
  },
  {
    label: "ACTIVE MEMBERS",
    value: "496",
    change: "Paid or granted access",
    trend: "none",
    refunded: null,
    href: "/admin/users?filter=active",
  },
];

describe("SalesTiles", () => {
  it("links each tile to its screen, with its figure, its change and what was refunded", () => {
    render(<SalesTiles tiles={TILES} />);

    const tiles = within(screen.getByRole("list", { name: "Sales figures" })).getAllByRole("link");
    expect(tiles.map((tile) => [tile.textContent, tile.getAttribute("href")])).toEqual([
      ["PAID TODAY₱999−₱4,121 vs yesterday₱300 refunded", "/admin/orders?status=paid&range=7d"],
      ["ACTIVE MEMBERS496Paid or granted access", "/admin/users?filter=active"],
    ]);
  });
});
