import { describe, expect, it } from "vitest";

import type { BusinessDetails } from "@/services/catalogue.types";
import type { MemberOrder, PaymentAcknowledgement } from "@/services/member.types";

import { acknowledgementView, orderRow, passCard } from "./billing-view";

// Billing and the Payment Acknowledgement, worded (Phase 4, ticket 06;
// BUILD-MAP §3 Billing and Receipt; stories 143, 144, 151u), pure. Every date
// is the Manila calendar date. "Now" is 17 Nov 2026, 11:42 in Manila.
const NOW = new Date("2026-11-17T03:42:00.000Z");

const ORDER: MemberOrder = {
  id: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10482",
  examCode: "CE",
  planName: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  method: "qrph",
  status: "paid",
  createdAt: "2026-10-14T03:00:00.000Z",
  paidAt: "2026-10-14T03:01:00.000Z",
  livemode: true,
  accessUntil: "2027-01-12T03:01:00.000Z",
  paidAfterExpiry: false,
};

describe("passCard", () => {
  it("says an active pass's end, the days left, and that only the Member renews it", () => {
    expect(passCard({ examCode: "CE", endsAt: "2027-01-12T03:01:00.000Z" }, NOW)).toEqual({
      examCode: "CE",
      title: "CE All-Access",
      active: true,
      tag: "ACTIVE",
      line: "Until 12 Jan 2027 · 56 days left · renews only if you renew",
      renewHref: "/app/plans?exam=CE",
    });
  });

  it("counts Manila days: a pass ending 00:30 tomorrow in Manila has 1 day left", () => {
    // 00:30 on 18 Nov in Manila is still 17 Nov, 16:30 UTC.
    expect(passCard({ examCode: "CE", endsAt: "2026-11-17T16:30:00.000Z" }, NOW).line).toBe(
      "Until 18 Nov 2026 · 1 day left · renews only if you renew",
    );
  });

  it("says a pass ending later today ends today", () => {
    expect(passCard({ examCode: "CE", endsAt: "2026-11-17T15:00:00.000Z" }, NOW).line).toBe(
      "Until 17 Nov 2026 · ends today · renews only if you renew",
    );
  });

  it("says an ended pass ended, and on what day", () => {
    expect(passCard({ examCode: "ME", endsAt: "2026-11-10T03:00:00.000Z" }, NOW)).toMatchObject({
      active: false,
      tag: "ENDED",
      line: "Ended 10 Nov 2026 · renew to study again",
      renewHref: "/app/plans?exam=ME",
    });
  });
});

describe("orderRow", () => {
  it("shows a Paid Order with its date in Manila, method, reference, amount and its Acknowledgement", () => {
    expect(orderRow(ORDER)).toEqual({
      reference: "AYC-10482",
      item: "CE All-Access · 3 months",
      meta: "14 OCT 2026 · QR Ph · AYC-10482",
      status: "PAID",
      tone: "paid",
      amount: "₱1,299",
      test: false,
      acknowledgementHref: "/app/billing/AYC-10482",
    });
  });

  it("dates an Order made at 00:30 on 2 Sep in Manila on 2 Sep, though UTC still says 1 Sep", () => {
    // 00:30 on 2 Sep in Manila is 16:30 UTC on 1 Sep.
    expect(orderRow({ ...ORDER, createdAt: "2026-09-01T16:30:00.000Z" }).meta).toBe(
      "2 SEPT 2026 · QR Ph · AYC-10482",
    );
  });

  it.each([
    ["pending", "PENDING", "waiting"],
    ["failed", "FAILED", "failed"],
    ["expired", "EXPIRED", "ended"],
  ] as const)("shows a %s Order as %s, with no Acknowledgement", (status, label, tone) => {
    expect(orderRow({ ...ORDER, status, paidAt: null })).toMatchObject({
      status: label,
      tone,
      acknowledgementHref: null,
    });
  });

  it("marks a Test Order TEST", () => {
    expect(orderRow({ ...ORDER, livemode: false }).test).toBe(true);
  });
});

describe("acknowledgementView", () => {
  const ACK: PaymentAcknowledgement = {
    order: ORDER,
    buyer: { name: "Bea Tester", email: "tester@example.com" },
    access: { startsAt: "2026-10-14T03:01:00.000Z", endsAt: "2027-01-12T03:01:00.000Z" },
    payMongoReference: "pay_FakePaid0001TestOnly",
  };
  const FILLED: BusinessDetails = {
    name: "Ace Your Course Review Center",
    address: "Iloilo City, Iloilo",
    tin: "123-456-789-000",
    vatRegistered: true,
  };
  const DEFAULT: BusinessDetails = {
    name: "Ace Your Course",
    address: null,
    tin: null,
    vatRegistered: false,
  };

  it("words the whole Acknowledgement: number, Manila date, who's billed, seller, line, total and payment", () => {
    expect(acknowledgementView(ACK, FILLED)).toEqual({
      number: "AYC-10482",
      date: "14 OCT 2026",
      billedTo: ["Bea Tester", "tester@example.com"],
      seller: ["Ace Your Course Review Center", "Iloilo City, Iloilo", "TIN 123-456-789-000"],
      item: "CE All-Access · 3 months",
      period: "Access 14 Oct 2026 – 12 Jan 2027 · no auto-renewal",
      amount: "₱1,299.00",
      method: "QR Ph via PayMongo",
      payMongoReference: "pay_FakePaid0001TestOnly",
      status: "PAID",
      vatLine: "Prices include VAT",
      test: false,
    });
  });

  it("shows the business name alone, and no VAT line, before the details are filled in", () => {
    expect(acknowledgementView(ACK, DEFAULT)).toMatchObject({
      seller: ["Ace Your Course"],
      vatLine: null,
    });
  });

  it("says no VAT line when the business isn't VAT-registered", () => {
    expect(acknowledgementView(ACK, { ...FILLED, vatRegistered: false }).vatLine).toBeNull();
  });

  it("dates a payment made at 00:30 in Manila on that Manila day", () => {
    const late = { ...ACK, order: { ...ORDER, paidAt: "2026-10-13T16:30:00.000Z" } };
    expect(acknowledgementView(late, FILLED).date).toBe("14 OCT 2026");
  });

  it("bills a buyer with no name by email alone, and shows a dash with no PayMongo reference", () => {
    expect(
      acknowledgementView(
        { ...ACK, buyer: { name: null, email: "tester@example.com" }, payMongoReference: null },
        FILLED,
      ),
    ).toMatchObject({ billedTo: ["tester@example.com"], payMongoReference: "—" });
  });

  it("marks a Test Order's Acknowledgement TEST", () => {
    expect(acknowledgementView({ ...ACK, order: { ...ORDER, livemode: false } }, FILLED).test).toBe(
      true,
    );
  });
});
