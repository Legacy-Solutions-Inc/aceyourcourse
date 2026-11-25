import { manilaDate } from "@/lib/manila-time";
import { methodLabel } from "@/lib/payments/payment-methods";
import type { AdminOrder } from "@/services/admin.types";

import { orderItem, orderStatusLabel } from "./order-view";

// ─────────────────────────────────────────────────────────────────────────────
// The Orders list's CSV export, for the accountant who issues the official
// invoices (Phase 4, ticket 07; story 147; spec, Phase 4 planning decisions →
// Orders and sales figures), pure.
//
// - A header row always, then one row per Order, in the list's order: the
//   reference, the paid date and time in Manila, the buyer's name and email
//   as at Pay, the item, Exam and days, the amount, the Payment Method, the
//   status (as every screen shows it; "(test)" on a Test Order), the amount
//   refunded, PayMongo's payment ID, and the Invoice Request: whether there
//   is one, with its name, address and TIN. The refund and invoice cells stay
//   empty until tickets 08 and 09 fill them.
// - Amounts are plain numbers in pesos ("1299.00"), so a spreadsheet adds
//   them up.
// - RFC 4180: rows end with CRLF, and a cell holding a comma, a quote or a
//   line break is quoted, its quotes doubled. A byte-order mark goes first,
//   so Excel reads names like "Lepaña" as UTF-8.
// - Formula injection: a cell starting with =, +, -, @, a tab or a carriage
//   return would run as a formula in a spreadsheet, so it gets a ' in front
//   (OWASP's CSV injection advice). A Member's name is theirs to type.
// ─────────────────────────────────────────────────────────────────────────────

export const ORDERS_CSV_HEADER = [
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
] as const;

const BOM = "﻿";
const CRLF = "\r\n";

/** What a spreadsheet takes for the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** What makes a cell need quotes. */
const NEEDS_QUOTES = /[",\r\n]/;

/** Pure: one cell, escaped against formulas, then quoted when RFC 4180 needs it. */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const manilaClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Pure: an instant in Manila, as a spreadsheet sorts it: "2026-11-25 09:01". */
const manilaDateTime = (iso: string) => {
  const at = new Date(iso);
  return `${manilaDate(at)} ${manilaClock.format(at)}`;
};

/** Pure: centavos as a plain number of pesos: 129900 → "1299.00". */
const pesos = (centavos: number) => (centavos / 100).toFixed(2);

/** Pure: one Order's cells, in the header's order. */
function rowOf(order: AdminOrder): string[] {
  const status = orderStatusLabel(order.status);
  return [
    order.reference,
    order.paidAt ? manilaDateTime(order.paidAt) : "",
    order.buyerName ?? "",
    order.buyerEmail,
    orderItem(order),
    order.examCode,
    String(order.days),
    pesos(order.priceCentavos),
    methodLabel(order.method),
    order.livemode ? status : `${status} (test)`,
    // The amount refunded: ticket 09.
    "",
    order.paymentId ?? "",
    // Whether an invoice was requested, and its name, address and TIN: ticket 08.
    "",
    "",
    "",
    "",
  ];
}

/** Pure: the CSV of these Orders, in the order given. */
export function ordersCsv(orders: readonly AdminOrder[]): string {
  const rows = [[...ORDERS_CSV_HEADER], ...orders.map(rowOf)];
  return BOM + rows.map((cells) => cells.map(csvCell).join(",") + CRLF).join("");
}

/** Pure: the file's name, dated by today in Manila: "ayc-orders-2026-11-25.csv". */
export const ordersCsvFilename = (now: Date): string => `ayc-orders-${manilaDate(now)}.csv`;
