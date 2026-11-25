import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEVICE_COOKIE } from "@/lib/member-app/device-token";
import {
  addTargetExam,
  checkOrderStatus,
  getOrCreateMember,
  payForPlan,
  recordConsent,
} from "@/services/member.mock";
import { updateWebsiteSettings } from "@/services/mock/admin/settings";
import { sampleUserId } from "@/services/mock/members";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { createFakePaymentsClient } from "@/services/payments.fake";
import {
  INVOICE_ADDRESS_REQUIRED,
  INVOICE_NAME_REQUIRED,
  INVOICE_REFUSALS,
} from "@/services/member.schema";

import { sampleActor } from "../../../test/admin-inputs";
import { AGREED_TO_CURRENT, onThisDevice, TEST_DEVICE_TOKEN } from "../../../test/member-inputs";

// Billing and the Payment Acknowledgement in the Member App (Phase 4, ticket
// 06; spec, Phase 4 → Payment Acknowledgement; stories 143, 144, 151u), on
// sample data with the payments fake: the pages as a browser would reach
// them. A Member sees only their own Orders, and an Acknowledgement only for
// one of their own Paid Orders. "Request official invoice" (ticket 08; story
// 151j) records an Invoice Request for one of the Member's own Paid Orders,
// once. "Now" is 17 Nov 2026, 11:42 in Manila.
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));

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
  usePathname: () => "/app/billing",
  useRouter: () => ({ refresh: () => {} }),
}));

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
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

/** The signed-in Member buys CE for `days` with the fake, and the payment ends `outcome` (or stays Pending). */
async function bought(userId: string, outcome: "paid" | "failed" | "pending", days = 90) {
  const fake = createFakePaymentsClient();
  const result = await payForPlan(
    userId,
    { examCode: "CE", planId: samplePlanId("CE", days), method: "qrph" },
    fake,
  );
  if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
  if (outcome !== "pending") {
    const order = getSampleStore().orders.find((held) => held.reference === result.reference);
    fake.simulate(order!.id, outcome);
    await checkOrderStatus(userId, result.reference, fake);
  }
  return result.reference;
}

const billingPage = async () => (await import("./(shell)/billing/page")).default();
const acknowledgementPage = async (reference: string) =>
  (await import("./(shell)/billing/[reference]/page")).default({
    params: Promise.resolve({ reference }),
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  jar.clear();
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Billing", () => {
  it("shows the CE pass a Member bought and its Paid Order, with its Payment Acknowledgement", async () => {
    const userId = await signedIn();
    // The sample tester holds a CE pass already: buying 3 months adds 90 days to it.
    await bought(userId, "paid");
    render(await billingPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Plans and purchases" }),
    ).toBeInTheDocument();
    const access = within(screen.getByRole("region", { name: "Access" }));
    expect(access.getByRole("heading", { name: "CE All-Access" })).toBeInTheDocument();
    expect(access.getByText("ACTIVE")).toBeInTheDocument();
    expect(access.getByText(/^Until .* days left · renews only if you renew$/)).toBeInTheDocument();
    const [row] = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");
    expect(row).toHaveTextContent("CE All-Access · 3 months");
    expect(row).toHaveTextContent("17 NOV 2026 · QR Ph · AYC-10001");
    expect(row).toHaveTextContent("PAID");
    expect(row).toHaveTextContent("₱1,299");
    expect(
      within(row!).getByRole("link", { name: "Payment Acknowledgement for AYC-10001" }),
    ).toHaveAttribute("href", "/app/billing/AYC-10001");
  });

  it("says No payments yet, with See plans, for a Member who has never paid nor been granted access", async () => {
    getSampleStore().betaTesters.push({
      email: STRANGER.email,
      addedAt: BOOT.toISOString(),
      addedBy: { email: OWNER.email, name: OWNER.name },
    });
    await signedIn(STRANGER);
    render(await billingPage());

    expect(screen.getByText("No payments yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/app/plans");
  });

  it("shows a granted pass, and No payments yet, to a Member who has never paid", async () => {
    // The sample tester holds a granted CE pass and no Orders.
    await signedIn();
    render(await billingPage());

    expect(
      within(screen.getByRole("region", { name: "Access" })).getByText("ACTIVE"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Orders" })).getByText("No payments yet"),
    ).toBeInTheDocument();
  });

  it("shows an Order still Pending after 24 hours as Expired, with no Acknowledgement", async () => {
    const userId = await signedIn();
    await bought(userId, "pending");
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));
    render(await billingPage());

    const [row] = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");
    expect(row).toHaveTextContent("EXPIRED");
    expect(within(row!).queryByRole("link")).not.toBeInTheDocument();
  });

  it("dates an Order bought at 00:30 in Manila on that Manila day", async () => {
    // 00:30 on 18 Nov in Manila is 16:30 UTC on 17 Nov.
    vi.setSystemTime(new Date("2026-11-17T16:30:00.000Z"));
    const userId = await signedIn();
    await bought(userId, "failed");
    render(await billingPage());

    expect(screen.getByText("18 NOV 2026 · QR Ph · AYC-10001")).toBeInTheDocument();
  });

  it("never shows another Member's Orders", async () => {
    getSampleStore().betaTesters.push({
      email: STRANGER.email,
      addedAt: BOOT.toISOString(),
      addedBy: { email: OWNER.email, name: OWNER.name },
    });
    const sam = await signedIn(STRANGER);
    await bought(sam, "paid");

    await signedIn();
    render(await billingPage());
    expect(screen.queryByText(/AYC-10001/)).not.toBeInTheDocument();
  });

  it("sends someone signed out to sign in, coming back to Billing", async () => {
    await expect(billingPage()).rejects.toThrow(redirectsTo("/app/sign-in?next=%2Fapp%2Fbilling"));
  });
});

describe("the Payment Acknowledgement", () => {
  it("shows a Paid Order's Acknowledgement, with the business name alone before Settings has details", async () => {
    const userId = await signedIn();
    await bought(userId, "paid");
    render(await acknowledgementPage("AYC-10001"));

    const document = within(
      screen.getByRole("article", { name: "Payment Acknowledgement AYC-10001" }),
    );
    expect(document.getByText("This is not an official invoice")).toBeInTheDocument();
    expect(document.getByText("17 NOV 2026")).toBeInTheDocument();
    expect(document.getByText("Bea Tester")).toBeInTheDocument();
    expect(document.getByText("Ace Your Course")).toBeInTheDocument();
    expect(document.queryByText(/^TIN /)).not.toBeInTheDocument();
    expect(document.queryByText("Prices include VAT")).not.toBeInTheDocument();
    expect(document.getAllByText("₱1,299.00")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Print or save as PDF" })).toBeInTheDocument();
  });

  it("shows the business details an Owner saved, and Prices include VAT when VAT-registered", async () => {
    await updateWebsiteSettings(OWNER, {
      business: {
        name: "Ace Your Course Review Center",
        address: "Iloilo City, Iloilo",
        tin: "123-456-789-000",
        vatRegistered: true,
      },
    });
    const userId = await signedIn();
    await bought(userId, "paid");
    render(await acknowledgementPage("AYC-10001"));

    const document = within(
      screen.getByRole("article", { name: "Payment Acknowledgement AYC-10001" }),
    );
    expect(document.getByText("Ace Your Course Review Center")).toBeInTheDocument();
    expect(document.getByText("Iloilo City, Iloilo")).toBeInTheDocument();
    expect(document.getByText("TIN 123-456-789-000")).toBeInTheDocument();
    expect(document.getByText("Prices include VAT")).toBeInTheDocument();
  });

  it("marks a Test Order's Acknowledgement TEST", async () => {
    const userId = await signedIn();
    await bought(userId, "paid");
    render(await acknowledgementPage("AYC-10001"));

    expect(screen.getByText("TEST PAYMENT · NO REAL MONEY")).toBeInTheDocument();
  });

  it.each(["pending", "failed"] as const)("answers not found for a %s Order", async (outcome) => {
    const userId = await signedIn();
    await bought(userId, outcome);

    await expect(acknowledgementPage("AYC-10001")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers not found for another Member's Acknowledgement", async () => {
    getSampleStore().betaTesters.push({
      email: STRANGER.email,
      addedAt: BOOT.toISOString(),
      addedBy: { email: OWNER.email, name: OWNER.name },
    });
    const sam = await signedIn(STRANGER);
    await bought(sam, "paid");

    await signedIn();
    await expect(acknowledgementPage("AYC-10001")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(["AYC-99999", "nonsense"])("answers not found for %j", async (reference) => {
    await signedIn();
    await expect(acknowledgementPage(reference)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends someone signed out to sign in, coming back to the Acknowledgement", async () => {
    await expect(acknowledgementPage("AYC-10001")).rejects.toThrow(
      redirectsTo("/app/sign-in?next=%2Fapp%2Fbilling%2FAYC-10001"),
    );
  });
});

describe("Request official invoice", () => {
  const IDLE = { error: null, fields: {} };
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  const request = async (reference: string, fields: Record<string, string>) =>
    (await import("./(shell)/billing/actions")).requestOfficialInvoice(
      reference,
      IDLE,
      form(fields),
    );

  it("records the request for the Member's Paid Order; Billing and the Acknowledgement then say Invoice requested", async () => {
    const userId = await signedIn();
    await bought(userId, "paid");

    expect(
      await request("AYC-10001", { name: "Bea Tester", address: "Jaro, Iloilo City", tin: "" }),
    ).toEqual(IDLE);

    expect(getSampleStore().invoiceRequests).toMatchObject([
      { name: "Bea Tester", address: "Jaro, Iloilo City", tin: null, sentAt: null },
    ]);
    const { unmount } = render(await billingPage());
    const [row] = within(screen.getByRole("list", { name: "Orders" })).getAllByRole("listitem");
    expect(row).toHaveTextContent("Invoice requested");
    expect(within(row!).queryByText("Request official invoice")).not.toBeInTheDocument();
    unmount();

    render(await acknowledgementPage("AYC-10001"));
    const section = within(screen.getByRole("region", { name: "Request official invoice" }));
    expect(section.getByText("Invoice requested")).toBeInTheDocument();
    expect(section.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers the form on a Paid Order, with the name prefilled from the Member's", async () => {
    const userId = await signedIn();
    await bought(userId, "paid");
    render(await acknowledgementPage("AYC-10001"));

    const section = within(screen.getByRole("region", { name: "Request official invoice" }));
    expect(section.getByRole("textbox", { name: "Name on the invoice" })).toHaveValue("Bea Tester");
  });

  it("refuses an empty name and address with a message for each, recording nothing", async () => {
    const userId = await signedIn();
    await bought(userId, "paid");

    expect(await request("AYC-10001", { name: "  ", address: "" })).toEqual({
      error: null,
      fields: { name: INVOICE_NAME_REQUIRED, address: INVOICE_ADDRESS_REQUIRED },
    });
    expect(getSampleStore().invoiceRequests).toEqual([]);
  });

  it("refuses a second request, and one for an Order that isn't Paid", async () => {
    const userId = await signedIn();
    await bought(userId, "paid");
    await bought(userId, "failed");
    const details = { name: "Bea Tester", address: "Jaro" };
    await request("AYC-10001", details);

    expect(await request("AYC-10001", details)).toEqual({
      error: INVOICE_REFUSALS["already-requested"],
      fields: {},
    });
    expect(await request("AYC-10002", details)).toEqual({
      error: INVOICE_REFUSALS["not-paid"],
      fields: {},
    });
    expect(getSampleStore().invoiceRequests).toHaveLength(1);
  });

  it.each(["AYC-99999", "nonsense"])(
    "refuses a request for %j, recording nothing",
    async (reference) => {
      const userId = await signedIn();
      await bought(userId, "paid");

      expect(await request(reference, { name: "Bea Tester", address: "Jaro" })).toEqual({
        error: INVOICE_REFUSALS["not-found"],
        fields: {},
      });
      expect(getSampleStore().invoiceRequests).toEqual([]);
    },
  );

  it("refuses a request for another Member's Order, as one it can't find", async () => {
    getSampleStore().betaTesters.push({
      email: STRANGER.email,
      addedAt: BOOT.toISOString(),
      addedBy: { email: OWNER.email, name: OWNER.name },
    });
    const sam = await signedIn(STRANGER);
    await bought(sam, "paid");

    await signedIn();
    expect(await request("AYC-10001", { name: "Bea Tester", address: "Jaro" })).toEqual({
      error: INVOICE_REFUSALS["not-found"],
      fields: {},
    });
    expect(getSampleStore().invoiceRequests).toEqual([]);
  });
});
