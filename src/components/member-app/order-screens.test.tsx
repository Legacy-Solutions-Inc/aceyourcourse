import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MemberOrder } from "@/services/member.types";

import { ConfirmingPayment, PaymentConfirmed, PaymentFailed } from "./order-screens";

// The Order screens (Phase 4, ticket 03; BUILD-MAP §3 Pay pending, Pay
// failed, Pay success; stories 136–140): Confirming payment while PayMongo
// confirms, with "Simulate paid" and "Simulate failed" in sample mode only;
// then Paid, with the date access now ends, or Failed, with the method's copy.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const ORDER: MemberOrder = {
  id: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10483",
  examCode: "CE",
  planName: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  method: "gcash",
  status: "pending",
  createdAt: "2026-11-17T03:42:00.000Z",
  paidAt: null,
  accessUntil: null,
};
const PAID: MemberOrder = {
  ...ORDER,
  method: "qrph",
  status: "paid",
  paidAt: "2026-11-17T03:43:00.000Z",
  accessUntil: "2027-02-15T03:43:00.000Z",
};

const simulate = async () => {};

describe("ConfirmingPayment", () => {
  it("says it's waiting for PayMongo to confirm the Member's method, with the Plan and reference", () => {
    render(<ConfirmingPayment order={ORDER} stillWaiting={false} check={null} simulate={null} />);

    expect(screen.getByText("CONFIRMING PAYMENT")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Waiting for PayMongo to confirm your GCash payment",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This usually takes under a minute. Keep this page open. Your access starts as soon as the payment is confirmed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/CE ALL-ACCESS · 3 MONTHS · ₱1,299/)).toHaveTextContent(
      "REF AYC-10483",
    );
  });

  it("says nothing of still waiting at first", () => {
    render(<ConfirmingPayment order={ORDER} stillWaiting={false} check={null} simulate={null} />);
    expect(screen.queryByText(/Still waiting/)).not.toBeInTheDocument();
  });

  it("after about 2 minutes, says it's still waiting and points to Support", () => {
    render(<ConfirmingPayment order={ORDER} stillWaiting check={null} simulate={null} />);

    const note = screen.getByRole("status");
    expect(note).toHaveTextContent("Still waiting for PayMongo.");
    expect(note).toHaveTextContent("AYC-10483");
    expect(within(note).getByRole("link", { name: "Support" })).toHaveAttribute(
      "href",
      "/app/support",
    );
  });

  it("offers Simulate paid and Simulate failed in sample mode, for this Order", () => {
    render(
      <ConfirmingPayment order={ORDER} stillWaiting={false} check={null} simulate={simulate} />,
    );

    const sample = screen.getByRole("region", { name: "SAMPLE DATA · NO PAYMONGO" });
    expect(within(sample).getByRole("button", { name: "Simulate paid" })).toHaveAttribute(
      "value",
      "paid",
    );
    expect(within(sample).getByRole("button", { name: "Simulate failed" })).toHaveAttribute(
      "value",
      "failed",
    );
    expect(sample.querySelector('input[name="reference"]')).toHaveValue("AYC-10483");
  });

  it("offers no simulation anywhere else", () => {
    render(<ConfirmingPayment order={ORDER} stillWaiting={false} check={null} simulate={null} />);
    expect(screen.queryByRole("button", { name: /Simulate/ })).not.toBeInTheDocument();
  });
});

describe("PaymentConfirmed", () => {
  it("says the Member is in, until when, and that nothing renews", () => {
    render(<PaymentConfirmed order={PAID} />);

    expect(screen.getByText("✓ PAYMENT CONFIRMED")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "You’re in. Kaya mo ’to." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "It’s active until 15 Feb 2027. It won’t renew on its own. We’ll remind you a week before it ends.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("₱1,299 · QR PH · REF AYC-10483 · RECEIPT IN BILLING"),
    ).toBeInTheDocument();
  });

  it("starts reviewing in the Library", () => {
    render(<PaymentConfirmed order={PAID} />);
    expect(screen.getByRole("link", { name: "Start reviewing" })).toHaveAttribute(
      "href",
      "/app/library",
    );
  });
});

describe("PaymentFailed", () => {
  const failed = (method: MemberOrder["method"]): MemberOrder => ({
    ...ORDER,
    method,
    status: "failed",
  });

  it("says a card was declined, offers the other methods, and leads back to Plans", () => {
    render(<PaymentFailed order={failed("card")} contactEmail="help@example.com" />);

    expect(screen.getByText("PAYMENT DIDN’T GO THROUGH")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Your card was declined" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You weren’t charged. Try again, or pay with QR Ph, GCash, or Maya instead.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/CE ALL-ACCESS · 3 MONTHS · ₱1,299 · CARD/)).toHaveTextContent(
      "REF AYC-10483",
    );
    expect(screen.getByRole("link", { name: "Try another method" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
  });

  it("emails support about this Order", () => {
    render(<PaymentFailed order={failed("card")} contactEmail="help@example.com" />);
    expect(screen.getByRole("link", { name: "Email support" })).toHaveAttribute(
      "href",
      "mailto:help@example.com?subject=Payment%20AYC-10483",
    );
  });

  it("names a GCash payment that didn't go through", () => {
    render(<PaymentFailed order={failed("gcash")} contactEmail="help@example.com" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Your GCash payment didn’t go through" }),
    ).toBeInTheDocument();
  });
});
