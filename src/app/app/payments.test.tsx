import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import { setPlanOnSale } from "@/services/admin.mock";
import {
  addTargetExam,
  getOrCreateMember,
  listAccessPasses,
  recordConsent,
} from "@/services/member.mock";
import { sampleUserId } from "@/services/mock/members";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { sampleActor } from "../../../test/admin-inputs";
import { onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

// Buying in the Member App (Phase 4, ticket 03; spec, Phase 4 → Return flow;
// Phase 4 planning decisions → Paying, The key decides; stories 135–140,
// 151a, 151b, 151d and 151n), on sample data with the payments fake: the
// pages and actions as a browser would reach them. Pay makes a Pending Order
// and goes to Confirming payment; "Simulate paid" and "Simulate failed"
// record the outcome there, in sample mode only. Only the Order's own Member
// can open it. It's 17 Nov 2026, 11:42 in Manila. The tester's CE pass ends
// in 90 days, on 15 Feb 2027.
const { jar, payments } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  payments: { configured: true },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/app/plans",
  useRouter: () => ({ refresh: () => {} }),
}));
// A server without a payments client, when a test turns it off.
vi.mock("@/services/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/payments")>();
  return {
    ...actual,
    paymentsClient: () => (payments.configured ? actual.paymentsClient() : null),
    samplePaymentsFake: () => (payments.configured ? actual.samplePaymentsFake() : null),
  };
});

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const MINUTE = 60_000;
const OWNER = sampleActor("owner");
const TESTER = { email: "tester@example.com", name: "Bea Tester" };
const STRANGER = { email: "stranger@example.com", name: "Sam Stranger" };

const redirectsTo = (url: string) =>
  new RegExp(`^NEXT_REDIRECT ${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** Signed in on this browser as a sample User who has agreed, with CE as their Target Exam. */
async function signedIn({ email, name } = TESTER) {
  const userId = sampleUserId(email);
  await getOrCreateMember({ userId, email, name });
  await onThisDevice(userId);
  await recordConsent(userId, { termsVersion: "2.0", privacyVersion: "2.0" });
  await addTargetExam(userId, { examCode: "CE", examDate: "2027-01-10" });
  jar.set("ayc_admin_sample", email);
  jar.set(DEVICE_COOKIE, TEST_DEVICE_TOKEN);
  return userId;
}

/** Signed in as Sam, a second Member, let in as a Beta Tester. */
async function signedInAsStranger() {
  getSampleStore().betaTesters.push({
    email: STRANGER.email,
    addedAt: BOOT.toISOString(),
    addedBy: { email: OWNER.email, name: OWNER.name },
  });
  return signedIn(STRANGER);
}

function payForm(fields: { examCode?: string; plan?: string; method?: string } = {}) {
  const form = new FormData();
  form.set("examCode", fields.examCode ?? "CE");
  form.set("plan", fields.plan ?? samplePlanId("CE", 90));
  form.set("method", fields.method ?? "gcash");
  return form;
}

const pay = async (form = payForm()) =>
  (await import("./(shell)/plans/actions")).pay({ error: null }, form);
const plansPage = async () =>
  (await import("./(shell)/plans/page")).default({ searchParams: Promise.resolve({}) });
const orderPage = async (reference: string) =>
  (await import("./(shell)/plans/orders/[reference]/page")).default({
    params: Promise.resolve({ reference }),
  });
async function simulate(reference: string, outcome: string) {
  const form = new FormData();
  form.set("reference", reference);
  form.set("outcome", outcome);
  return (await import("./(shell)/plans/orders/[reference]/actions")).simulatePayment(form);
}

/** Pays for CE 3 months with this method, as the signed-in Member; gives the Order's reference. */
async function paid(method = "gcash") {
  await expect(pay(payForm({ method }))).rejects.toThrow(/^NEXT_REDIRECT \/app\/plans\/orders\//);
  const order = getSampleStore().orders.at(-1);
  if (!order) throw new Error("Pay made no Order.");
  return order.reference;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  payments.configured = true;
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Pay on the Plans page", () => {
  it("offers Pay with the Best value Plan's price in sample mode", async () => {
    await signedIn();
    render(await plansPage());

    expect(screen.getByRole("button", { name: "Pay ₱1,299 with PayMongo" })).toBeEnabled();
  });

  it("reads Buying opens soon, disabled, on a server with no payments client", async () => {
    payments.configured = false;
    await signedIn();
    render(await plansPage());

    expect(screen.getByRole("button", { name: "Buying opens soon" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
  });

  it("makes a Pending Order for the signed-in Member and goes to Confirming payment", async () => {
    const userId = await signedIn();

    await expect(pay()).rejects.toThrow(redirectsTo("/app/plans/orders/AYC-10001"));
    expect(getSampleStore().orders).toEqual([
      expect.objectContaining({
        reference: "AYC-10001",
        userId,
        planId: samplePlanId("CE", 90),
        priceCentavos: 129_900,
        method: "gcash",
        status: "pending",
      }),
    ]);
  });

  it("lets Staff buy like any Member", async () => {
    await signedIn({ email: OWNER.email, name: OWNER.name });
    await expect(pay()).rejects.toThrow(redirectsTo("/app/plans/orders/AYC-10001"));
  });

  it("refuses a Plan an Owner switched off, making no Order", async () => {
    await setPlanOnSale(OWNER, samplePlanId("CE", 90), false);
    await signedIn();

    expect(await pay()).toEqual({ error: "That plan isn’t on sale any more. Pick another one." });
    expect(getSampleStore().orders).toEqual([]);
  });

  it.each([
    [
      "a Plan of another Exam than the one posted",
      payForm({ examCode: "ME" }),
      "That plan isn’t for this exam. Pick one of the plans shown.",
    ],
    [
      "a Payment Method that isn't one of the four",
      payForm({ method: "paypal" }),
      "Pick QR Ph, GCash, Maya or Card to pay with.",
    ],
  ])("refuses %s, making no Order", async (_what, form, message) => {
    await signedIn();

    expect(await pay(form)).toEqual({ error: message });
    expect(getSampleStore().orders).toEqual([]);
  });

  it("refuses on the server where there's no payments client, making no Order", async () => {
    payments.configured = false;
    await signedIn();

    expect(await pay()).toEqual({ error: "Buying isn’t open yet. You weren’t charged." });
    expect(getSampleStore().orders).toEqual([]);
  });

  it("sends someone signed out to sign in, making no Order", async () => {
    await expect(pay()).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Fplans%3Fexam%3DCE"),
    );
    expect(getSampleStore().orders).toEqual([]);
  });
});

describe("the Order's page", () => {
  it("shows Confirming payment for a Pending Order, with Simulate paid and failed in sample mode", async () => {
    await signedIn();
    const reference = await paid();
    render(await orderPage(reference));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Waiting for PayMongo to confirm your GCash payment",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REF AYC-10001/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate paid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate failed" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says it's still waiting, pointing to Support, about 2 minutes on", async () => {
    await signedIn();
    const reference = await paid();
    vi.setSystemTime(new Date(BOOT.getTime() + 2 * MINUTE));
    render(await orderPage(reference));

    expect(screen.getByRole("status")).toHaveTextContent("Still waiting for PayMongo.");
  });

  it("answers not found for another Member's Order", async () => {
    await signedInAsStranger();
    const reference = await paid();

    await signedIn();
    await expect(orderPage(reference)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(["AYC-99999", "nonsense"])("answers not found for %j", async (reference) => {
    await signedIn();
    await expect(orderPage(reference)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends someone signed out to sign in, coming back to the Order", async () => {
    await expect(orderPage("AYC-10001")).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Fplans%2Forders%2FAYC-10001"),
    );
  });
});

describe("Simulate paid and Simulate failed", () => {
  it("Simulate paid opens the Order's Exam to the Member: their 90 days left + 90 = 180", async () => {
    const userId = await signedIn();
    const reference = await paid();

    await simulate(reference, "paid");
    render(await orderPage(reference));

    expect(screen.getByText("✓ PAYMENT CONFIRMED")).toBeInTheDocument();
    expect(
      screen.getByText(
        "It’s active until 16 May 2027. It won’t renew on its own. We’ll remind you a week before it ends.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("₱1,299 · GCASH · REF AYC-10001 · RECEIPT IN BILLING"),
    ).toBeInTheDocument();
    const ce = (await listAccessPasses(userId)).find((pass) => pass.examCode === "CE");
    expect(ce?.endsAt).toBe(new Date(BOOT.getTime() + 180 * 24 * 60 * MINUTE).toISOString());
  });

  it("Simulate failed with Card shows the card-declined copy and Try another method", async () => {
    await signedIn();
    const reference = await paid("card");

    await simulate(reference, "failed");
    render(await orderPage(reference));

    expect(
      screen.getByRole("heading", { level: 1, name: "Your card was declined" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You weren’t charged. Try again, or pay with QR Ph, GCash, or Maya instead.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try another method" })).toHaveAttribute(
      "href",
      "/app/plans?exam=CE",
    );
  });

  it("is refused outside sample mode, changing nothing", async () => {
    await signedIn();
    const reference = await paid();
    payments.configured = false;

    await expect(simulate(reference, "paid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSampleStore().orders[0]?.status).toBe("pending");
  });

  it("offers no simulation outside sample mode", async () => {
    await signedIn();
    const reference = await paid();
    payments.configured = false;
    render(await orderPage(reference));

    expect(screen.queryByRole("button", { name: /Simulate/ })).not.toBeInTheDocument();
  });

  it("never settles another Member's Order", async () => {
    await signedInAsStranger();
    const reference = await paid();

    await signedIn();
    await expect(simulate(reference, "paid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSampleStore().orders[0]?.status).toBe("pending");
  });

  it("refuses an outcome that isn't paid or failed", async () => {
    await signedIn();
    const reference = await paid();

    await expect(simulate(reference, "refunded")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getSampleStore().orders[0]?.status).toBe("pending");
  });
});
