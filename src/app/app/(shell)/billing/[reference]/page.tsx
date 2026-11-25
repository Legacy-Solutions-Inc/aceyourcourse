import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { acknowledgementView } from "@/components/member-app/billing-view";
import { PaymentAcknowledgementDocument } from "@/components/member-app/payment-acknowledgement";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { isOrderReference } from "@/lib/payments/order-ledger";
import { paths } from "@/paths";
import { getWebsiteSettings } from "@/services/catalogue";
import { getPaymentAcknowledgement } from "@/services/member";

import { requestOfficialInvoice } from "../actions";

export const metadata: Metadata = { title: "Payment Acknowledgement" };

interface AcknowledgementPageProps {
  params: Promise<{ reference: string }>;
}

/**
 * A Paid Order's Payment Acknowledgement (Phase 4, ticket 06; mockup
 * L662–674; spec, Phase 4 → Payment Acknowledgement; stories 143, 144,
 * 151u): printable, with the business details from Settings as the seller,
 * and "Request official invoice" under it (ticket 08).
 * Only the Order's own Member can open it, and only once it's Paid: anything
 * else answers not found. The gate, consent, the Active Device and
 * onboarding come first, coming back here.
 */
export default async function AcknowledgementPage({ params }: AcknowledgementPageProps) {
  const { reference } = await params;
  const from = isOrderReference(reference)
    ? paths.memberApp.acknowledgement(reference)
    : paths.memberApp.billing;
  const { member } = await requireMemberWithExam(from);
  const acknowledgement = await getPaymentAcknowledgement(member.userId, reference);
  if (!acknowledgement) notFound();
  const { business } = await getWebsiteSettings();

  return (
    <PaymentAcknowledgementDocument
      view={acknowledgementView(acknowledgement, business)}
      memberName={member.name ?? ""}
      requestInvoice={requestOfficialInvoice}
    />
  );
}
