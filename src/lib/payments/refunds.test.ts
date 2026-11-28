import { describe, expect, it } from "vitest";

import {
  isFullyRefunded,
  mergeRefunds,
  type OrderRefund,
  refundedCentavos,
  succeededRefunds,
} from "./refunds";

// PayMongo's refunds as an Order records them (Phase 4, ticket 09; spec,
// Phase 4 planning decisions → Refunds; CONTEXT.md → Refunded, partial
// refund), pure. Each refund is kept once, by PayMongo's id; the Order's
// refunded amount is the sum of its succeeded ones; a succeeded refund never
// goes back. "Now" is 17 Nov 2026, 11:42 in Manila (03:42 UTC).
const NOW = new Date("2026-11-17T03:42:00.000Z");
const ORDER_ID = "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b";
const EARLIER = "2026-11-16T02:00:00.000Z";

const refund = (fields: Partial<OrderRefund> = {}): OrderRefund => ({
  id: "ref_FakeRefund0001TestOnly",
  orderId: ORDER_ID,
  amountCentavos: 30_000,
  status: "succeeded",
  refundedAt: EARLIER,
  ...fields,
});

describe("refundedCentavos", () => {
  it("adds up the succeeded refunds only", () => {
    expect(
      refundedCentavos([
        refund({ id: "ref_a", amountCentavos: 30_000 }),
        refund({ id: "ref_b", amountCentavos: 20_000 }),
        refund({ id: "ref_c", amountCentavos: 50_000, status: "pending", refundedAt: null }),
        refund({ id: "ref_d", amountCentavos: 10_000, status: "processing", refundedAt: null }),
        refund({ id: "ref_e", amountCentavos: 40_000, status: "failed", refundedAt: null }),
      ]),
    ).toBe(50_000);
  });

  it("is nothing with no refunds", () => {
    expect(refundedCentavos([])).toBe(0);
  });
});

describe("isFullyRefunded", () => {
  it("is a full refund once the refunds reach the Order's amount, partials adding up included", () => {
    expect(isFullyRefunded({ priceCentavos: 129_900 }, 129_900)).toBe(true);
    expect(isFullyRefunded({ priceCentavos: 129_900 }, 30_000)).toBe(false);
    expect(isFullyRefunded({ priceCentavos: 129_900 }, 0)).toBe(false);
  });
});

describe("succeededRefunds", () => {
  it("gives the succeeded refunds, oldest first", () => {
    const later = refund({ id: "ref_later", refundedAt: "2026-11-17T01:00:00.000Z" });
    const first = refund({ id: "ref_first", refundedAt: EARLIER });
    const pending = refund({ id: "ref_pending", status: "pending", refundedAt: null });

    expect(succeededRefunds([later, pending, first])).toEqual([first, later]);
  });
});

describe("mergeRefunds", () => {
  it("adds a refund PayMongo hasn't told us of before", () => {
    const merged = mergeRefunds(ORDER_ID, [], [refund()], NOW);

    expect(merged).toEqual({ refunds: [refund()], changed: [refund()] });
  });

  it("keeps each refund once by its id, however many events carry it", () => {
    const merged = mergeRefunds(ORDER_ID, [refund()], [refund(), refund()], NOW);

    expect(merged).toEqual({ refunds: [refund()], changed: [] });
  });

  it("moves a pending refund on to succeeded, when it was refunded", () => {
    const pending = refund({ status: "pending", refundedAt: null });

    const merged = mergeRefunds(ORDER_ID, [pending], [refund()], NOW);

    expect(merged).toEqual({ refunds: [refund()], changed: [refund()] });
  });

  it("takes the event's arrival as the refund time when PayMongo gives none", () => {
    const merged = mergeRefunds(ORDER_ID, [], [refund({ refundedAt: null })], NOW);

    expect(merged.changed).toEqual([refund({ refundedAt: NOW.toISOString() })]);
  });

  it("never moves a succeeded refund back, when an older event arrives late", () => {
    const merged = mergeRefunds(
      ORDER_ID,
      [refund()],
      [refund({ status: "pending", refundedAt: null })],
      NOW,
    );

    expect(merged).toEqual({ refunds: [refund()], changed: [] });
  });

  it("never moves a failed refund on: PayMongo makes a new refund to try again", () => {
    const failed = refund({ status: "failed", refundedAt: null });

    const merged = mergeRefunds(ORDER_ID, [failed], [refund()], NOW);

    expect(merged).toEqual({ refunds: [failed], changed: [] });
  });

  it("records a refund that isn't refunded yet without a refund time", () => {
    const merged = mergeRefunds(
      ORDER_ID,
      [],
      [refund({ status: "processing", refundedAt: "2026-11-17T03:00:00.000Z" })],
      NOW,
    );

    expect(merged.changed).toEqual([refund({ status: "processing", refundedAt: null })]);
  });

  it("keeps the refunds recorded before, adding the new ones after them", () => {
    const first = refund({ id: "ref_first" });
    const second = refund({ id: "ref_second", amountCentavos: 99_900 });

    const merged = mergeRefunds(ORDER_ID, [first], [second, first], NOW);

    expect(merged).toEqual({ refunds: [first, second], changed: [second] });
  });
});
