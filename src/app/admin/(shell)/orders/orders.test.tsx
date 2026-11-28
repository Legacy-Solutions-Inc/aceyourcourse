import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CATALOGUE_SEED } from "@/services/mock/catalogue";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import OrderPage from "./[reference]/page";
import { GET } from "./export/route";
import OrdersPage from "./page";

// Orders & payments (Phase 4, ticket 07; stories 147 and 148): the list, an
// Order's detail page and the CSV export, Owners only, on the server. Each
// calls the Staff Guard itself. The cookie jar and redirect() are the
// framework boundary, so they're replaced; the sample data, with its sample
// Orders, is the seam:
//   AYC-10001 Jose, CE 6 months, GCash, Paid, 45 days ago
//   AYC-10002 Maria, CE 3 months, QR Ph, Paid, 20 days ago
//   AYC-10003 Paolo, CE 1 month, GCash, Paid, 6 days ago
//   AYC-10004 Karen, ME 1 month, Card, Failed, 4 days ago
//   AYC-10005 Tess, CE 1 month, Maya, Paid, a Test Order, 2 days ago
//   AYC-10006 Paolo, ME 1 month, Maya, Pending, 1 hour ago
//   AYC-10007 Bea, CE 3 months, QR Ph, Paid, ₱300 refunded (ticket 09), 50 minutes ago
//   AYC-10008 Lou, CE 1 month, GCash, Refunded (ticket 09), 40 minutes ago
//   AYC-10009 Karen, CE 3 months, GCash, Paid, 3 days ago (ticket 11)
//   AYC-10010 Jose, ME 1 month, QR Ph, Paid, 9 days ago (ticket 11)
//   AYC-10011 Maria, CE 1 month, Card, Paid after expiry, 2 days ago (ticket 11)
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/orders",
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
  unstable_rethrow: () => {},
}));

const OWNER = "angel@aceyourcourse.ph";
const EDITOR = "content@aceyourcourse.ph";

const signInAs = (email: string) => jar.set("ayc_admin_sample", email);
const ordersPage = (params: Record<string, string> = {}) =>
  OrdersPage({ searchParams: Promise.resolve(params) });
const orderPage = (reference: string) => OrderPage({ params: Promise.resolve({ reference }) });
const exportCsv = (search = "", headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost:3000/admin/orders/export${search}`, { headers }));

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const references = () => rows().map((row) => within(row).getAllByRole("link")[0]?.textContent);
const csvReferences = (csv: string) =>
  csv
    .replace("﻿", "")
    .split("\r\n")
    .slice(1, -1)
    .map((line) => line.split(",")[0]);

beforeEach(() => {
  jar.clear();
  resetSampleStore(CATALOGUE_SEED, { sampleOrders: true });
});

describe("the Orders list", () => {
  it("shows an Owner the last 30 days' Orders under SALES, without Test Orders, with their tiles", async () => {
    signInAs(OWNER);
    render(await ordersPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Orders & payments" }),
    ).toBeInTheDocument();
    expect(screen.getByText("SALES")).toBeInTheDocument();
    expect(references()).toEqual([
      "AYC-10008",
      "AYC-10007",
      "AYC-10006",
      "AYC-10011",
      "AYC-10009",
      "AYC-10004",
      "AYC-10003",
      "AYC-10010",
      "AYC-10002",
    ]);
    const tiles = screen.getByRole("region", { name: "Orders list" }).querySelector("dl");
    expect(tiles).toHaveTextContent("PAID · LAST 30 DAYS₱5,344ORDERS9PENDING1FAILED1");
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Payment status comes from PayMongo. Card details are never stored on the platform.",
      ),
    ).toBeInTheDocument();
  });

  it("shows each Order's columns: Order, date, Member, item, method, amount and status", async () => {
    signInAs(OWNER);
    render(await ordersPage({ q: "AYC-10003" }));

    const [row] = rows();
    expect(within(row ?? document.body).getByRole("link", { name: "AYC-10003" })).toHaveAttribute(
      "href",
      "/admin/orders/AYC-10003",
    );
    expect(row).toHaveTextContent("paolo.reyes@example.com");
    expect(row).toHaveTextContent("CE All-Access · 1 month");
    expect(row).toHaveTextContent("GCash");
    expect(row).toHaveTextContent("₱499");
    expect(row).toHaveTextContent("PAID");
  });

  it("shows a Refunded Order's status, and a partial refund under PAID (ticket 09)", async () => {
    signInAs(OWNER);
    render(await ordersPage());

    const row = (reference: string) =>
      rows().find((candidate) => candidate.textContent?.includes(reference));
    expect(row("AYC-10008")).toHaveTextContent("REFUNDED");
    expect(row("AYC-10008")).not.toHaveTextContent("PARTIALLY");
    expect(row("AYC-10007")).toHaveTextContent("PAID");
    expect(row("AYC-10007")).toHaveTextContent("PARTIALLY REFUNDED · ₱300");
  });

  it("filters by GCash and Paid from the URL", async () => {
    signInAs(OWNER);
    render(await ordersPage({ method: "gcash", status: "paid" }));

    expect(references()).toEqual(["AYC-10009", "AYC-10003"]);
    expect(screen.getByRole("link", { name: "PAID" })).toHaveAttribute("aria-current", "true");
  });

  it("lists the Orders paid after expiry in the last 7 days, as Needs attention's link opens it (ticket 11)", async () => {
    signInAs(OWNER);
    render(await ordersPage({ range: "7d", late: "1" }));

    expect(references()).toEqual(["AYC-10011"]);
    expect(screen.getByRole("checkbox", { name: "Paid after expiry" })).toBeChecked();
  });

  it("shows the Test Order, tagged TEST, only with Include test orders", async () => {
    signInAs(OWNER);
    render(await ordersPage({ tests: "1" }));

    expect(references()).toContain("AYC-10005");
    const testRow = rows().find((row) => row.textContent?.includes("AYC-10005"));
    expect(testRow).toHaveTextContent("TEST");
    expect(screen.getByRole("checkbox", { name: "Include test orders" })).toBeChecked();
  });

  it("says No Orders match when the filters match none", async () => {
    signInAs(OWNER);
    render(await ordersPage({ q: "nobody@example.com" }));

    expect(rows()).toEqual([]);
    expect(screen.getByText("No Orders match. Clear the search or filters.")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign-in, coming back to the same filters", async () => {
    await expect(ordersPage({ status: "pending" })).rejects.toThrow(
      `NEXT_REDIRECT /admin/sign-in?next=${encodeURIComponent("/admin/orders?status=pending")}`,
    );
  });

  it("sends an Editor to the owners-only 403 screen", async () => {
    signInAs(EDITOR);
    await expect(ordersPage()).rejects.toThrow("NEXT_REDIRECT /admin/denied?reason=owners-only");
  });
});

describe("an Order's detail page", () => {
  it("shows a Pending Order with its timeline, notes and Check status with PayMongo", async () => {
    signInAs(OWNER);
    render(await orderPage("AYC-10006"));

    expect(screen.getByRole("heading", { level: 2, name: "AYC-10006" })).toBeInTheDocument();
    const order = screen.getByRole("region", { name: "AYC-10006" });
    expect(order).toHaveTextContent("PENDING");
    expect(order).toHaveTextContent("MEMBERpaolo.reyes@example.comPaolo Reyes");
    expect(order).toHaveTextContent("ITEMME All-Access · 1 month");
    expect(order).toHaveTextContent("AMOUNT₱449");
    expect(order).toHaveTextContent("METHODMaya");
    expect(order).toHaveTextContent("PAYMONGO REFcs_sample10006");
    expect(
      within(order)
        .getAllByRole("listitem")
        .map((step) => step.textContent),
    ).toEqual([
      expect.stringMatching(/^Checkout started\d/),
      expect.stringMatching(/^Sent to Maya\d/),
      "Waiting for Maya to confirmWAITING",
    ]);
    expect(screen.getByRole("region", { name: "STATUS NOTE" })).toHaveTextContent(
      "Maya hasn’t confirmed this payment yet.",
    );
    expect(screen.getByRole("textbox", { name: "INTERNAL NOTE" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Check status with PayMongo" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /PayMongo dashboard/ })).not.toBeInTheDocument();
    expect(screen.getByText("Refunds are issued from the PayMongo dashboard.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← All orders" })).toHaveAttribute(
      "href",
      "/admin/orders",
    );
  });

  it("links a Paid Order to the PayMongo dashboard, with no status check", async () => {
    signInAs(OWNER);
    render(await orderPage("AYC-10003"));

    expect(screen.getByRole("link", { name: /Open in PayMongo dashboard/ })).toHaveAttribute(
      "href",
      "https://dashboard.paymongo.com/payments?search=pay_sample10003",
    );
    expect(
      screen.queryByRole("button", { name: "Check status with PayMongo" }),
    ).not.toBeInTheDocument();
  });

  it("links the buyer to their Member detail page once they have a Member record", async () => {
    const paolo = getSampleStore().orders.find((order) => order.reference === "AYC-10003");
    getSampleStore().members.push({
      userId: paolo?.userId ?? "",
      email: "paolo.reyes@example.com",
      name: "Paolo Reyes",
      joinedAt: new Date().toISOString(),
    });
    signInAs(OWNER);
    render(await orderPage("AYC-10003"));

    expect(screen.getByRole("link", { name: "paolo.reyes@example.com" })).toHaveAttribute(
      "href",
      `/admin/users/${paolo?.userId}`,
    );
  });

  it("answers not found for an unknown reference", async () => {
    signInAs(OWNER);
    await expect(orderPage("AYC-99999")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends an Editor to the owners-only 403 screen", async () => {
    signInAs(EDITOR);
    await expect(orderPage("AYC-10006")).rejects.toThrow(
      "NEXT_REDIRECT /admin/denied?reason=owners-only",
    );
  });
});

describe("GET /admin/orders/export", () => {
  it("gives an Owner the filtered Orders as a CSV attachment, logged in Staff Activity", async () => {
    signInAs(OWNER);
    const response = await exportCsv("?status=paid&method=gcash");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="ayc-orders-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(csvReferences(await response.text())).toEqual(["AYC-10009", "AYC-10003"]);
    expect(getSampleStore().staffActivity).toMatchObject([
      { entity: "orders", action: "export-csv", after: { rows: 2 } },
    ]);
  });

  it("holds exactly the default list's Orders with no filters, and only the header row when none match", async () => {
    signInAs(OWNER);
    expect(csvReferences(await (await exportCsv()).text())).toEqual([
      "AYC-10008",
      "AYC-10007",
      "AYC-10006",
      "AYC-10011",
      "AYC-10009",
      "AYC-10004",
      "AYC-10003",
      "AYC-10010",
      "AYC-10002",
    ]);
    expect(csvReferences(await (await exportCsv("?q=nobody")).text())).toEqual([]);
  });

  it("gives the amount refunded: Bea's ₱300 of a Paid Order, and all of Lou's Refunded one (ticket 09)", async () => {
    signInAs(OWNER);
    const lines = (await (await exportCsv("?q=example.com")).text()).split("\r\n");
    const cells = (reference: string) =>
      lines.find((line) => line.startsWith(`${reference},`))?.split(",") ?? [];
    expect(cells("AYC-10007").slice(9, 11)).toEqual(["Paid", "300.00"]);
    expect(cells("AYC-10008").slice(9, 11)).toEqual(["Refunded", "499.00"]);
    expect(cells("AYC-10003").slice(9, 11)).toEqual(["Paid", ""]);
  });

  it("refuses an Editor and a signed-out visitor, logging nothing", async () => {
    signInAs(EDITOR);
    expect((await exportCsv()).status).toBe(403);
    jar.clear();
    expect((await exportCsv()).status).toBe(403);
    expect(getSampleStore().staffActivity).toEqual([]);
  });

  it("refuses a download another site, or a sibling site, starts, logging nothing", async () => {
    signInAs(OWNER);
    expect((await exportCsv("", { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await exportCsv("", { "sec-fetch-site": "same-site" })).status).toBe(403);
    expect(getSampleStore().staffActivity).toEqual([]);
    // The Orders screen's own request, and an address the Owner typed, export.
    expect((await exportCsv("", { "sec-fetch-site": "same-origin" })).status).toBe(200);
    expect((await exportCsv("", { "sec-fetch-site": "none" })).status).toBe(200);
    expect(getSampleStore().staffActivity).toHaveLength(2);
  });

  it("reads a repeated filter as the list does: the first value", async () => {
    signInAs(OWNER);
    const response = await exportCsv("?status=paid&status=failed&method=gcash");
    expect(csvReferences(await response.text())).toEqual(["AYC-10009", "AYC-10003"]);
  });
});
