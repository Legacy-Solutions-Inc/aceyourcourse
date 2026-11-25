import "server-only";

import { config } from "@/config";
import { serverEnv } from "@/env.server";
import { type AdminMode, adminMode } from "@/lib/admin/mode";
import { createPayMongoClient } from "@/lib/paymongo/client";
import { createFakePaymentsClient, type FakePaymentsClient } from "@/services/payments.fake";
import type { PaymentsClient } from "@/services/payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// The payments selector (Phase 4, tickets 03 and 04; spec, Phase 4 planning
// decisions → The key decides; no new switch): the payments client this
// server has, if any.
// - Sample mode: the fake, so buying can be clicked through locally.
// - Otherwise PayMongo's secret key decides. A test key (sk_test_…) takes
//   PayMongo's test payments, under a "TEST PAYMENTS · no real money" strip
//   on every Member App screen; a live key (sk_live_…) takes real money.
// - No key, or one that isn't PayMongo's secret key (logged, without the
//   key): none. The Plans page reads "Buying opens soon", disabled, and Pay
//   is refused on the server.
// ─────────────────────────────────────────────────────────────────────────────

/** Which payments client the server has. */
export type PaymentsMode = "fake" | "test" | "live" | "none";

export interface PaymentsModeInputs {
  adminMode: AdminMode;
  /** PAYMONGO_SECRET_KEY as set, if at all. */
  secretKey: string | undefined;
}

const SECRET_KEY = /^sk_(test|live)_[A-Za-z0-9]+$/;

/** Pure: the fake in sample mode; otherwise test or live by PayMongo's key, or none. */
export function computePaymentsMode({
  adminMode: mode,
  secretKey,
}: PaymentsModeInputs): PaymentsMode {
  if (mode === "sample") return "fake";
  const kind = secretKey?.match(SECRET_KEY)?.[1];
  return kind === "test" ? "test" : kind === "live" ? "live" : "none";
}

/** Pure: what to log about a key that's set but isn't PayMongo's secret key; never the key. */
export function paymentsKeyWarning(secretKey: string | undefined): string | null {
  if (!secretKey || SECRET_KEY.test(secretKey)) return null;
  return "PAYMONGO_SECRET_KEY isn't a PayMongo secret key (sk_test_… or sk_live_…), so buying stays off.";
}

/** Pure: whether the Member App shows the "TEST PAYMENTS · no real money" strip. */
export const testPaymentsShown = (mode: PaymentsMode): boolean => mode === "test";

/** The mode this server runs in, fixed for a given build and environment. */
export const paymentsMode = computePaymentsMode({
  adminMode,
  secretKey: serverEnv.PAYMONGO_SECRET_KEY,
});

/** Whether this server shows the TEST PAYMENTS strip: a boolean for the Member App, never the key. */
export const showTestPaymentsStrip = (): boolean => testPaymentsShown(paymentsMode);

const keyWarning = paymentsKeyWarning(serverEnv.PAYMONGO_SECRET_KEY);
if (keyWarning && adminMode !== "sample") console.warn(keyWarning);

// The fake keeps what was simulated, so it lives on globalThis like the sample
// store: every route module and HMR reload share one.
const FAKE = Symbol.for("aceyourcourse.payments.fake");
const holder = globalThis as typeof globalThis & { [FAKE]?: FakePaymentsClient };

/** The payments fake, only in sample mode: what "Simulate paid" and "Simulate failed" drive. */
export function samplePaymentsFake(): FakePaymentsClient | null {
  if (paymentsMode !== "fake") return null;
  return (holder[FAKE] ??= createFakePaymentsClient());
}

const payMongo =
  (paymentsMode === "test" || paymentsMode === "live") && serverEnv.PAYMONGO_SECRET_KEY
    ? createPayMongoClient({
        secretKey: serverEnv.PAYMONGO_SECRET_KEY,
        webhookSecret: serverEnv.PAYMONGO_WEBHOOK_SECRET,
        siteUrl: config.site.url,
      })
    : null;

/** The payments client this server has, or null when buying isn't set up. */
export function paymentsClient(): PaymentsClient | null {
  return payMongo ?? samplePaymentsFake();
}
