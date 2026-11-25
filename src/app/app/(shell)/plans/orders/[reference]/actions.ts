"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { checkOrderStatus, getMemberOrder } from "@/services/member";
import { simulateFormSchema } from "@/services/member.schema";
import { samplePaymentsFake } from "@/services/payments";

// Sample mode's "Simulate paid" and "Simulate failed" (Phase 4, ticket 03;
// spec, Phase 4 planning decisions → The key decides): the payments fake
// reports the outcome for one of the signed-in Member's own Orders, and the
// status check records it through the Order ledger, as PayMongo's answer
// will (tickets 04 and 05). Anywhere but sample mode there's no fake, and
// this refuses before reading anything.

/** "Simulate paid" / "Simulate failed": the form names the Order and the outcome. */
export async function simulatePayment(formData: FormData): Promise<void> {
  const fake = samplePaymentsFake();
  if (!fake) notFound();
  const sent = simulateFormSchema.safeParse({
    reference: formData.get("reference"),
    outcome: formData.get("outcome"),
  });
  if (!sent.success) notFound();
  const { reference, outcome } = sent.data;

  const { member } = await requireMemberWithExam(paths.memberApp.order(reference));
  const order = await getMemberOrder(member.userId, reference);
  if (!order) notFound();
  fake.simulate(order.id, outcome);
  await checkOrderStatus(member.userId, reference, fake);
  revalidatePath(paths.memberApp.order(reference));
}
