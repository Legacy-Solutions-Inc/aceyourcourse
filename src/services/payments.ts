import "server-only";

import { type AdminMode, adminMode } from "@/lib/admin/mode";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentsClient } from "@/services/payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// The payments selector (Phase 4, ticket 03; spec, Phase 4 planning decisions
// → The key decides; no new switch): the payments client this server has, if
// any. Sample mode has the fake, so buying can be clicked through locally;
// anywhere else there's none, and the Plans page reads "Buying opens soon",
// disabled, with Pay refused on the server. Ticket 04 extends the mode with
// PayMongo's key: a test or live key gives the real client.
// ─────────────────────────────────────────────────────────────────────────────

/** Which payments client the server has: the fake, or none. */
export type PaymentsMode = "fake" | "none";

export interface PaymentsModeInputs {
  adminMode: AdminMode;
}

/** Pure: the fake in sample mode, otherwise none. */
export function computePaymentsMode({ adminMode: mode }: PaymentsModeInputs): PaymentsMode {
  return mode === "sample" ? "fake" : "none";
}

/** The mode this server runs in, fixed for a given build and environment. */
export const paymentsMode = computePaymentsMode({ adminMode });

// The fake keeps what was simulated, so it lives on globalThis like the sample
// store: every route module and HMR reload share one.
const FAKE = Symbol.for("aceyourcourse.payments.fake");
const holder = globalThis as typeof globalThis & { [FAKE]?: FakePaymentsClient };

/** The payments fake, only in sample mode: what "Simulate paid" and "Simulate failed" drive. */
export function samplePaymentsFake(): FakePaymentsClient | null {
  if (paymentsMode !== "fake") return null;
  return (holder[FAKE] ??= createFakePaymentsClient());
}

/** The payments client this server has, or null when buying isn't set up. */
export function paymentsClient(): PaymentsClient | null {
  return samplePaymentsFake();
}
