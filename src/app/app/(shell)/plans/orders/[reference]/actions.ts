"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { requireMemberWithExam } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { checkOrderStatus, getMemberOrder, pollOrderStatus } from "@/services/member";
import { orderReferenceSchema, simulateFormSchema } from "@/services/member.schema";
import { paymentsClient, samplePaymentsFake } from "@/services/payments";

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

/**
 * The status-check backup (ticket 04; spec, Phase 4 planning decisions →
 * Recording an outcome): Confirming payment's poller calls it after about 15
 * seconds with no outcome. It asks the payments client for the status of one
 * of the signed-in Member's own Pending Orders, at most once every 10 seconds
 * per Order however many screens or servers ask, and records the outcome
 * through the Order ledger, as the webhook will. PayMongo's answer is Paid or
 * still pending (a failed try can be retried on its page; the webhook,
 * ticket 05, records failures); the fake can answer Failed too. Anything else (another
 * Member's Order, an address that isn't a reference, no client) asks nothing
 * and says nothing. The poller reads the Order again after it.
 */
export async function checkPayment(reference: string): Promise<void> {
  const sent = orderReferenceSchema.safeParse(reference);
  const { member } = await requireMemberWithExam(
    sent.success ? paths.memberApp.order(sent.data) : paths.memberApp.plans,
  );
  if (!sent.success) return;
  await pollOrderStatus(member.userId, sent.data, paymentsClient());
}
