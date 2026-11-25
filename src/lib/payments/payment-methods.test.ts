import { describe, expect, it } from "vitest";

import {
  failureCopy,
  isPaymentMethod,
  methodLabel,
  methodTag,
  PAYMENT_METHODS,
} from "./payment-methods";

// The Payment Methods (CONTEXT.md → Payment Method; spec, Phase 4 planning
// decisions → Paying; BUILD-MAP §3 Pay failed): QR Ph, GCash, Maya and Card,
// picked on the Plans page, recorded on the Order, and named again when a
// payment fails, offering the other three.

describe("PAYMENT_METHODS", () => {
  it("offers QR Ph, GCash, Maya and Card, QR Ph first", () => {
    expect(PAYMENT_METHODS.map(methodLabel)).toEqual(["QR Ph", "GCash", "Maya", "Card"]);
  });

  it("knows the four by their stored names, and nothing else", () => {
    expect(PAYMENT_METHODS.every(isPaymentMethod)).toBe(true);
    expect(isPaymentMethod("paypal")).toBe(false);
    expect(isPaymentMethod("Card")).toBe(false);
    expect(isPaymentMethod(undefined)).toBe(false);
  });
});

describe("methodTag", () => {
  it("names a method in capitals, for the receipt line", () => {
    expect(methodTag("qrph")).toBe("QR PH");
    expect(methodTag("gcash")).toBe("GCASH");
  });
});

describe("failureCopy", () => {
  it("says a card was declined, and offers QR Ph, GCash or Maya instead", () => {
    expect(failureCopy("card")).toEqual({
      title: "Your card was declined",
      body: "You weren’t charged. Try again, or pay with QR Ph, GCash, or Maya instead.",
    });
  });

  it.each([
    ["gcash", "Your GCash payment didn’t go through", "QR Ph, Maya, or Card"],
    ["maya", "Your Maya payment didn’t go through", "QR Ph, GCash, or Card"],
    ["qrph", "Your QR Ph payment didn’t go through", "GCash, Maya, or Card"],
  ] as const)("names %s and offers the other three", (method, title, others) => {
    expect(failureCopy(method)).toEqual({
      title,
      body: `You weren’t charged. Try again, or pay with ${others} instead.`,
    });
  });
});
