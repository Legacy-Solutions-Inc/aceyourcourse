import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ORDERS_CSV_HEADER } from "@/lib/admin/orders-csv";
import { DEFAULT_ORDER_QUERY } from "@/lib/admin/orders-list";
import { type Order, PAYMONGO_SYSTEM_ACTOR } from "@/lib/payments/order-ledger";
import { ORDER_NOTE_TOO_LONG } from "@/services/admin.schema";
import type { AdminOrder, OrderListQuery } from "@/services/admin.types";
import { samplePlanId } from "@/services/mock/plans";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentsClient } from "@/services/payments.types";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// Orders & payments (Phase 4, ticket 07; stories 147, 148, 151o and 151z;
// spec, Phase 4 → Orders Admin; Phase 4 planning decisions → Orders and sales
// figures), run against every arm. Owners only: an Editor is refused the
// list, the detail, the CSV, the note and the status check.
//
// The data, timed from BOOT (10:00 on 25 Nov 2026 in Manila):
//   AYC-10001 Bea, CE 3 months, GCash, Paid, 2 days ago
//   AYC-10002 Paolo, ME 1 month, Maya, Pending, 1 hour ago
//   AYC-10003 Paolo, ME 1 month, Card, Failed, 3 days ago
//   AYC-10004 Bea, CE 1 month, GCash, Paid, a Test Order, 1 day ago
//   AYC-10005 Bea, CE 6 months, GCash, Paid, 40 days ago (outside the last 30)
//   AYC-10006 an account since deleted, CE 1 month, QR Ph, Paid, 5 days ago
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

const at = (ms: number) => new Date(BOOT.getTime() + ms).toISOString();

/** A fixture Order, as a Member's Pay and its outcome leave one: Bea's, CE 3 months, Paid by GCash, live. */
function order(reference: string, fields: Partial<Order>): Order {
  const createdAt = fields.createdAt ?? at(-HOUR);
  const status = fields.status ?? "paid";
  const settled = status === "paid" || status === "refunded";
  const paidAt = settled
    ? (fields.paidAt ?? new Date(new Date(createdAt).getTime() + 2 * MINUTE).toISOString())
    : null;
  return {
    // "AYC-10001" → "00000000-0000-4000-8000-000000010001".
    id: `00000000-0000-4000-8000-${reference.slice(4).padStart(12, "0")}`,
    reference,
    userId: BEA.userId,
    examCode: "CE",
    planId: samplePlanId("CE", 90),
    planName: "CE All-Access",
    days: 90,
    priceCentavos: 129_900,
    method: "gcash",
    livemode: true,
    checkoutId: null,
    paymentId: settled ? `pay_Sample${reference.slice(4)}` : null,
    buyerName: BEA.name,
    buyerEmail: BEA.email,
    statusChangedAt: paidAt ?? createdAt,
    paidWithoutAccount: false,
    ...fields,
    status,
    createdAt,
    paidAt,
  };
}

/** Paolo's ME 1 month Order's fields. */
const PAOLO_ME = {
  userId: PAOLO.userId,
  buyerName: PAOLO.name,
  buyerEmail: PAOLO.email,
  examCode: "ME",
  planId: samplePlanId("ME", 30),
  planName: "ME All-Access",
  days: 30,
  priceCentavos: 44_900,
} as const;

const PAID_GCASH = order("AYC-10001", { createdAt: at(-2 * DAY) });
const PENDING_MAYA = order("AYC-10002", {
  ...PAOLO_ME,
  method: "maya",
  status: "pending",
  createdAt: at(-HOUR),
});
const FAILED_CARD = order("AYC-10003", {
  ...PAOLO_ME,
  method: "card",
  status: "failed",
  createdAt: at(-3 * DAY),
  statusChangedAt: at(-3 * DAY + MINUTE),
});
const TEST_ORDER = order("AYC-10004", {
  planId: samplePlanId("CE", 30),
  days: 30,
  priceCentavos: 49_900,
  livemode: false,
  createdAt: at(-DAY),
});
const OLD_GCASH = order("AYC-10005", {
  planId: samplePlanId("CE", 180),
  days: 180,
  priceCentavos: 229_900,
  createdAt: at(-40 * DAY),
});
const DELETED = order("AYC-10006", {
  userId: null,
  buyerName: "Gone Member",
  buyerEmail: "gone@example.com",
  planId: samplePlanId("CE", 30),
  days: 30,
  priceCentavos: 49_900,
  method: "qrph",
  createdAt: at(-5 * DAY),
});

const ORDERS = [PAID_GCASH, PENDING_MAYA, FAILED_CARD, TEST_ORDER, OLD_GCASH, DELETED];

const query = (fields: Partial<OrderListQuery> = {}): OrderListQuery => ({
  ...DEFAULT_ORDER_QUERY,
  ...fields,
});

const references = (rows: readonly { reference: string }[]) => rows.map((row) => row.reference);

/** An Order as the Admin shows it, as stored, at a time when none is overdue. */
const shown = (stored: Order, fields: Partial<AdminOrder> = {}): AdminOrder => ({
  ...stored,
  recordedStatus: stored.status,
  paidAfterExpiry: false,
  invoice: null,
  refunds: [],
  refundedCentavos: 0,
  ...fields,
});

/** The CSV's lines without the byte-order mark (cells here hold no line breaks). */
const csvLines = (csv: string) => csv.replace("﻿", "").split("\r\n").slice(0, -1);

describe.each(ADMIN_ARMS)("Admin seam: Orders ($name)", (arm) => {
  const { seam, member } = arm;
  const later = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));
  let fake: FakePaymentsClient;

  async function list(fields: Partial<OrderListQuery> = {}) {
    const listed = await seam.listOrdersForAdmin(OWNER, query(fields));
    if (!listed.ok) throw new Error(`The Orders list refused an Owner: ${listed.error.kind}`);
    return listed.value;
  }

  async function detail(reference: string) {
    const found = await seam.getOrderForAdmin(OWNER, reference);
    if (!found.ok) throw new Error(`The Order detail refused an Owner: ${found.error.kind}`);
    return found.value;
  }

  /** Everything a refused call must leave as it was. */
  const snapshot = async () => ({
    orders: await arm.orders(),
    activity: await arm.staffActivity(),
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    await member.getOrCreateMember(BEA);
    await member.getOrCreateMember(PAOLO);
    for (const each of ORDERS) await arm.putOrder(each);
    fake = createFakePaymentsClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("listOrdersForAdmin", () => {
    it("lists the last 30 days' Orders, newest first, without Test Orders, with their tiles", async () => {
      const listed = await seam.listOrdersForAdmin(OWNER, query());

      expect(listed).toMatchObject({ ok: true, tags: [] });
      if (!listed.ok) return;
      expect(listed.value.query).toEqual(DEFAULT_ORDER_QUERY);
      expect(listed.value.rows).toEqual([
        shown(PENDING_MAYA),
        shown(PAID_GCASH),
        shown(FAILED_CARD),
        shown(DELETED),
      ]);
      expect(listed.value.stats).toEqual({
        paidCentavos: 129_900 + 49_900,
        orders: 4,
        pending: 1,
        failed: 1,
      });
    });

    it("finds an Order by its reference, and the Orders of a Member's email", async () => {
      expect(references((await list({ q: "ayc-10003" })).rows)).toEqual(["AYC-10003"]);
      expect(references((await list({ q: "PAOLO.REYES@" })).rows)).toEqual([
        "AYC-10002",
        "AYC-10003",
      ]);
    });

    it("filters by GCash and Paid, and widens to all time", async () => {
      expect(references((await list({ method: "gcash", status: "paid" })).rows)).toEqual([
        "AYC-10001",
      ]);
      expect(
        references((await list({ method: "gcash", status: "paid", range: "all" })).rows),
      ).toEqual(["AYC-10001", "AYC-10005"]);
    });

    it("shows Test Orders only when they're included", async () => {
      expect(references((await list()).rows)).not.toContain("AYC-10004");
      const withTests = await list({ tests: true });
      expect(references(withTests.rows)).toEqual([
        "AYC-10002",
        "AYC-10004",
        "AYC-10001",
        "AYC-10003",
        "AYC-10006",
      ]);
      expect(withTests.rows[1]).toMatchObject({ livemode: false });
    });

    it("reads a Pending Order past its 24 hours as Expired, keeping its recorded status", async () => {
      later(25 * HOUR);

      const expired = await list({ status: "expired" });

      expect(expired.rows).toEqual([shown(PENDING_MAYA, { status: "expired" })]);
      expect(expired.rows[0]?.recordedStatus).toBe("pending");
      expect((await list({ status: "pending" })).rows).toEqual([]);
    });

    it("uses Manila day boundaries: 00:30 on the range's first day is in, 23:59 the day before is out", async () => {
      // The last 7 days from BOOT start at midnight in Manila on 19 Nov.
      await arm.putOrder(order("AYC-10007", { createdAt: "2026-11-18T16:30:00.000Z" }));
      await arm.putOrder(order("AYC-10008", { createdAt: "2026-11-18T15:59:00.000Z" }));

      const rows = references((await list({ range: "7d" })).rows);

      expect(rows).toContain("AYC-10007");
      expect(rows).not.toContain("AYC-10008");
    });

    it("matches nothing for a search no Order holds, with every tile at zero", async () => {
      const none = await list({ q: "nobody@example.com" });
      expect(none.rows).toEqual([]);
      expect(none.stats).toEqual({ paidCentavos: 0, orders: 0, pending: 0, failed: 0 });
    });

    it("refuses an Editor, and a query it can't read", async () => {
      expect(await seam.listOrdersForAdmin(EDITOR, query())).toEqual({
        ok: false,
        error: { kind: "forbidden", message: expect.any(String) },
      });
      expect(
        await seam.listOrdersForAdmin(OWNER, {
          ...query(),
          status: "lost",
        } as unknown as OrderListQuery),
      ).toMatchObject({ ok: false, error: { kind: "invalid" } });
    });
  });

  describe("getOrderForAdmin", () => {
    it("gives an Order with its Member, and an empty internal note stamped at its making", async () => {
      expect(await seam.getOrderForAdmin(OWNER, "AYC-10001")).toEqual({
        ok: true,
        tags: [],
        value: {
          order: shown(PAID_GCASH),
          memberUserId: BEA.userId,
          note: {
            reference: "AYC-10001",
            text: "",
            stamp: { savedAt: PAID_GCASH.createdAt, savedBy: null },
          },
        },
      });
    });

    it("has no Member to link to once the account is deleted", async () => {
      expect((await detail("AYC-10006")).memberUserId).toBeNull();
    });

    it("answers not-found for an unknown reference, or one that isn't a reference", async () => {
      expect(await seam.getOrderForAdmin(OWNER, "AYC-99999")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.getOrderForAdmin(OWNER, "not-a-reference")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses an Editor", async () => {
      expect(await seam.getOrderForAdmin(EDITOR, "AYC-10001")).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });
  });

  describe("saveOrderNote", () => {
    const opened = async (reference: string) => (await detail(reference)).note.stamp;

    it("saves the note, only for Admins, with its stamp and Staff Activity", async () => {
      const stamp = await opened("AYC-10002");
      later(MINUTE);

      const saved = await seam.saveOrderNote(
        OWNER,
        { reference: "AYC-10002", note: "  Member emailed 25 Nov. Told them to wait for Maya.  " },
        { savedAt: stamp.savedAt },
      );

      expect(saved).toEqual({
        ok: true,
        tags: [],
        value: {
          reference: "AYC-10002",
          text: "Member emailed 25 Nov. Told them to wait for Maya.",
          stamp: { savedAt: at(MINUTE), savedBy: OWNER.name },
        },
      });
      expect((await detail("AYC-10002")).note).toEqual(saved.ok && saved.value);
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "order",
          entityId: PENDING_MAYA.id,
          action: "note",
          before: { reference: "AYC-10002", note: "" },
          after: {
            reference: "AYC-10002",
            note: "Member emailed 25 Nov. Told them to wait for Maya.",
          },
        },
      ]);
      // The Order itself is unchanged.
      expect((await arm.orders()).find((o) => o.reference === "AYC-10002")).toEqual(PENDING_MAYA);
    });

    it("clears the note with a blank one", async () => {
      const first = await seam.saveOrderNote(
        OWNER,
        { reference: "AYC-10002", note: "Waiting" },
        { savedAt: (await opened("AYC-10002")).savedAt },
      );
      if (!first.ok) throw new Error("The first note wasn't saved");
      later(MINUTE);

      const cleared = await seam.saveOrderNote(
        OWNER,
        { reference: "AYC-10002", note: "   " },
        { savedAt: first.value.stamp.savedAt },
      );

      expect(cleared).toMatchObject({ ok: true, value: { text: "" } });
      expect((await detail("AYC-10002")).note.text).toBe("");
    });

    it("refuses a stale note with the newer save, changing nothing", async () => {
      const stamp = await opened("AYC-10002");
      later(MINUTE);
      await seam.saveOrderNote(
        OWNER,
        { reference: "AYC-10002", note: "First" },
        { savedAt: stamp.savedAt },
      );
      later(2 * MINUTE);
      const before = await snapshot();

      expect(
        await seam.saveOrderNote(
          OWNER,
          { reference: "AYC-10002", note: "Second, from an older page" },
          { savedAt: stamp.savedAt },
        ),
      ).toEqual({
        ok: false,
        error: { kind: "conflict", savedAt: at(MINUTE), savedBy: OWNER.name },
      });
      expect(await snapshot()).toEqual(before);
      expect((await detail("AYC-10002")).note.text).toBe("First");
    });

    it("refuses a note that's too long, an unknown Order and an Editor, changing nothing", async () => {
      const { savedAt } = await opened("AYC-10002");
      const before = await snapshot();

      expect(
        await seam.saveOrderNote(
          OWNER,
          { reference: "AYC-10002", note: "x".repeat(2_001) },
          { savedAt },
        ),
      ).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { note: [ORDER_NOTE_TOO_LONG] } },
      });
      expect(
        await seam.saveOrderNote(OWNER, { reference: "AYC-99999", note: "Hi" }, { savedAt }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
      expect(
        await seam.saveOrderNote(EDITOR, { reference: "AYC-10002", note: "Hi" }, { savedAt }),
      ).toMatchObject({ ok: false, error: { kind: "forbidden" } });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("checkOrderWithPayMongo", () => {
    const meEnd = async () =>
      (await member.listAccessPasses(PAOLO.userId)).find((pass) => pass.examCode === "ME")
        ?.endsAt ?? null;

    it("makes a Pending Order Paid when PayMongo says it's paid, granting its days", async () => {
      fake.simulate(PENDING_MAYA.id, "paid");
      later(MINUTE);

      const checked = await seam.checkOrderWithPayMongo(OWNER, "AYC-10002", fake);

      expect(checked).toMatchObject({
        ok: true,
        tags: [],
        value: {
          outcome: "paid",
          order: { reference: "AYC-10002", status: "paid", paidAt: at(MINUTE) },
        },
      });
      expect(await meEnd()).toBe(at(MINUTE + 30 * DAY));
      expect((await arm.staffActivity()).map(({ actor, action }) => ({ actor, action }))).toEqual([
        { actor: PAYMONGO_SYSTEM_ACTOR, action: "order-paid" },
      ]);
      expect(fake.statusChecks).toEqual([
        { orderId: PENDING_MAYA.id, reference: "AYC-10002", checkoutId: null },
      ]);
    });

    it("says it's still pending at Maya when PayMongo has no outcome, changing nothing", async () => {
      const before = await snapshot();

      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10002", fake)).toEqual({
        ok: true,
        tags: [],
        value: { outcome: "still-pending", order: shown(PENDING_MAYA) },
      });
      expect(await snapshot()).toEqual(before);
      expect(fake.statusChecks).toHaveLength(1);
    });

    it("records Failed when PayMongo says the payment failed", async () => {
      fake.simulate(PENDING_MAYA.id, "failed");

      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10002", fake)).toMatchObject({
        ok: true,
        value: { outcome: "failed", order: { status: "failed" } },
      });
      expect(await meEnd()).toBeNull();
    });

    it("still counts a late payment on an Order past its 24 hours, as Paid after expiry", async () => {
      fake.simulate(PENDING_MAYA.id, "paid");
      later(26 * HOUR);

      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10002", fake)).toMatchObject({
        ok: true,
        value: { outcome: "paid", order: { status: "paid", paidAfterExpiry: true } },
      });
    });

    it("says PayMongo couldn't say when it answers nothing it can trust, changing nothing", async () => {
      const unsure: PaymentsClient = {
        ...fake,
        checkoutStatus: async () => ({ status: "unknown" }),
      };
      const before = await snapshot();

      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10002", unsure)).toMatchObject({
        ok: true,
        value: { outcome: "unknown", order: { status: "pending" } },
      });
      expect(await snapshot()).toEqual(before);
    });

    it("changes nothing and asks nothing for an Order that isn't Pending", async () => {
      fake.simulate(FAILED_CARD.id, "paid");
      const before = await snapshot();

      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10001", fake)).toEqual({
        ok: true,
        tags: [],
        value: { outcome: "not-pending", order: shown(PAID_GCASH) },
      });
      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10003", fake)).toMatchObject({
        ok: true,
        value: { outcome: "not-pending", order: { status: "failed" } },
      });
      expect(fake.statusChecks).toEqual([]);
      expect(await snapshot()).toEqual(before);
    });

    it("refuses with no payments client, an unknown Order and an Editor, asking nothing", async () => {
      const before = await snapshot();

      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-10002", null)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: expect.any(String) },
      });
      expect(await seam.checkOrderWithPayMongo(OWNER, "AYC-99999", fake)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.checkOrderWithPayMongo(EDITOR, "AYC-10002", fake)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(fake.statusChecks).toEqual([]);
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("exportOrdersCsv", () => {
    it("holds exactly the filtered Orders, in the list's order, and is logged in Staff Activity", async () => {
      later(MINUTE);
      const exported = await seam.exportOrdersCsv(
        OWNER,
        query({ method: "gcash", status: "paid" }),
      );

      expect(exported).toMatchObject({
        ok: true,
        tags: [],
        value: { filename: "ayc-orders-2026-11-25.csv", rows: 1 },
      });
      if (!exported.ok) return;
      const lines = csvLines(exported.value.csv);
      expect(lines[0]).toBe(ORDERS_CSV_HEADER.join(","));
      expect(lines.slice(1).map((line) => line.split(",")[0])).toEqual(["AYC-10001"]);
      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE),
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "orders",
          entityId: "csv",
          action: "export-csv",
          before: null,
          after: {
            status: "paid",
            method: "gcash",
            range: "30d",
            tests: false,
            invoiceRequested: false,
            paidAfterExpiry: false,
            paidWithoutAccount: false,
            searched: false,
            rows: 1,
          },
        },
      ]);
    });

    it("holds every Order the default list shows", async () => {
      const exported = await seam.exportOrdersCsv(OWNER, query());
      if (!exported.ok) throw new Error("The export refused an Owner");
      expect(
        csvLines(exported.value.csv)
          .slice(1)
          .map((line) => line.split(",")[0]),
      ).toEqual(["AYC-10002", "AYC-10001", "AYC-10003", "AYC-10006"]);
    });

    it("has only the header row for a filter nothing matches", async () => {
      const exported = await seam.exportOrdersCsv(OWNER, query({ q: "nobody@example.com" }));
      expect(exported).toMatchObject({ ok: true, value: { rows: 0 } });
      if (!exported.ok) return;
      expect(csvLines(exported.value.csv)).toEqual([ORDERS_CSV_HEADER.join(",")]);
      expect(await arm.staffActivity()).toMatchObject([
        { action: "export-csv", after: { searched: true, rows: 0 } },
      ]);
    });

    it("refuses an Editor, logging nothing", async () => {
      expect(await seam.exportOrdersCsv(EDITOR, query())).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });

  describe("the Member detail page's Orders", () => {
    it("lists every Order of the Member's, Test Orders too, newest first", async () => {
      const found = await seam.getMemberForAdmin(OWNER, BEA.userId);
      if (!found.ok) throw new Error("The Member detail refused an Owner");
      expect(references(found.value.orders)).toEqual(["AYC-10004", "AYC-10001", "AYC-10005"]);
      expect(found.value.orders[0]).toEqual(shown(TEST_ORDER));
    });

    it("lists none for a Member who has never paid", async () => {
      await member.getOrCreateMember({
        userId: "6b8d0f2a-4c6e-4a8b-9d1f-3e5a7c9b1d3f",
        email: "stranger@example.com",
        name: null,
      });
      const found = await seam.getMemberForAdmin(OWNER, "6b8d0f2a-4c6e-4a8b-9d1f-3e5a7c9b1d3f");
      expect(found).toMatchObject({ ok: true, value: { orders: [] } });
    });
  });

  // Ticket 09: refunds are made in the PayMongo dashboard; its events record
  // them through the Member seam, and every Admin read shows them.
  describe("refunds PayMongo's events recorded", () => {
    const refundOf = (reference: string, refunds: { id: string; amountCentavos: number }[]) =>
      member.recordPaymentEvent({
        id: `evt_Refund${reference.slice(4)}_${refunds.map(({ id }) => id).join("_")}`,
        type: "payment.refund.updated",
        outcome: "refund",
        checkoutId: null,
        orderId: null,
        reference: null,
        paymentId: `pay_Sample${reference.slice(4)}`,
        livemode: true,
        refunds: refunds.map((refund) => ({
          ...refund,
          status: "succeeded",
          refundedAt: new Date().toISOString(),
        })),
      });

    it("shows a partial refund's amount on a Paid Order in the list, the detail, the Member's page and the CSV", async () => {
      later(HOUR);
      expect(await refundOf("AYC-10001", [{ id: "ref_Part", amountCentavos: 30_000 }])).toBe(
        "applied",
      );
      const refund = {
        id: "ref_Part",
        orderId: PAID_GCASH.id,
        amountCentavos: 30_000,
        status: "succeeded",
        refundedAt: at(HOUR),
      };

      const row = (await list()).rows.find(({ reference }) => reference === "AYC-10001");
      expect(row).toMatchObject({ status: "paid", refundedCentavos: 30_000, refunds: [refund] });
      expect((await detail("AYC-10001")).order).toMatchObject({
        status: "paid",
        refundedCentavos: 30_000,
        refunds: [refund],
      });
      const found = await seam.getMemberForAdmin(OWNER, BEA.userId);
      if (!found.ok) throw new Error("The Member detail refused an Owner");
      expect(found.value.orders.find(({ reference }) => reference === "AYC-10001")).toMatchObject({
        refundedCentavos: 30_000,
      });
      const exported = await seam.exportOrdersCsv(OWNER, query({ q: "AYC-10001" }));
      if (!exported.ok) throw new Error("The CSV export refused an Owner");
      expect(csvLines(exported.value.csv)[1]?.split(",").slice(9, 11)).toEqual(["Paid", "300.00"]);
    });

    it("shows a full refund, partials adding up to it, as Refunded, under the Refunded filter too", async () => {
      await refundOf("AYC-10001", [{ id: "ref_A", amountCentavos: 99_900 }]);
      await refundOf("AYC-10001", [{ id: "ref_B", amountCentavos: 30_000 }]);

      expect((await detail("AYC-10001")).order).toMatchObject({
        status: "refunded",
        recordedStatus: "refunded",
        refundedCentavos: 129_900,
      });
      expect(references((await list({ status: "refunded" })).rows)).toEqual(["AYC-10001"]);
      expect(references((await list({ status: "paid" })).rows)).not.toContain("AYC-10001");
    });

    it("shows nothing refunded on an Order with no refund", async () => {
      expect((await detail("AYC-10001")).order).toMatchObject({ refundedCentavos: 0, refunds: [] });
    });
  });
});
