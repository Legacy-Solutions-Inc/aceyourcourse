import { describe, expect, it } from "vitest";

import type { BusinessDetails } from "@/services/catalogue.types";
import type { MemberOrder, PaymentAcknowledgement } from "@/services/member.types";

import { acknowledgementView, courseCard, invoiceState, orderRow, passCard } from "./billing-view";

// Billing and the Payment Acknowledgement, worded (Phase 4, ticket 06;
// BUILD-MAP §3 Billing and Receipt; stories 143, 144, 151u), pure. Every date
// is the Manila calendar date. "Now" is 17 Nov 2026, 11:42 in Manila. Your
// Courses (Phase 5, ticket 07) shows each Course owned with its source, and a
// Course Order's Acknowledgement has no access period. A
// refund (ticket 09) shows on the Order's row and its Acknowledgement:
// REFUNDED, or PARTIALLY REFUNDED with the amount.
const NOW = new Date("2026-11-17T03:42:00.000Z");

const ORDER: MemberOrder = {
  id: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10482",
  examCode: "CE",
  courseId: null,
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
  invoice: null,
  refundedCentavos: 0,
  refundedAt: null,
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

describe("courseCard (Phase 5, ticket 07)", () => {
  const PSAD = "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c";

  it("says a bought Course is hers since the Manila day it was paid, with the Order's reference", () => {
    expect(
      courseCard({
        courseId: PSAD,
        title: "PSAD Masterclass",
        examCode: "CE",
        // 00:30 on 29 Nov in Manila is still 28 Nov in UTC.
        since: "2026-11-28T16:30:00.000Z",
        orderReference: "AYC-10483",
      }),
    ).toEqual({
      courseId: PSAD,
      title: "PSAD Masterclass",
      tag: "OWNED",
      line: "CE · Since 29 Nov 2026 · AYC-10483 · yours to keep",
      watchHref: `/app/courses/${PSAD}`,
    });
  });

  it("says a given Course was given by Ace Your Course", () => {
    expect(
      courseCard({
        courseId: PSAD,
        title: "HPGE Crash Course",
        examCode: "CE",
        since: "2026-11-28T04:00:00.000Z",
        orderReference: null,
      }).line,
    ).toBe("CE · Since 28 Nov 2026 · Given by Ace Your Course · yours to keep");
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
      invoice: { canRequest: true, line: null },
      refund: null,
    });
  });

  it("names a Course Order's Course, with no access period (Phase 5, ticket 06)", () => {
    const course = {
      ...ORDER,
      courseId: "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c",
      planName: "PSAD Masterclass",
      days: null,
      priceCentavos: 149_900,
    };
    expect(orderRow(course)).toMatchObject({
      item: "PSAD Masterclass · Video course",
      amount: "₱1,499",
      status: "PAID",
    });
  });

  it("says a Refunded Course Order was refunded, with no days to remove (ticket 07)", () => {
    expect(
      orderRow({
        ...ORDER,
        courseId: "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c",
        planName: "PSAD Masterclass",
        days: null,
        priceCentavos: 149_900,
        status: "refunded",
        refundedCentavos: 149_900,
        refundedAt: "2026-11-16T16:30:00.000Z",
      }).refund,
    ).toBe("REFUNDED ON 17 NOV 2026");
  });

  it("shows a partial refund of a Course Order as a Plan Order's (ticket 07)", () => {
    expect(
      orderRow({
        ...ORDER,
        courseId: "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c",
        planName: "PSAD Masterclass",
        days: null,
        priceCentavos: 149_900,
        refundedCentavos: 30_000,
        refundedAt: "2026-11-16T03:00:00.000Z",
      }),
    ).toMatchObject({ status: "PAID", refund: "PARTIALLY REFUNDED · ₱300" });
  });

  it("shows a partial refund's amount under a Paid Order, which keeps its Acknowledgement", () => {
    expect(
      orderRow({ ...ORDER, refundedCentavos: 30_000, refundedAt: "2026-11-16T03:00:00.000Z" }),
    ).toMatchObject({
      status: "PAID",
      tone: "paid",
      refund: "PARTIALLY REFUNDED · ₱300",
      acknowledgementHref: "/app/billing/AYC-10482",
    });
  });

  it("shows a Refunded Order as REFUNDED, on the Manila day of its refund, with its Acknowledgement and no invoice to ask for", () => {
    // 00:30 on 17 Nov in Manila is 16:30 UTC on 16 Nov.
    expect(
      orderRow({
        ...ORDER,
        status: "refunded",
        refundedCentavos: 129_900,
        refundedAt: "2026-11-16T16:30:00.000Z",
      }),
    ).toMatchObject({
      status: "REFUNDED",
      tone: "ended",
      refund: "REFUNDED ON 17 NOV 2026 · UNUSED DAYS REMOVED",
      acknowledgementHref: "/app/billing/AYC-10482",
      invoice: { canRequest: false, line: null },
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
  ] as const)(
    "shows a %s Order as %s, with no Acknowledgement or invoice",
    (status, label, tone) => {
      expect(orderRow({ ...ORDER, status, paidAt: null })).toMatchObject({
        status: label,
        tone,
        acknowledgementHref: null,
        invoice: { canRequest: false, line: null },
      });
    },
  );

  it("says when a Paid Order's invoice was requested", () => {
    expect(
      orderRow({
        ...ORDER,
        invoice: { status: "requested", requestedAt: "2026-11-17T03:00:00.000Z", sentAt: null },
      }).invoice,
    ).toEqual({ canRequest: false, line: "Invoice requested" });
  });

  it("marks a Test Order TEST", () => {
    expect(orderRow({ ...ORDER, livemode: false }).test).toBe(true);
  });
});

describe("invoiceState", () => {
  const requested = {
    status: "requested",
    requestedAt: "2026-11-17T03:00:00.000Z",
    sentAt: null,
  } as const;

  it('offers a Paid Order with no request "Request official invoice"', () => {
    expect(invoiceState(ORDER)).toEqual({ canRequest: true, line: null });
  });

  it("says a requested invoice is requested, then sent, offering no second request", () => {
    expect(invoiceState({ ...ORDER, invoice: requested })).toEqual({
      canRequest: false,
      line: "Invoice requested",
    });
    expect(
      invoiceState({
        ...ORDER,
        invoice: { ...requested, status: "sent", sentAt: "2026-11-18T03:00:00.000Z" },
      }),
    ).toEqual({ canRequest: false, line: "Invoice sent · check your email" });
  });

  it.each(["pending", "failed", "expired", "refunded"] as const)(
    "offers a %s Order no invoice",
    (status) => {
      expect(invoiceState({ ...ORDER, status })).toEqual({
        canRequest: false,
        line: null,
      });
    },
  );
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
      invoice: { canRequest: true, line: null },
      refunded: null,
    });
  });

  it("reads PARTIALLY REFUNDED with the amount and day refunded, the access period as it was", () => {
    const view = acknowledgementView(
      {
        ...ACK,
        order: { ...ORDER, refundedCentavos: 30_000, refundedAt: "2026-11-16T03:00:00.000Z" },
      },
      FILLED,
    );
    expect(view).toMatchObject({
      status: "PARTIALLY REFUNDED",
      refunded: "₱300.00 on 16 Nov 2026",
      period: "Access 14 Oct 2026 – 12 Jan 2027 · no auto-renewal",
      amount: "₱1,299.00",
    });
  });

  it("reads REFUNDED, with the whole amount refunded and its unused days removed", () => {
    const view = acknowledgementView(
      {
        ...ACK,
        order: {
          ...ORDER,
          status: "refunded",
          refundedCentavos: 129_900,
          refundedAt: "2026-11-16T03:00:00.000Z",
        },
        access: { startsAt: "2026-10-14T03:01:00.000Z", endsAt: "2026-11-16T03:00:00.000Z" },
      },
      FILLED,
    );
    expect(view).toMatchObject({
      status: "REFUNDED",
      refunded: "₱1,299.00 on 16 Nov 2026",
      period: "Refunded 16 Nov 2026 · its unused days were removed",
      invoice: { canRequest: false, line: null },
    });
  });

  describe("a Course Order's (ticket 07)", () => {
    const COURSE_ACK: PaymentAcknowledgement = {
      ...ACK,
      order: {
        ...ORDER,
        courseId: "6a1e2d3c-4b5a-4f6e-8d7c-9b0a1f2e3d4c",
        planName: "PSAD Masterclass",
        days: null,
        priceCentavos: 149_900,
        accessUntil: null,
      },
      access: null,
    };

    it("prints the Course line, yours to keep, with no access period", () => {
      expect(acknowledgementView(COURSE_ACK, FILLED)).toMatchObject({
        item: "PSAD Masterclass · Video course · yours to keep",
        period: null,
        amount: "₱1,499.00",
        status: "PAID",
        invoice: { canRequest: true, line: null },
      });
    });

    it("reads REFUNDED on the day refunded, with no days to remove", () => {
      const view = acknowledgementView(
        {
          ...COURSE_ACK,
          order: {
            ...COURSE_ACK.order,
            status: "refunded",
            refundedCentavos: 149_900,
            refundedAt: "2026-11-16T03:00:00.000Z",
          },
        },
        FILLED,
      );
      expect(view).toMatchObject({
        status: "REFUNDED",
        refunded: "₱1,499.00 on 16 Nov 2026",
        period: "Refunded 16 Nov 2026",
      });
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
