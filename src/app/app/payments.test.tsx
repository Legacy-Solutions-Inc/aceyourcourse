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
import { createFakePaymentsClient } from "@/services/payments.fake";
import type { PaymentsClient } from "@/services/payments.types";

import { sampleActor } from "../../../test/admin-inputs";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

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
  payments: {
    configured: true,
    /** A client standing in for this server's, when a test sets one (PayMongo's, made from the fake). */
    client: null as PaymentsClient | null,
    /** Whether the server shows the TEST PAYMENTS strip, as a test key would. */
    strip: false,
  },
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
    paymentsClient: () => payments.client ?? (payments.configured ? actual.paymentsClient() : null),
    showTestPaymentsStrip: () => payments.strip,
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
  await recordConsent(userId, AGREED_TO_CURRENT);
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
const plansPage = async (searchParams: Record<string, string> = {}) =>
  (await import("./(shell)/plans/page")).default({ searchParams: Promise.resolve(searchParams) });
const checkPayment = async (reference: string) =>
  (await import("./(shell)/plans/orders/[reference]/actions")).checkPayment(reference);
const SECOND = 1_000;

/** PayMongo's client as Pay sees it with a test key: the fake, starting a real-looking checkout. */
function payMongoTest() {
  const fake = createFakePaymentsClient();
  const client: PaymentsClient = {
    ...fake,
    kind: "paymongo",
    startCheckout: async () => ({
      ok: true,
      checkoutId: "cs_FakeCreated0001TestOnly",
      redirectTo: "https://checkout.paymongo.com/cs_FakeCreated0001TestOnly",
      livemode: false,
    }),
  };
  payments.client = client;
  return fake;
}
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
  payments.client = null;
  payments.strip = false;
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

  it("goes to PayMongo's checkout page with a test key, recording the session and livemode false", async () => {
    payMongoTest();
    await signedIn();

    await expect(pay()).rejects.toThrow(
      redirectsTo("https://checkout.paymongo.com/cs_FakeCreated0001TestOnly"),
    );
    expect(getSampleStore().orders).toEqual([
      expect.objectContaining({
        reference: "AYC-10001",
        status: "pending",
        checkoutId: "cs_FakeCreated0001TestOnly",
        livemode: false,
      }),
    ]);
  });

  it("says it couldn't start the payment, going nowhere, when PayMongo answers an error", async () => {
    const fake = createFakePaymentsClient();
    fake.refuseCheckouts();
    payments.client = fake;
    await signedIn();

    expect(await pay()).toEqual({ error: "Couldn’t start the payment. Try again." });
    expect(getSampleStore().orders).toEqual([
      expect.objectContaining({ reference: "AYC-10001", status: "pending", checkoutId: null }),
    ]);
  });

  it("says the payment was cancelled back from PayMongo's Cancel, on that Exam's Plans", async () => {
    await signedIn();
    render(await plansPage({ exam: "CE", payment: "cancelled" }));

    expect(screen.getByRole("status")).toHaveTextContent("Payment cancelled · you weren’t charged");
    expect(screen.getByRole("link", { name: /^CE/ })).toHaveAttribute("aria-current", "page");
  });

  it("says nothing of a cancelled payment otherwise", async () => {
    await signedIn();
    render(await plansPage({ exam: "CE", payment: "anything" }));

    expect(screen.queryByText(/Payment cancelled/)).not.toBeInTheDocument();
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

  it("shows an Order still Pending after 24 hours as Expired: off to Billing, before any sweep (ticket 05)", async () => {
    await signedIn();
    const reference = await paid();
    vi.setSystemTime(new Date(BOOT.getTime() + 24 * 60 * MINUTE + MINUTE));

    await expect(orderPage(reference)).rejects.toThrow(redirectsTo("/app/billing"));
    expect(getSampleStore().orders[0]?.status).toBe("pending");
  });

  it("still shows Confirming payment at 23 h 59 m", async () => {
    await signedIn();
    const reference = await paid();
    vi.setSystemTime(new Date(BOOT.getTime() + 24 * 60 * MINUTE - MINUTE));

    render(await orderPage(reference));

    expect(screen.getByText("CONFIRMING PAYMENT")).toBeInTheDocument();
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
      screen.getByText("₱1,299 · GCASH · REF AYC-10001 · ACKNOWLEDGEMENT IN BILLING"),
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

describe("the status-check backup on Confirming payment", () => {
  /** Pays with PayMongo's test checkout; gives the Order's reference and the fake answering for PayMongo. */
  async function paidWithPayMongo() {
    const fake = payMongoTest();
    await expect(pay()).rejects.toThrow(/^NEXT_REDIRECT https:\/\/checkout\.paymongo\.com\//);
    const order = getSampleStore().orders.at(-1);
    if (!order) throw new Error("Pay made no Order.");
    return { fake, order };
  }

  it("has the poller ask the server where there's a payments client", async () => {
    await signedIn();
    const { order } = await paidWithPayMongo();

    const page = (await orderPage(order.reference)) as React.ReactElement<{
      check: unknown;
    }>;

    expect(page.props.check).toEqual(expect.any(Function));
  });

  it("gives the poller nothing to ask where there's no payments client", async () => {
    await signedIn();
    const reference = await paid();
    payments.configured = false;

    const page = (await orderPage(reference)) as React.ReactElement<{ check: unknown }>;

    expect(page.props.check).toBeNull();
  });

  it("shows Paid once PayMongo says paid, with no webhook", async () => {
    await signedIn();
    const { fake, order } = await paidWithPayMongo();
    fake.simulate(order.id, "paid");
    vi.setSystemTime(new Date(BOOT.getTime() + 15 * SECOND));

    await checkPayment(order.reference);
    render(await orderPage(order.reference));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You’re in.");
    expect(fake.statusChecks).toEqual([
      {
        orderId: order.id,
        reference: "AYC-10001",
        checkoutId: "cs_FakeCreated0001TestOnly",
      },
    ]);
  });

  it("asks PayMongo at most once every 10 seconds per Order", async () => {
    await signedIn();
    const { fake, order } = await paidWithPayMongo();

    vi.setSystemTime(new Date(BOOT.getTime() + 15 * SECOND));
    await checkPayment(order.reference);
    vi.setSystemTime(new Date(BOOT.getTime() + 18 * SECOND));
    await checkPayment(order.reference);
    expect(fake.statusChecks).toHaveLength(1);

    vi.setSystemTime(new Date(BOOT.getTime() + 25 * SECOND));
    await checkPayment(order.reference);
    expect(fake.statusChecks).toHaveLength(2);
  });

  it("changes nothing while PayMongo says still pending", async () => {
    const userId = await signedIn();
    const { order } = await paidWithPayMongo();
    const passes = await listAccessPasses(userId);
    vi.setSystemTime(new Date(BOOT.getTime() + 15 * SECOND));

    await checkPayment(order.reference);

    expect(getSampleStore().orders[0]?.status).toBe("pending");
    expect(await listAccessPasses(userId)).toEqual(passes);
  });

  it("never asks about or settles another Member's Order", async () => {
    await signedInAsStranger();
    const { fake, order } = await paidWithPayMongo();
    fake.simulate(order.id, "paid");

    await signedIn();
    vi.setSystemTime(new Date(BOOT.getTime() + 15 * SECOND));
    await checkPayment(order.reference);

    expect(fake.statusChecks).toEqual([]);
    expect(getSampleStore().orders[0]?.status).toBe("pending");
  });

  it("asks nothing for an address that isn't a reference", async () => {
    await signedIn();
    const { fake } = await paidWithPayMongo();

    await checkPayment("AYC-10001; drop table orders");

    expect(fake.statusChecks).toEqual([]);
  });

  it("sends someone signed out to sign in, asking nothing", async () => {
    const fake = payMongoTest();

    await expect(checkPayment("AYC-10001")).rejects.toThrow(/^NEXT_REDIRECT \/app\/sign-in/);
    expect(fake.statusChecks).toEqual([]);
  });
});

describe("the TEST PAYMENTS strip", () => {
  const memberApp = async () =>
    render((await import("./layout")).default({ children: <p>A Member App screen</p> }));

  it("heads every Member App screen with a test key", async () => {
    payments.strip = true;
    await memberApp();

    expect(screen.getByRole("note", { name: "TEST PAYMENTS" })).toHaveTextContent(
      "TEST PAYMENTS · no real money",
    );
    expect(screen.getByText("A Member App screen")).toBeInTheDocument();
  });

  it("isn't there with a live key, the fake or no key", async () => {
    await memberApp();

    expect(screen.queryByText(/TEST PAYMENTS/)).not.toBeInTheDocument();
  });
});
