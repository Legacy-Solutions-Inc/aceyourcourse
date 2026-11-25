import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingScreen } from "./billing-screen";
import type { AcknowledgementView, OrderRow, PassCard } from "./billing-view";
import { PaymentAcknowledgementDocument } from "./payment-acknowledgement";

// Billing and the Payment Acknowledgement (Phase 4, ticket 06; BUILD-MAP §3
// Billing and Receipt; stories 143, 144, 151u), from their worded views, with
// "Request official invoice" (ticket 08; story 151j).

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
  invoice: { canRequest: true, line: null },
};
const FAILED: OrderRow = {
  ...PAID,
  reference: "AYC-10481",
  meta: "13 OCT 2026 · Card · AYC-10481",
  status: "FAILED",
  tone: "failed",
  test: true,
  acknowledgementHref: null,
  invoice: { canRequest: false, line: null },
};

/** "Request official invoice"'s action, answering `answer`. */
const invoiceAction = (answer = { error: null as string | null, fields: {} }) =>
  vi.fn(async (_reference: string, _previous: unknown, _formData: FormData) => answer);

/** BillingScreen's invoice props. */
const INVOICE = { memberName: "Bea Tester", requestInvoice: invoiceAction() };

describe("BillingScreen", () => {
  it("says what Billing is, and that card details stay with PayMongo", () => {
    render(<BillingScreen {...INVOICE} passes={[PASS]} orders={[PAID]} />);
    expect(
      screen.getByText("Your payment history. Card details stay with PayMongo; we never see them."),
    ).toBeInTheDocument();
  });

  it("shows each Access Pass with ACTIVE or ENDED, its line, and Renew now to that Exam's Plans", () => {
    render(<BillingScreen {...INVOICE} passes={[PASS]} orders={[PAID]} />);
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
    render(<BillingScreen {...INVOICE} passes={[]} orders={[PAID, FAILED]} />);
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("CE All-Access · 3 months");
    expect(rows[0]).toHaveTextContent("14 OCT 2026 · QR Ph · AYC-10482");
    expect(rows[0]).toHaveTextContent("PAID");
    expect(rows[0]).toHaveTextContent("₱1,299");
    expect(rows[1]).toHaveTextContent("FAILED");
  });

  it("links a Paid Order's Payment Acknowledgement, and no other Order's", () => {
    render(<BillingScreen {...INVOICE} passes={[]} orders={[PAID, FAILED]} />);
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(
      within(rows[0]!).getByRole("link", { name: "Payment Acknowledgement for AYC-10482" }),
    ).toHaveAttribute("href", "/app/billing/AYC-10482");
    expect(within(rows[1]!).queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks a Test Order TEST", () => {
    render(<BillingScreen {...INVOICE} passes={[]} orders={[PAID, FAILED]} />);
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(within(rows[0]!).queryByText("TEST")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText("TEST")).toBeInTheDocument();
  });

  it("says No payments yet under Orders for a Member with granted access who has never paid", () => {
    render(<BillingScreen {...INVOICE} passes={[PASS]} orders={[]} />);
    const orders = within(screen.getByRole("region", { name: "Orders" }));

    expect(screen.getByRole("region", { name: "Access" })).toBeInTheDocument();
    expect(orders.getByText("No payments yet")).toBeInTheDocument();
    expect(orders.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/app/plans");
  });

  it("says No payments yet, with See plans, before the Member has paid", () => {
    render(<BillingScreen {...INVOICE} passes={[]} orders={[]} />);

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
    invoice: { canRequest: true, line: null },
  };
  const renderIt = (view: Partial<AcknowledgementView> = {}, action = invoiceAction()) =>
    render(
      <PaymentAcknowledgementDocument
        view={{ ...VIEW, ...view }}
        memberName="Bea Tester"
        requestInvoice={action}
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

  it("asks for the official invoice's name, prefilled from the Member's, address and optional TIN", async () => {
    const action = invoiceAction();
    renderIt({}, action);
    const request = within(screen.getByRole("region", { name: "Request official invoice" }));
    const user = userEvent.setup();

    expect(request.getByRole("textbox", { name: "Name on the invoice" })).toHaveValue("Bea Tester");
    await user.type(request.getByRole("textbox", { name: "Address" }), "Jaro, Iloilo City");
    await user.type(
      request.getByRole("textbox", { name: "TIN (optional, for businesses)" }),
      "123456789",
    );
    await user.click(request.getByRole("button", { name: "Request invoice" }));

    expect(action).toHaveBeenCalledTimes(1);
    const [reference, , sent] = action.mock.calls[0]!;
    expect(reference).toBe("AYC-10482");
    expect(Object.fromEntries(sent)).toEqual({
      name: "Bea Tester",
      address: "Jaro, Iloilo City",
      tin: "123456789",
    });
  });

  it("shows each refused field's message under it, keeping what was typed", async () => {
    renderIt(
      {},
      invoiceAction({
        error: null,
        fields: { address: "Enter the address to put on the invoice.", tin: "Enter 9 digits." },
      }),
    );
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Address" }), "   ");
    await user.type(screen.getByRole("textbox", { name: /^TIN/ }), "12345");
    await user.click(screen.getByRole("button", { name: "Request invoice" }));

    const address = screen.getByRole("textbox", { name: "Address" });
    expect(address).toHaveAttribute("aria-invalid", "true");
    expect(address).toHaveAccessibleDescription("Enter the address to put on the invoice.");
    expect(screen.getByRole("textbox", { name: /^TIN/ })).toHaveAccessibleDescription(
      "Enter 9 digits.",
    );
    expect(screen.getByRole("textbox", { name: /^TIN/ })).toHaveValue("12345");
    expect(screen.getByRole("textbox", { name: "Name on the invoice" })).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("says why a request for the Order was refused", async () => {
    renderIt(
      {},
      invoiceAction({ error: "You've already requested this Order's invoice.", fields: {} }),
    );
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Address" }), "Jaro");
    await user.click(screen.getByRole("button", { name: "Request invoice" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You've already requested this Order's invoice.",
    );
  });

  it.each(["Invoice requested", "Invoice sent · check your email"])(
    "says %s in the form's place once the invoice is asked for",
    (line) => {
      renderIt({ invoice: { canRequest: false, line } });
      const request = within(screen.getByRole("region", { name: "Request official invoice" }));

      expect(request.getByText(line)).toBeInTheDocument();
      expect(request.queryByRole("textbox")).not.toBeInTheDocument();
    },
  );
});

describe("BillingScreen's official invoices", () => {
  it('offers a Paid Order with no request "Request official invoice", opening the short form', async () => {
    const requestInvoice = invoiceAction();
    render(
      <BillingScreen
        passes={[]}
        orders={[PAID]}
        memberName="Bea Tester"
        requestInvoice={requestInvoice}
      />,
    );
    const row = within(
      within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem")[0]!,
    );
    const user = userEvent.setup();

    await user.click(row.getByText("Request official invoice"));
    const form = within(row.getByRole("form", { name: "Request official invoice for AYC-10482" }));
    expect(form.getByRole("textbox", { name: "Name on the invoice" })).toHaveValue("Bea Tester");
    await user.type(form.getByRole("textbox", { name: "Address" }), "Jaro");
    await user.click(form.getByRole("button", { name: "Request invoice" }));

    expect(requestInvoice).toHaveBeenCalledWith(
      "AYC-10482",
      expect.anything(),
      expect.any(FormData),
    );
  });

  it("says Invoice requested on a Paid Order once asked for, with no form, and nothing on other Orders", () => {
    render(
      <BillingScreen
        {...INVOICE}
        passes={[]}
        orders={[{ ...PAID, invoice: { canRequest: false, line: "Invoice requested" } }, FAILED]}
      />,
    );
    const rows = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");

    expect(rows[0]).toHaveTextContent("Invoice requested");
    expect(within(rows[0]!).queryByText("Request official invoice")).not.toBeInTheDocument();
    expect(within(rows[1]!).queryByText(/invoice/i)).not.toBeInTheDocument();
  });
});
