import type { Metadata } from "next";

import { BillingScreen } from "@/components/member-app/billing-screen";
import { orderRow, passCard } from "@/components/member-app/billing-view";
import { MemberScreen } from "@/components/member-app/member-screen";
import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { listAccessPasses, listMemberOrders } from "@/services/member";

export const metadata: Metadata = { title: "Billing" };

/**
 * Billing (05; mockup L452–477; Phase 4, ticket 06; stories 143, 144): the
 * signed-in Member's Access Passes, active ones first, each with Renew now,
 * and every Order of theirs, newest first, as at this request (a Pending
 * Order older than 24 hours reads Expired). Each Paid Order links to its
 * Payment Acknowledgement. Only the Member's own passes and Orders are read.
 * The gate, consent, the Active Device and onboarding come first.
 */
export default async function BillingPage() {
  const { member } = await requireMemberWithExam(paths.memberApp.billing);
  const [passes, orders] = await Promise.all([
    listAccessPasses(member.userId),
    listMemberOrders(member.userId),
  ]);
  const now = new Date();
  const cards = passes
    .map((pass) => passCard(pass, now))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.examCode.localeCompare(b.examCode));

  return (
    <MemberScreen eyebrow="05 · BILLING" title="Plans and purchases">
      <BillingScreen passes={cards} orders={orders.map(orderRow)} />
    </MemberScreen>
  );
}
