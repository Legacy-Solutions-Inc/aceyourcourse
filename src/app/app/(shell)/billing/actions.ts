"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { requestInvoice } from "@/services/member";
import { INVOICE_REFUSALS, orderReferenceSchema } from "@/services/member.schema";
import type { InvoiceFieldErrors } from "@/services/member.types";

// "Request official invoice" (Phase 4, ticket 08; spec, Phase 4 planning
// decisions → Payment Acknowledgement and Invoice Requests; story 151j), from
// Billing and the Payment Acknowledgement. It runs the Member App's server
// checks first (the gate, consent, then the Active Device), and asks only for
// the signed-in Member: who they are comes from the session alone, and the
// Member seam refuses an Order that isn't theirs, isn't Paid, or already has
// a request. Nothing is emailed: Owners issue the invoice outside the app.

/** What the form shows after a send: a refusal for the Order, or a message per field. */
export interface InvoiceFormState {
  error: string | null;
  fields: InvoiceFieldErrors;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * Records the Invoice Request for the Order with this reference (bound by the
 * form): Billing and the Acknowledgement then say "Invoice requested".
 */
export async function requestOfficialInvoice(
  reference: string,
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const member = await requireMember(paths.memberApp.billing);
  const sent = orderReferenceSchema.safeParse(reference);
  if (!sent.success) return { error: INVOICE_REFUSALS["not-found"], fields: {} };
  const result = await requestInvoice(member.userId, sent.data, {
    name: text(formData, "name"),
    address: text(formData, "address"),
    tin: text(formData, "tin"),
  });
  if (!result.ok) {
    return result.reason === "invalid"
      ? { error: null, fields: result.fields }
      : { error: INVOICE_REFUSALS[result.reason], fields: {} };
  }
  revalidatePath(paths.memberApp.billing);
  revalidatePath(paths.memberApp.acknowledgement(sent.data));
  return { error: null, fields: {} };
}
