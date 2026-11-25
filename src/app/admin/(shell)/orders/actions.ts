"use server";

import { adminAction } from "@/lib/admin/action";
import { checkOrderWithPayMongo, markInvoiceSent, saveOrderNote } from "@/services/admin";
import { orderNoteInputSchema, orderReferenceInputSchema } from "@/services/admin.schema";
import { paymentsClient } from "@/services/payments";

// The Order detail page's Server Actions (Phase 4, ticket 07), for Owners
// only: an Editor's call is refused on the server, whatever the menu shows.
// Each one checks the input's shape; the seam checks the rest.

/** "Save note": the internal note, with the conflict check against the stamp the page opened with. */
export const saveNote = adminAction(
  { role: "owner", schema: orderNoteInputSchema, requiresStamp: true },
  saveOrderNote,
);

/**
 * "Check status with PayMongo": the status-check backup's own check, with
 * this server's payments client (PayMongo, or the fake in sample mode).
 */
export const checkStatus = adminAction(
  { role: "owner", schema: orderReferenceInputSchema },
  async (actor, { reference }) => checkOrderWithPayMongo(actor, reference, paymentsClient()),
);

/**
 * "Mark invoice sent" (ticket 08): once the official invoice has gone from
 * the support inbox. Marking it again changes nothing. No email is sent.
 */
export const markInvoiceSentAction = adminAction(
  { role: "owner", schema: orderReferenceInputSchema },
  async (actor, { reference }) => markInvoiceSent(actor, reference),
);
