import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  ConfirmingPayment,
  PaymentConfirmed,
  PaymentFailed,
} from "@/components/member-app/order-screens";
import { orderScreen, stillWaiting } from "@/components/member-app/order-view";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { isOrderReference } from "@/lib/payments/order-ledger";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { getMemberOrder } from "@/services/member";
import { paymentsClient, samplePaymentsFake } from "@/services/payments";

import { checkPayment, simulatePayment } from "./actions";

export const metadata: Metadata = { title: "Payment" };

interface OrderPageProps {
  params: Promise<{ reference: string }>;
}

/**
 * One of the Member's Orders (Phase 4, ticket 03; mockup L546–574; spec,
 * Phase 4 → Return flow; stories 136–140), by its reference: Confirming
 * payment while it's Pending, reading it again every few seconds (and, after
 * about 15 seconds, having the server ask PayMongo: ticket 04), then Paid or
 * Failed. Expired and Refunded Orders are shown in Billing. Only the
 * Order's own Member can open it: anyone else's reference, or one that isn't
 * an Order's, answers not found. The gate, consent, the Active Device and
 * onboarding come first, coming back here.
 */
export default async function OrderPage({ params }: OrderPageProps) {
  const { reference } = await params;
  const from = isOrderReference(reference)
    ? paths.memberApp.order(reference)
    : paths.memberApp.plans;
  const { member } = await requireMemberWithExam(from);
  const order = await getMemberOrder(member.userId, reference);
  if (!order) notFound();

  switch (orderScreen(order.status)) {
    case "confirming":
      return (
        <ConfirmingPayment
          order={order}
          stillWaiting={stillWaiting(order.createdAt, new Date())}
          check={paymentsClient() ? checkPayment.bind(null, order.reference) : null}
          simulate={samplePaymentsFake() ? simulatePayment : null}
        />
      );
    case "paid":
      return <PaymentConfirmed order={order} />;
    case "failed": {
      const { contactEmail } = await getWebsiteSettings();
      return <PaymentFailed order={order} contactEmail={contactEmail} />;
    }
    case "billing":
      redirect(paths.memberApp.billing);
  }
}
