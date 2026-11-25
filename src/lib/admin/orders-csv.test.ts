import { describe, expect, it } from "vitest";

import type { AdminOrder } from "@/services/admin.types";

import { csvCell, ORDERS_CSV_HEADER, ordersCsv, ordersCsvFilename } from "./orders-csv";

// The Orders CSV for the accountant (Phase 4, ticket 07; story 147; spec,
// Phase 4 planning decisions → Orders and sales figures), pure: a header row
// always, then one row per Order, RFC 4180 quoted, with every cell that a
// spreadsheet would run as a formula escaped. The Invoice Request (ticket 08)
// and the amount refunded (ticket 09) have their own columns.

const BOM = "﻿";
const CRLF = "\r\n";

function order(fields: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "id-1",
    reference: "AYC-10482",
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
    checkoutId: "cs_LiveCheckout0001",
    paymentId: "pay_LivePayment0001",
    buyerName: "Maria Santos",
    buyerEmail: "maria.santos@example.com",
    createdAt: "2026-11-25T01:00:00.000Z",
    // 9:01 in Manila on 25 Nov.
    paidAt: "2026-11-25T01:01:00.000Z",
    statusChangedAt: "2026-11-25T01:01:00.000Z",
    ...fields,
  };
}

/** The CSV's rows, split back into lines (cells here hold no line breaks). */
const lines = (csv: string) => csv.replace(BOM, "").split(CRLF).slice(0, -1);

describe("ordersCsv", () => {
  it("has only the header row for no Orders", () => {
    expect(ordersCsv([])).toBe(`${BOM}${ORDERS_CSV_HEADER.join(",")}${CRLF}`);
  });

  it("names every column the accountant needs, in order", () => {
    expect(ORDERS_CSV_HEADER).toEqual([
      "Reference",
      "Paid at (Manila)",
      "Member name",
      "Member email",
      "Item",
      "Exam",
      "Days",
      "Amount (PHP)",
      "Payment method",
      "Status",
      "Amount refunded (PHP)",
      "PayMongo payment ID",
      "Invoice requested",
      "Invoice name",
      "Invoice address",
      "Invoice TIN",
    ]);
  });

  it("gives a Paid Order its paid time in Manila, its amount as a plain number, an empty refund cell and No invoice", () => {
    expect(lines(ordersCsv([order()]))[1]).toBe(
      [
        "AYC-10482",
        "2026-11-25 09:01",
        "Maria Santos",
        "maria.santos@example.com",
        "CE All-Access · 3 months",
        "CE",
        "90",
        "1299.00",
        "GCash",
        "Paid",
        "",
        "pay_LivePayment0001",
        "No",
        "",
        "",
        "",
      ].join(","),
    );
  });

  it("gives an Order's Invoice Request: Yes, with its name, address (quoted for its comma) and TIN", () => {
    const requested = order({
      invoice: {
        orderId: "id-AYC-10482",
        name: "Sample Builders Inc.",
        address: "12 Sample St, Jaro",
        tin: "123-456-789-000",
        requestedAt: "2026-11-25T03:00:00.000Z",
        sentAt: null,
        sentBy: null,
      },
    });
    expect(lines(ordersCsv([requested]))[1]).toMatch(
      /,Yes,Sample Builders Inc\.,"12 Sample St, Jaro",123-456-789-000$/,
    );
    expect(
      lines(ordersCsv([order({ invoice: { ...requested.invoice!, tin: null, name: "=Bea" } })]))[1],
    ).toMatch(/,Yes,'=Bea,"12 Sample St, Jaro",$/);
  });

  it("gives the amount refunded (ticket 09): a partial refund of a Paid Order, and a Refunded one's whole amount", () => {
    const [, partial, refunded] = lines(
      ordersCsv([
        order({ refundedCentavos: 30_000 }),
        order({ status: "refunded", recordedStatus: "refunded", refundedCentavos: 129_900 }),
      ]),
    );
    expect(partial?.split(",").slice(9, 11)).toEqual(["Paid", "300.00"]);
    expect(refunded?.split(",").slice(9, 11)).toEqual(["Refunded", "1299.00"]);
  });

  it("leaves a Pending Order's paid time and payment ID empty, and shows its status as every screen does", () => {
    const [, pending, expired] = lines(
      ordersCsv([
        order({ status: "pending", recordedStatus: "pending", paidAt: null, paymentId: null }),
        order({ status: "expired", recordedStatus: "pending", paidAt: null, paymentId: null }),
      ]),
    );
    expect(pending?.split(",").slice(0, 2)).toEqual(["AYC-10482", ""]);
    expect(pending?.split(",")[9]).toBe("Pending");
    expect(pending?.split(",")[11]).toBe("");
    expect(expired?.split(",")[9]).toBe("Expired");
  });

  it("marks a Test Order's status, and keeps an Order with no buyer name", () => {
    const [, row] = lines(ordersCsv([order({ livemode: false, buyerName: null })]));
    expect(row?.split(",")[2]).toBe("");
    expect(row?.split(",")[9]).toBe("Paid (test)");
  });

  it("writes one row per Order, in the order given", () => {
    const rows = lines(
      ordersCsv([order({ reference: "AYC-10002" }), order({ reference: "AYC-10001" })]),
    );
    expect(rows.slice(1).map((row) => row.split(",")[0])).toEqual(["AYC-10002", "AYC-10001"]);
  });

  it("escapes a Member name that a spreadsheet would run as a formula", () => {
    const [, row] = lines(ordersCsv([order({ buyerName: '=HYPERLINK("https://x.test","Hi")' })]));
    expect(row).toContain(`"'=HYPERLINK(""https://x.test"",""Hi"")"`);
  });
});

describe("csvCell", () => {
  it("leaves plain text as it is", () => {
    expect(csvCell("Maria Santos")).toBe("Maria Santos");
    expect(csvCell("")).toBe("");
  });

  it("quotes a cell with a comma, a quote or a line break, doubling its quotes", () => {
    expect(csvCell("Santos, Maria")).toBe('"Santos, Maria"');
    expect(csvCell('Ana "Annie" Cruz')).toBe('"Ana ""Annie"" Cruz"');
    expect(csvCell("Line one\nLine two")).toBe('"Line one\nLine two"');
  });

  it.each([
    ["=SUM(A1:A9)", "'=SUM(A1:A9)"],
    ["+639171234567", "'+639171234567"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
  ])("escapes %s, which starts like a formula", (value, escaped) => {
    expect(csvCell(value)).toBe(escaped);
  });

  it("escapes a cell starting with a tab or a carriage return, and quotes the carriage return", () => {
    expect(csvCell("\t=1+1")).toBe("'\t=1+1");
    expect(csvCell("\r=1+1")).toBe('"\'\r=1+1"');
  });

  it("escapes a formula that also needs quoting", () => {
    expect(csvCell("=1,2")).toBe('"\'=1,2"');
  });
});

describe("ordersCsvFilename", () => {
  it("is dated by today in Manila", () => {
    // 26 Nov, 00:30 in Manila.
    expect(ordersCsvFilename(new Date("2026-11-25T16:30:00.000Z"))).toBe(
      "ayc-orders-2026-11-26.csv",
    );
  });
});
