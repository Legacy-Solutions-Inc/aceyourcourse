import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ORDER_QUERY } from "@/lib/admin/orders-list";
import type { Order } from "@/lib/payments/order-ledger";
import type { OrderListQuery } from "@/services/admin.types";
import { samplePlanId } from "@/services/mock/plans";
import { NO_INVOICE_REQUEST } from "@/services/orders-admin.core";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// Invoice Requests on the Orders admin (Phase 4, ticket 08; stories 151j,
// 151v; spec, Phase 4 planning decisions → Payment Acknowledgement and
// Invoice Requests, Orders and sales figures), run against every arm. Owners
// filter the requests not yet sent, read one on its Order, and mark it sent
// once the invoice has gone from the support inbox: logged in Staff Activity
// once, and a second mark changes nothing. The CSV carries each request's
// name, address and TIN. An Editor is refused all of it.
//
// The data, timed from BOOT (10:00 on 25 Nov 2026 in Manila):
//   AYC-10001 Bea, CE 3 months, Paid, 2 days ago; Bea asks for its invoice
//   AYC-10002 Bea, CE 1 month, Paid, 1 day ago; no request
//   AYC-10003 Paolo, ME 1 month, Pending, 1 hour ago
const BOOT = new Date("2026-11-25T02:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const PAOLO = {
  userId: "2a4c6e80-1b3d-4f5a-9c7e-0d2f4a6b8c1e",
  email: "paolo.reyes@example.com",
  name: "Paolo Reyes",
};
const DETAILS = {
  name: "Sample Builders Inc.",
  address: "12 Sample St, Jaro, Iloilo City",
  tin: "123456789000",
};

const at = (ms: number) => new Date(BOOT.getTime() + ms).toISOString();

/** A fixture Order: Bea's, CE 3 months, Paid by GCash, live. */
function order(reference: string, fields: Partial<Order>): Order {
  const createdAt = fields.createdAt ?? at(-HOUR);
  const status = fields.status ?? "paid";
  const paidAt =
    status === "paid" ? new Date(new Date(createdAt).getTime() + MINUTE).toISOString() : null;
  return {
    id: `00000000-0000-4000-8000-${reference.slice(4).padStart(12, "0")}`,
    reference,
    userId: BEA.userId,
    examCode: "CE",
    planId: samplePlanId("CE", 90),
    courseId: null,
    planName: "CE All-Access",
    days: 90,
    priceCentavos: 129_900,
    method: "gcash",
    livemode: true,
    checkoutId: null,
    paymentId: status === "paid" ? `pay_Sample${reference.slice(4)}` : null,
    buyerName: BEA.name,
    buyerEmail: BEA.email,
    statusChangedAt: paidAt ?? createdAt,
    paidWithoutAccount: false,
    paidAlreadyOwned: false,
    ...fields,
    status,
    createdAt,
    paidAt,
  };
}

const REQUESTED = order("AYC-10001", { createdAt: at(-2 * DAY) });
const NOT_REQUESTED = order("AYC-10002", {
  planId: samplePlanId("CE", 30),
  courseId: null,
  days: 30,
  priceCentavos: 49_900,
  createdAt: at(-DAY),
});
const PENDING = order("AYC-10003", {
  userId: PAOLO.userId,
  buyerName: PAOLO.name,
  buyerEmail: PAOLO.email,
  examCode: "ME",
  planId: samplePlanId("ME", 30),
  courseId: null,
  planName: "ME All-Access",
  days: 30,
  priceCentavos: 44_900,
  method: "maya",
  status: "pending",
  createdAt: at(-HOUR),
});

const query = (fields: Partial<OrderListQuery> = {}): OrderListQuery => ({
  ...DEFAULT_ORDER_QUERY,
  ...fields,
});

/** The CSV's lines without the byte-order mark. */
const csvLines = (csv: string) => csv.replace("﻿", "").split("\r\n").slice(0, -1);

describe.each(ADMIN_ARMS)("Admin seam: Invoice Requests ($name)", (arm) => {
  const { seam, member } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));

  async function shownReferences(fields: Partial<OrderListQuery> = {}) {
    const listed = await seam.listOrdersForAdmin(OWNER, query(fields));
    if (!listed.ok) throw new Error(`The Orders list refused an Owner: ${listed.error.kind}`);
    return listed.value.rows.map((row) => row.reference);
  }

  async function invoiceOn(reference: string) {
    const found = await seam.getOrderForAdmin(OWNER, reference);
    if (!found.ok) throw new Error(`The Order detail refused an Owner: ${found.error.kind}`);
    return found.value.order.invoice;
  }

  const memberSees = async (reference: string) =>
    (await member.getMemberOrder(BEA.userId, reference))?.invoice ?? null;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    await member.getOrCreateMember(BEA);
    await member.getOrCreateMember(PAOLO);
    for (const each of [REQUESTED, NOT_REQUESTED, PENDING]) await arm.putOrder(each);
    later(-HOUR);
    const asked = await member.requestInvoice(BEA.userId, REQUESTED.reference, DETAILS);
    if (!asked.ok) throw new Error(`The request was refused: ${asked.reason}`);
    later(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("the Orders list", () => {
    it("filters the Orders with an invoice requested and not yet sent", async () => {
      expect(await shownReferences()).toEqual(["AYC-10003", "AYC-10002", "AYC-10001"]);
      expect(await shownReferences({ invoiceRequested: true })).toEqual(["AYC-10001"]);
    });

    it("drops an Order from the filter once its invoice is marked sent", async () => {
      await seam.markInvoiceSent(OWNER, REQUESTED.reference);

      expect(await shownReferences({ invoiceRequested: true })).toEqual([]);
      expect(await shownReferences()).toContain("AYC-10001");
    });

    it("shows each Order's request with it", async () => {
      const listed = await seam.listOrdersForAdmin(OWNER, query());
      const rows = listed.ok ? listed.value.rows : [];

      expect(rows.map((row) => [row.reference, row.invoice?.name ?? null])).toEqual([
        ["AYC-10003", null],
        ["AYC-10002", null],
        ["AYC-10001", DETAILS.name],
      ]);
    });
  });

  describe("the Order detail", () => {
    it("shows the request's name, address and TIN, and when it was asked for", async () => {
      expect(await invoiceOn(REQUESTED.reference)).toEqual({
        orderId: REQUESTED.id,
        name: "Sample Builders Inc.",
        address: "12 Sample St, Jaro, Iloilo City",
        tin: "123-456-789-000",
        requestedAt: at(-HOUR),
        sentAt: null,
        sentBy: null,
      });
      expect(await invoiceOn(NOT_REQUESTED.reference)).toBeNull();
    });

    it("refuses an Editor the request's details", async () => {
      expect(await seam.getOrderForAdmin(EDITOR, REQUESTED.reference)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });
  });

  describe("markInvoiceSent", () => {
    it("marks the request sent, by whom, logs it in Staff Activity, and the Member sees it sent", async () => {
      later(MINUTE);

      const marked = await seam.markInvoiceSent(OWNER, REQUESTED.reference);

      const sent = {
        orderId: REQUESTED.id,
        name: "Sample Builders Inc.",
        address: "12 Sample St, Jaro, Iloilo City",
        tin: "123-456-789-000",
        requestedAt: at(-HOUR),
        sentAt: at(MINUTE),
        sentBy: { email: OWNER.email, name: OWNER.name },
      };
      expect(marked).toEqual({ ok: true, tags: [], value: sent });
      expect(await invoiceOn(REQUESTED.reference)).toEqual(sent);
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "order",
          entityId: REQUESTED.id,
          action: "invoice-sent",
          before: { reference: "AYC-10001", invoiceSentAt: null },
          after: { reference: "AYC-10001", invoiceSentAt: at(MINUTE) },
        },
      ]);
      expect(await memberSees(REQUESTED.reference)).toEqual({
        status: "sent",
        requestedAt: at(-HOUR),
        sentAt: at(MINUTE),
      });
    });

    it("changes nothing and logs nothing when it's marked sent again", async () => {
      later(MINUTE);
      const first = await seam.markInvoiceSent(OWNER, REQUESTED.reference);
      const activity = await arm.staffActivity();
      later(HOUR);

      const again = await seam.markInvoiceSent(OWNER, REQUESTED.reference);

      expect(again).toEqual(first);
      expect(await arm.staffActivity()).toEqual(activity);
      expect((await invoiceOn(REQUESTED.reference))?.sentAt).toBe(at(MINUTE));
    });

    it("refuses an Editor on the server, changing and logging nothing", async () => {
      expect(await seam.markInvoiceSent(EDITOR, REQUESTED.reference)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect((await invoiceOn(REQUESTED.reference))?.sentAt).toBeNull();
      expect(await arm.staffActivity()).toEqual([]);
      expect(await memberSees(REQUESTED.reference)).toMatchObject({ status: "requested" });
    });

    it("refuses an Order with no request, and answers not-found for one that isn't there", async () => {
      expect(await seam.markInvoiceSent(OWNER, NOT_REQUESTED.reference)).toMatchObject({
        ok: false,
        error: { kind: "invalid", formError: NO_INVOICE_REQUEST },
      });
      expect(await seam.markInvoiceSent(OWNER, "AYC-99999")).toMatchObject({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.markInvoiceSent(OWNER, "nonsense")).toMatchObject({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });

  describe("the CSV", () => {
    it("fills each Order's invoice columns: requested, with its name, address and TIN", async () => {
      const exported = await seam.exportOrdersCsv(OWNER, query());
      const lines = exported.ok ? csvLines(exported.value.csv) : [];

      // The Account deleted column (ticket 14) comes after them.
      expect(lines[0]).toMatch(
        /,Invoice requested,Invoice name,Invoice address,Invoice TIN,Account deleted$/,
      );
      const rowOf = (reference: string) => lines.find((line) => line.startsWith(reference));
      expect(rowOf("AYC-10001")).toMatch(
        /,Yes,Sample Builders Inc\.,"12 Sample St, Jaro, Iloilo City",123-456-789-000,No$/,
      );
      expect(rowOf("AYC-10002")).toMatch(/,No,,,,No$/);
    });

    it("holds just the requests to send under the filter", async () => {
      const exported = await seam.exportOrdersCsv(OWNER, query({ invoiceRequested: true }));
      const lines = exported.ok ? csvLines(exported.value.csv) : [];

      expect(lines.slice(1).map((line) => line.split(",")[0])).toEqual(["AYC-10001"]);
    });
  });
});
