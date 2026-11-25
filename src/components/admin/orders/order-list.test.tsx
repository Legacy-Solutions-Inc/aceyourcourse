import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ORDER_QUERY } from "@/lib/admin/orders-list";
import type { OrderRefund } from "@/lib/payments/refunds";
import type { AdminOrderList } from "@/services/admin.types";

import { ExportCsvButton } from "./export-csv-button";
import { OrderList } from "./order-list";

// The Orders list's filters (story 147; mockup 663–668): each one replaces
// the URL, so the server filters the list. The router is the boundary, so
// it's replaced.
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

const EMPTY: AdminOrderList = {
  query: DEFAULT_ORDER_QUERY,
  rows: [],
  stats: { paidCentavos: 0, orders: 0, pending: 0, failed: 0 },
};

function renderList(list: AdminOrderList = EMPTY) {
  const user = userEvent.setup();
  render(<OrderList list={list} />);
  return { user };
}

describe("OrderList", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("searches by order number or email in the URL", async () => {
    const { user } = renderList();
    await user.type(
      screen.getByRole("searchbox", { name: "Search by order number or email" }),
      "7",
    );
    expect(replace).toHaveBeenLastCalledWith("/admin/orders?q=7", { scroll: false });
  });

  it("filters by Payment Method and range in the URL, keeping the other filters", async () => {
    const { user } = renderList({ ...EMPTY, query: { ...DEFAULT_ORDER_QUERY, status: "paid" } });
    await user.selectOptions(screen.getByRole("combobox", { name: "Payment method" }), "GCash");
    expect(replace).toHaveBeenLastCalledWith("/admin/orders?status=paid&method=gcash", {
      scroll: false,
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Date range" }), "All time");
    expect(replace).toHaveBeenLastCalledWith("/admin/orders?status=paid&range=all", {
      scroll: false,
    });
  });

  it("includes Test Orders when ticked", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("checkbox", { name: "Include test orders" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/orders?tests=1", { scroll: false });
  });

  it("keeps only the Orders with an invoice to send when Invoice requested is ticked", async () => {
    const { user } = renderList();
    await user.click(screen.getByRole("checkbox", { name: "Invoice requested" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/orders?invoice=requested", { scroll: false });
  });

  it("tags an Order whose invoice was requested and not yet sent", () => {
    const order = {
      id: "00000000-0000-4000-8000-000000010003",
      reference: "AYC-10003",
      userId: null,
      examCode: "CE",
      planId: "plan-ce-90",
      planName: "CE All-Access",
      days: 90,
      priceCentavos: 129_900,
      method: "gcash",
      status: "paid",
      recordedStatus: "paid",
      paidAfterExpiry: false,
      refunds: [] as OrderRefund[],
      refundedCentavos: 0,
      livemode: true,
      checkoutId: null,
      paymentId: "pay_Sample10003",
      buyerName: "Bea Tester",
      buyerEmail: "tester@example.com",
      createdAt: "2026-11-25T01:00:00.000Z",
      paidAt: "2026-11-25T01:01:00.000Z",
      statusChangedAt: "2026-11-25T01:01:00.000Z",
    } as const;
    const request = {
      orderId: order.id,
      name: "Bea Tester",
      address: "Jaro",
      tin: null,
      requestedAt: "2026-11-25T02:00:00.000Z",
      sentAt: null,
      sentBy: null,
    };
    renderList({
      ...EMPTY,
      rows: [
        { ...order, invoice: request },
        {
          ...order,
          id: "sent",
          reference: "AYC-10002",
          invoice: {
            ...request,
            sentAt: "2026-11-25T03:00:00.000Z",
            sentBy: { email: "o@example.com", name: "O" },
          },
        },
      ],
    });

    expect(screen.getAllByText("INVOICE REQUESTED")).toHaveLength(1);
    expect(screen.getByRole("row", { name: /AYC-10003/ })).toHaveTextContent("INVOICE REQUESTED");
  });

  it("shows a Refunded Order's status, and a partial refund's amount under PAID (ticket 09)", () => {
    const row = (reference: string, fields: Partial<AdminOrderList["rows"][number]>) =>
      ({
        id: reference,
        reference,
        userId: null,
        examCode: "CE",
        planId: "plan-ce-90",
        planName: "CE All-Access",
        days: 90,
        priceCentavos: 129_900,
        method: "gcash",
        status: "paid",
        recordedStatus: "paid",
        paidAfterExpiry: false,
        invoice: null,
        refunds: [],
        refundedCentavos: 0,
        livemode: true,
        checkoutId: null,
        paymentId: null,
        buyerName: null,
        buyerEmail: "buyer@example.com",
        createdAt: "2026-11-25T01:00:00.000Z",
        paidAt: "2026-11-25T01:01:00.000Z",
        statusChangedAt: "2026-11-25T01:01:00.000Z",
        ...fields,
      }) as AdminOrderList["rows"][number];
    renderList({
      ...EMPTY,
      rows: [
        row("AYC-10007", { refundedCentavos: 30_000 }),
        row("AYC-10008", {
          status: "refunded",
          recordedStatus: "refunded",
          refundedCentavos: 129_900,
        }),
      ],
    });

    const partial = screen.getByRole("row", { name: /AYC-10007/ });
    expect(partial).toHaveTextContent("PAID");
    expect(partial).toHaveTextContent("PARTIALLY REFUNDED · ₱300");
    const refunded = screen.getByRole("row", { name: /AYC-10008/ });
    expect(refunded).toHaveTextContent("REFUNDED");
    expect(refunded).not.toHaveTextContent("PARTIALLY");
  });

  it("offers a chip per status, linking to it", () => {
    renderList();
    expect(screen.getByRole("link", { name: "ANY STATUS" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "EXPIRED" })).toHaveAttribute(
      "href",
      "/admin/orders?status=expired",
    );
    expect(screen.getByRole("link", { name: "REFUNDED" })).toHaveAttribute(
      "href",
      "/admin/orders?status=refunded",
    );
  });

  it("shows zero tiles and No Orders match when nothing matches", () => {
    renderList();
    expect(screen.getByText("PAID · LAST 30 DAYS").nextSibling).toHaveTextContent("₱0");
    expect(screen.getByText("No Orders match. Clear the search or filters.")).toBeInTheDocument();
  });
});

describe("ExportCsvButton", () => {
  const CSV = "\uFEFFReference\r\n";
  let clicked: { href: string; download: string }[];

  beforeEach(() => {
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });
    URL.createObjectURL = vi.fn(() => "blob:orders");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderButton(answer: () => Promise<Response>) {
    const fetch = vi.fn(answer);
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<ExportCsvButton href="/admin/orders/export?status=paid" />);
    return { user, fetch };
  }

  it("downloads exactly the filtered Orders' CSV under the server's name, then says so", async () => {
    const { user, fetch } = renderButton(
      async () =>
        new Response(CSV, {
          headers: { "content-disposition": 'attachment; filename="ayc-orders-2026-11-25.csv"' },
        }),
    );
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(fetch).toHaveBeenCalledWith("/admin/orders/export?status=paid", {
      credentials: "same-origin",
    });
    expect(await screen.findByText("✓ CSV EXPORTED · MATCHING ORDERS ONLY")).toBeInTheDocument();
    expect(clicked).toEqual([{ href: "blob:orders", download: "ayc-orders-2026-11-25.csv" }]);
  });

  it("saves nothing and says why when the server refuses", async () => {
    const { user } = renderButton(
      async () => new Response("Only an Owner can export Orders.", { status: 403 }),
    );
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(await screen.findByText("Only an Owner can export Orders.")).toHaveClass(
      "text-destructive",
    );
    expect(clicked).toEqual([]);
    expect(screen.queryByText(/CSV EXPORTED/)).not.toBeInTheDocument();
  });

  it("saves nothing when the server can't be reached", async () => {
    const { user } = renderButton(async () => {
      throw new TypeError("Failed to fetch");
    });
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(
      await screen.findByText("COULDN’T REACH THE SERVER · NOTHING WAS EXPORTED"),
    ).toBeInTheDocument();
    expect(clicked).toEqual([]);
  });
});
