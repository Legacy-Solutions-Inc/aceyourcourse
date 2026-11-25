import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingScreen } from "./billing-screen";
import type { AcknowledgementView, OrderRow, PassCard } from "./billing-view";
import { PaymentAcknowledgementDocument } from "./payment-acknowledgement";

// Billing and the Payment Acknowledgement (Phase 4, ticket 06; BUILD-MAP §3
// Billing and Receipt; stories 143, 144, 151u), from their worded views.

const PASS: PassCard = {
  examCode: "CE",
  title: "CE All-Access",
  active: true,
  tag: "ACTIVE",
  line: "Until 12 Jan 2027 · 56 days left · renews only if you renew",
  renewHref: "/app/plans?exam=CE",
};
const PAID: OrderRow = {
  reference: "AYC-10482",
  item: "CE All-Access · 3 months",
  meta: "14 OCT 2026 · QR Ph · AYC-10482",
  status: "PAID",
  tone: "paid",
  amount: "₱1,299",
  test: false,
  acknowledgementHref: "/app/billing/AYC-10482",
};
const FAILED: OrderRow = {
  ...PAID,
  reference: "AYC-10481",
  meta: "13 OCT 2026 · Card · AYC-10481",
  status: "FAILED",
  tone: "failed",
  test: true,
  acknowledgementHref: null,
};

describe("BillingScreen", () => {
  it("says what Billing is, and that card details stay with PayMongo", () => {
    render(<BillingScreen passes={[PASS]} orders={[PAID]} />);
    expect(
      screen.getByText("Your payment history. Card details stay with PayMongo; we never see them."),
    ).toBeInTheDocument();
  });

  it("shows each Access Pass with ACTIVE or ENDED, its line, and Renew now to that Exam's Plans", () => {
    render(<BillingScreen passes={[PASS]} orders={[PAID]} />);
    const access = within(screen.getByRole("region", { name: "Access" }));

    expect(access.getByRole("heading", { level: 3, name: "CE All-Access" })).toBeInTheDocument();
    expect(access.getByText("ACTIVE")).toBeInTheDocument();
    expect(access.getByText(PASS.line)).toBeInTheDocument();
    expect(access.getByRole("link", { name: "Renew now CE All-Access" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
  });

  it("lists each Order with its item, date, method, reference, status and amount", () => {
    render(<BillingScreen passes={[]} orders={[PAID, FAILED]} />);
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("CE All-Access · 3 months");
    expect(rows[0]).toHaveTextContent("14 OCT 2026 · QR Ph · AYC-10482");
    expect(rows[0]).toHaveTextContent("PAID");
    expect(rows[0]).toHaveTextContent("₱1,299");
    expect(rows[1]).toHaveTextContent("FAILED");
  });

  it("links a Paid Order's Payment Acknowledgement, and no other Order's", () => {
    render(<BillingScreen passes={[]} orders={[PAID, FAILED]} />);
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(
      within(rows[0]!).getByRole("link", { name: "Payment Acknowledgement for AYC-10482" }),
    ).toHaveAttribute("href", "/app/billing/AYC-10482");
    expect(within(rows[1]!).queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks a Test Order TEST", () => {
    render(<BillingScreen passes={[]} orders={[PAID, FAILED]} />);
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(within(rows[0]!).queryByText("TEST")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText("TEST")).toBeInTheDocument();
  });

  it("says No payments yet under Orders for a Member with granted access who has never paid", () => {
    render(<BillingScreen passes={[PASS]} orders={[]} />);
    const orders = within(screen.getByRole("region", { name: "Orders" }));

    expect(screen.getByRole("region", { name: "Access" })).toBeInTheDocument();
    expect(orders.getByText("No payments yet")).toBeInTheDocument();
    expect(orders.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/app/plans");
  });

  it("says No payments yet, with See plans, before the Member has paid", () => {
    render(<BillingScreen passes={[]} orders={[]} />);

    expect(screen.getByText("No payments yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/app/plans");
    expect(screen.queryByRole("region", { name: "Access" })).not.toBeInTheDocument();
  });
});

describe("PaymentAcknowledgementDocument", () => {
  const VIEW: AcknowledgementView = {
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
  };
  const renderIt = (view: Partial<AcknowledgementView> = {}) =>
    render(
      <PaymentAcknowledgementDocument
        view={{ ...VIEW, ...view }}
        contactEmail="help@example.com"
      />,
    );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is labelled a Payment Acknowledgement that isn't an official invoice", () => {
    renderIt();
    expect(
      screen.getByRole("heading", { level: 1, name: "Payment Acknowledgement" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This is not an official invoice")).toBeInTheDocument();
    expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument();
  });

  it("shows its number, date, who's billed, the seller, the line, the total and the payment", () => {
    renderIt();
    const document = within(
      screen.getByRole("article", { name: "Payment Acknowledgement AYC-10482" }),
    );

    for (const text of [
      "AYC-10482",
      "14 OCT 2026",
      "Bea Tester",
      "tester@example.com",
      "Ace Your Course Review Center",
      "Iloilo City, Iloilo",
      "TIN 123-456-789-000",
      "CE All-Access · 3 months",
      "Access 14 Oct 2026 – 12 Jan 2027 · no auto-renewal",
      "QR Ph via PayMongo",
      "pay_FakePaid0001TestOnly",
      "PAID",
      "Prices include VAT",
    ]) {
      expect(document.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(document.getAllByText("₱1,299.00")).toHaveLength(2);
  });

  it("has no VAT line when there's none", () => {
    renderIt({ vatLine: null });
    expect(screen.queryByText("Prices include VAT")).not.toBeInTheDocument();
  });

  it("marks a Test Order's Acknowledgement TEST", () => {
    renderIt({ test: true });
    expect(screen.getByText("TEST PAYMENT · NO REAL MONEY")).toBeInTheDocument();
  });

  it("prints with Print or save as PDF, and goes back to Billing", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderIt();

    await userEvent.setup().click(screen.getByRole("button", { name: "Print or save as PDF" }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "← Billing" })).toHaveAttribute("href", "/app/billing");
  });

  it("keeps a place for requesting an official invoice, with no form yet", () => {
    renderIt();
    const request = within(screen.getByRole("region", { name: "Request official invoice" }));

    expect(request.getByText(/email help@example.com with AYC-10482/)).toBeInTheDocument();
    expect(request.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
