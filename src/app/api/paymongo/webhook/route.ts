import { serverEnv } from "@/env.server";
import { recordPaymentEvent } from "@/services/member";
import { paymentsClient } from "@/services/payments";

// POST /api/paymongo/webhook (Phase 4, ticket 05; spec, Phase 4 planning
// decisions → Recording an outcome): PayMongo's events, as they happen.
// - Nothing is trusted before the Paymongo-Signature header checks out over
//   the raw body with PAYMONGO_WEBHOOK_SECRET (401), and the body reads as an
//   event (400). Neither changes anything.
// - Each event is applied once, by its id, through the same ledger as the
//   status check, and logged in Staff Activity as "PayMongo (system)".
// - An event about no Order of ours, an event type buying doesn't act on, and
//   an event from the other mode (live on a test server, or test on a live
//   one) are acknowledged with 200, so PayMongo stops retrying, and change
//   nothing.
// - Without PAYMONGO_WEBHOOK_SECRET, or a payments client, the route answers
//   404. The work is a few small writes, well inside PayMongo's 30 seconds.
// Logs name the event's id and type, never the secret or the signature.

const RECEIVED = { received: true } as const;

export async function POST(request: Request): Promise<Response> {
  const client = paymentsClient();
  if (!serverEnv.PAYMONGO_WEBHOOK_SECRET || !client) return new Response(null, { status: 404 });

  const rawBody = await request.text();
  const check = await client.verifyWebhook(rawBody, request.headers.get("paymongo-signature"));
  if (!check.ok) {
    return Response.json(
      { error: check.reason },
      { status: check.reason === "bad-signature" ? 401 : 400 },
    );
  }
  if (!check.event) return Response.json(RECEIVED);

  const { event } = check;
  if (event.livemode !== client.livemode) {
    console.warn(
      `PayMongo event ${event.id} (${event.type}) is ${event.livemode ? "live" : "a test"} on a server taking ${client.livemode ? "real" : "test"} payments; ignored.`,
    );
    return Response.json(RECEIVED);
  }
  if ((await recordPaymentEvent(event)) === "unknown-order") {
    console.warn(`PayMongo event ${event.id} (${event.type}) is about no Order here; ignored.`);
  }
  return Response.json(RECEIVED);
}
