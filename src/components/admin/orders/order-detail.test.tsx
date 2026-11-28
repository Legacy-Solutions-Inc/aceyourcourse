import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/admin/action";
import type { InvoiceRequest } from "@/lib/payments/invoice-requests";
import type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrderNote,
  OrderStatusCheck,
} from "@/services/admin.types";

import { OrderDetail } from "./order-detail";

// An Order's detail page (story 148; mockup 752–785): the internal note saves
// with the stamp it opened with, and "Check status with PayMongo" says what
// PayMongo said, then reads the page again. An Invoice Request (ticket 08;
// story 151v) shows its details and "Mark invoice sent". The Server Actions
// are the boundary, so they're replaced.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  unstable_rethrow: () => {},
}));

const MADE = "2026-11-25T01:00:00.000Z";

const PENDING: AdminOrder = {
  id: "00000000-0000-4000-8000-000000010006",
  reference: "AYC-10006",
  userId: "2a4c6e80-1b3d-4f5a-9c7e-0d2f4a6b8c1e",
  examCode: "ME",
  planId: "plan-me-30",
  courseId: null,
  planName: "ME All-Access",
  days: 30,
  priceCentavos: 44_900,
  method: "maya",
  status: "pending",
  recordedStatus: "pending",
  paidAfterExpiry: false,
  invoice: null,
  refunds: [],
  refundedCentavos: 0,
  livemode: true,
  checkoutId: "cs_sample10006",
  paymentId: null,
  buyerName: "Paolo Reyes",
  buyerEmail: "paolo.reyes@example.com",
  createdAt: MADE,
  paidAt: null,
  statusChangedAt: MADE,
  paidWithoutAccount: false,
  paidAlreadyOwned: false,
};

const NOTE: AdminOrderNote = {
  reference: "AYC-10006",
  text: "",
  stamp: { savedAt: MADE, savedBy: null },
};

type NoteState = AdminActionState<AdminOrderNote>;
type CheckState = AdminActionState<OrderStatusCheck>;
type InvoiceState = AdminActionState<InvoiceRequest>;

const REQUEST: InvoiceRequest = {
  orderId: "00000000-0000-4000-8000-000000010003",
  name: "Sample Builders Inc.",
  address: "12 Sample St, Jaro, Iloilo City",
  tin: "123-456-789-000",
  requestedAt: "2026-11-25T03:00:00.000Z",
  sentAt: null,
  sentBy: null,
};
const PAID: AdminOrder = {
  ...PENDING,
  id: REQUEST.orderId,
  reference: "AYC-10003",
  status: "paid",
  recordedStatus: "paid",
  paidAt: MADE,
  paymentId: "pay_Sample10003",
  invoice: REQUEST,
};

function renderDetail({
  detail = { order: PENDING, memberUserId: PENDING.userId, note: NOTE } as AdminOrderDetail,
  noteAnswer = {
    status: "saved",
    value: {
      ...NOTE,
      text: "Asked about Maya",
      stamp: { savedAt: "2026-11-25T02:00:00.000Z", savedBy: "Angel" },
    },
  } as NoteState,
  checkAnswer = {
    status: "saved",
    value: { outcome: "still-pending", order: PENDING },
  } as CheckState,
  invoiceAnswer = {
    status: "saved",
    value: { ...REQUEST, sentAt: "2026-11-25T04:00:00.000Z" },
  } as InvoiceState,
} = {}) {
  const saveNote = vi.fn(async (): Promise<NoteState> => noteAnswer);
  const checkStatus = vi.fn(async (): Promise<CheckState> => checkAnswer);
  const markInvoiceSent = vi.fn(async (): Promise<InvoiceState> => invoiceAnswer);
  const user = userEvent.setup();
  const { rerender } = render(
    <OrderDetail
      detail={detail}
      saveNote={saveNote}
      checkStatus={checkStatus}
      markInvoiceSent={markInvoiceSent}
    />,
  );
  rerenderDetail = rerender;
  return { user, saveNote, checkStatus, markInvoiceSent };
}

/** Renders the page again in place, as router.refresh() does with the server's new props. */
let rerenderDetail: (ui: React.ReactElement) => void = () => {};

const noteField = () => screen.getByRole("textbox", { name: "INTERNAL NOTE" });
const noteStatus = () =>
  within(screen.getByRole("form", { name: "Internal note" })).getByRole("status");

describe("OrderDetail", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("links the buyer to their Member detail page", () => {
    renderDetail();
    expect(screen.getByRole("link", { name: "paolo.reyes@example.com" })).toHaveAttribute(
      "href",
      `/admin/users/${PENDING.userId}`,
    );
  });

  it("says ACCOUNT DELETED, with no link, once the account is gone", () => {
    renderDetail({
      detail: { order: { ...PENDING, userId: null }, memberUserId: null, note: NOTE },
    });
    expect(screen.queryByRole("link", { name: "paolo.reyes@example.com" })).not.toBeInTheDocument();
    expect(screen.getByText("ACCOUNT DELETED")).toBeInTheDocument();
  });

  it("shows a partial refund's amount by the status, in the facts and on the timeline, the Order still Paid (ticket 09)", () => {
    const partial: AdminOrder = {
      ...PAID,
      invoice: null,
      priceCentavos: 129_900,
      refunds: [
        {
          id: "ref_a",
          orderId: PAID.id,
          amountCentavos: 30_000,
          status: "succeeded",
          refundedAt: "2026-11-25T05:00:00.000Z",
        },
      ],
      refundedCentavos: 30_000,
    };
    renderDetail({ detail: { order: partial, memberUserId: null, note: NOTE } });
    const order = screen.getByRole("region", { name: "AYC-10003" });
    expect(order).toHaveTextContent("PAID");
    expect(order).toHaveTextContent("PARTIALLY REFUNDED · ₱300");
    expect(order).toHaveTextContent("AMOUNT REFUNDED₱300 · in part");
    expect(order).toHaveTextContent("Partially refunded in PayMongo · ₱300 · access unchanged");
  });

  it("shows a Refunded Order's refund in full, with no partial note", () => {
    const refunded: AdminOrder = {
      ...PAID,
      invoice: null,
      status: "refunded",
      recordedStatus: "refunded",
      priceCentavos: 49_900,
      refunds: [
        {
          id: "ref_a",
          orderId: PAID.id,
          amountCentavos: 49_900,
          status: "succeeded",
          refundedAt: "2026-11-25T05:00:00.000Z",
        },
      ],
      refundedCentavos: 49_900,
    };
    renderDetail({ detail: { order: refunded, memberUserId: null, note: NOTE } });
    const order = screen.getByRole("region", { name: "AYC-10003" });
    expect(order).toHaveTextContent("AMOUNT REFUNDED₱499 · in full");
    expect(order).not.toHaveTextContent("PARTIALLY REFUNDED");
    expect(order).toHaveTextContent("Refunded in full in PayMongo · ₱499 · unused days removed");
    expect(screen.getByRole("region", { name: "STATUS NOTE" })).toHaveTextContent(
      "the Member was told in the app",
    );
  });

  it("tags a Test Order TEST", () => {
    renderDetail({
      detail: { order: { ...PENDING, livemode: false }, memberUserId: null, note: NOTE },
    });
    expect(screen.getByRole("region", { name: "AYC-10006" })).toHaveTextContent("TEST");
  });

  it("saves the internal note with the stamp it opened with, and says only Admins see it", async () => {
    const { user, saveNote } = renderDetail();
    await user.type(noteField(), "Asked about Maya");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(saveNote).toHaveBeenCalledWith(expect.anything(), {
      input: { reference: "AYC-10006", note: "Asked about Maya" },
      expected: { savedAt: MADE },
    });
    expect(noteStatus()).toHaveTextContent("✓ NOTE SAVED · ONLY ADMINS SEE IT");
  });

  it("sends the new stamp with the next save", async () => {
    const { user, saveNote } = renderDetail();
    await user.type(noteField(), "Asked about Maya");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    await user.type(noteField(), ". Then paid.");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(saveNote).toHaveBeenLastCalledWith(expect.anything(), {
      input: { reference: "AYC-10006", note: "Asked about Maya. Then paid." },
      expected: { savedAt: "2026-11-25T02:00:00.000Z" },
    });
  });

  it("keeps a stale note in the form and says who saved first", async () => {
    const { user } = renderDetail({
      noteAnswer: {
        status: "refused",
        error: { kind: "conflict", savedBy: "Angel Rose L. Lepaña", savedAt: MADE },
      },
    });
    await user.type(noteField(), "From an older page");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(screen.getByRole("alert")).toHaveTextContent("SOMEONE SAVED FIRST");
    expect(screen.getByRole("alert")).toHaveTextContent("Angel Rose L. Lepaña saved this note");
    expect(noteField()).toHaveValue("From an older page");
  });

  it("shows a note that's too long in red", async () => {
    const { user } = renderDetail({
      noteAnswer: {
        status: "refused",
        error: { kind: "invalid", fieldErrors: { note: ["KEEP THE NOTE TO 2,000 CHARACTERS"] } },
      },
    });
    await user.type(noteField(), "x");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(screen.getByText("KEEP THE NOTE TO 2,000 CHARACTERS")).toBeInTheDocument();
    expect(noteField()).toHaveAttribute("aria-invalid", "true");
  });

  it("checks the status with PayMongo and says it's still pending at Maya", async () => {
    const { user, checkStatus } = renderDetail();
    await user.click(screen.getByRole("button", { name: "Check status with PayMongo" }));

    expect(checkStatus).toHaveBeenCalledWith(expect.anything(), {
      input: { reference: "AYC-10006" },
    });
    expect(await screen.findByText("CHECKED JUST NOW · STILL PENDING AT MAYA")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("says when the check made the Order Paid", async () => {
    const { user } = renderDetail({
      checkAnswer: {
        status: "saved",
        value: { outcome: "paid", order: { ...PENDING, status: "paid", recordedStatus: "paid" } },
      },
    });
    await user.click(screen.getByRole("button", { name: "Check status with PayMongo" }));

    expect(await screen.findByText("CHECKED JUST NOW · PAID · ACCESS GRANTED")).toHaveClass(
      "text-ayc-success",
    );
  });

  it("keeps saying the check made the Order Paid once the page shows it Paid", async () => {
    const paidOrder = { ...PENDING, status: "paid", recordedStatus: "paid" } as const;
    const { user, saveNote, checkStatus, markInvoiceSent } = renderDetail({
      checkAnswer: { status: "saved", value: { outcome: "paid", order: paidOrder } },
    });
    await user.click(screen.getByRole("button", { name: "Check status with PayMongo" }));
    await screen.findByText("CHECKED JUST NOW · PAID · ACCESS GRANTED");

    // The page reads the Order again: now Paid, with nothing left to check.
    rerenderDetail(
      <OrderDetail
        detail={{ order: paidOrder, memberUserId: PENDING.userId, note: NOTE }}
        saveNote={saveNote}
        checkStatus={checkStatus}
        markInvoiceSent={markInvoiceSent}
      />,
    );

    expect(screen.getByText("CHECKED JUST NOW · PAID · ACCESS GRANTED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Check status with PayMongo" }),
    ).not.toBeInTheDocument();
  });

  it("says why a check was refused, and when the server couldn't be reached", async () => {
    const { user } = renderDetail({
      checkAnswer: {
        status: "refused",
        error: { kind: "invalid", fieldErrors: {}, formError: "Payments aren’t set up." },
      },
    });
    await user.click(screen.getByRole("button", { name: "Check status with PayMongo" }));
    expect(await screen.findByText("Payments aren’t set up.")).toBeInTheDocument();
  });

  it("offers no status check for an Order that isn't recorded Pending", () => {
    renderDetail({
      detail: {
        order: { ...PENDING, status: "failed", recordedStatus: "failed" },
        memberUserId: null,
        note: NOTE,
      },
    });
    expect(
      screen.queryByRole("button", { name: "Check status with PayMongo" }),
    ).not.toBeInTheDocument();
  });

  it("still offers the check on a Pending Order past its 24 hours, shown Expired", () => {
    renderDetail({
      detail: { order: { ...PENDING, status: "expired" }, memberUserId: null, note: NOTE },
    });
    expect(screen.getByRole("region", { name: "AYC-10006" })).toHaveTextContent("EXPIRED");
    expect(screen.getByRole("button", { name: "Check status with PayMongo" })).toBeInTheDocument();
  });

  it("shows no Invoice Request on an Order with none", () => {
    renderDetail();
    expect(screen.queryByRole("region", { name: "INVOICE REQUEST" })).not.toBeInTheDocument();
  });

  it("shows the Invoice Request's name, address, TIN and when it was asked for, and marks it sent", async () => {
    const { user, markInvoiceSent } = renderDetail({
      detail: { order: PAID, memberUserId: PAID.userId, note: NOTE } as AdminOrderDetail,
    });
    const panel = within(screen.getByRole("region", { name: "INVOICE REQUEST" }));

    expect(panel.getByText("Sample Builders Inc.")).toBeInTheDocument();
    expect(panel.getByText("12 Sample St, Jaro, Iloilo City")).toBeInTheDocument();
    expect(panel.getByText("123-456-789-000")).toBeInTheDocument();
    expect(panel.getByText("25 Nov 2026, 11:00 am")).toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Mark invoice sent" }));

    expect(markInvoiceSent).toHaveBeenCalledWith(expect.anything(), {
      input: { reference: "AYC-10003" },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("says when and by whom a sent request was marked, offering no second mark", () => {
    renderDetail({
      detail: {
        order: {
          ...PAID,
          invoice: {
            ...REQUEST,
            tin: null,
            sentAt: "2026-11-25T04:00:00.000Z",
            sentBy: { email: "owner@example.com", name: "Sample Owner" },
          },
        },
        memberUserId: PAID.userId,
        note: NOTE,
      } as AdminOrderDetail,
    });
    const panel = within(screen.getByRole("region", { name: "INVOICE REQUEST" }));

    expect(panel.getByText("None given")).toBeInTheDocument();
    expect(panel.getByText(/^✓ SENT 25 NOV 2026, 12:00 PM · SAMPLE OWNER$/)).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "Mark invoice sent" })).not.toBeInTheDocument();
  });

  it("says why marking it sent was refused", async () => {
    const { user } = renderDetail({
      detail: { order: PAID, memberUserId: PAID.userId, note: NOTE } as AdminOrderDetail,
      invoiceAnswer: {
        status: "refused",
        error: { kind: "forbidden", message: "ONLY AN OWNER CAN SEE ORDERS AND PAYMENTS" },
      },
    });
    await user.click(screen.getByRole("button", { name: "Mark invoice sent" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ONLY AN OWNER CAN SEE ORDERS AND PAYMENTS",
    );
  });
});
