// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addTargetExam, getOrCreateMember, payForPlan } from "@/services/member.mock";
import { samplePlanId } from "@/services/mock/plans";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import { samplePaymentsFake } from "@/services/payments";

// GET /api/paymongo/expiry-sweep (Phase 4, ticket 05; spec, Phase 4 planning
// decisions → Recording an outcome): Vercel Cron calls it once a day with
// CRON_SECRET as a bearer token, like the Reviewer PDF job's cron. For each
// Pending Order older than 24 hours it asks PayMongo once more (the payments
// fake here), records Paid if it says so, otherwise Expired, and says how
// many, no more. Without the secret it's refused; with none configured it
// doesn't exist.

const SECRET = "0123456789abcdef0123456789abcdef";
const { secret } = vi.hoisted(() => ({ secret: { current: undefined as string | undefined } }));
vi.mock("@/env.server", async (original) => {
  const actual = await original<typeof import("@/env.server")>();
  return {
    ...actual,
    get serverEnv() {
      return { ...actual.serverEnv, CRON_SECRET: secret.current };
    },
  };
});

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const HOUR = 60 * 60 * 1000;
const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};

async function sweep(authorization: string | null = `Bearer ${SECRET}`) {
  const { GET } = await import("./route");
  return GET(
    new Request("http://localhost:3000/api/paymongo/expiry-sweep", {
      headers: authorization === null ? {} : { authorization },
    }),
  );
}

async function pendingOrder() {
  const result = await payForPlan(
    BEA.userId,
    { examCode: "CE", planId: samplePlanId("CE", 90), method: "gcash" },
    samplePaymentsFake(),
  );
  if (!result.ok) throw new Error(`Pay was refused: ${result.reason}`);
  const order = getSampleStore().orders.at(-1);
  if (!order) throw new Error("Pay made no Order.");
  return order;
}

const statuses = () => getSampleStore().orders.map((order) => order.status);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(BOOT);
  secret.current = SECRET;
  resetSampleStore();
  await getOrCreateMember(BEA);
  await addTargetExam(BEA.userId, { examCode: "CE", examDate: "2027-01-10" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/paymongo/expiry-sweep", () => {
  it("records an overdue Order PayMongo didn't confirm as Expired, saying how many", async () => {
    await pendingOrder();
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));

    const response = await sweep();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 1, paid: 0, expired: 1, unanswered: 0 });
    expect(statuses()).toEqual(["expired"]);
  });

  it("makes an overdue Order PayMongo says is paid Paid, not Expired", async () => {
    const order = await pendingOrder();
    samplePaymentsFake()?.simulate(order.id, "paid");
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));

    expect(await (await sweep()).json()).toEqual({
      checked: 1,
      paid: 1,
      expired: 0,
      unanswered: 0,
    });
    expect(statuses()).toEqual(["paid"]);
  });

  it("leaves an Order younger than 24 hours alone", async () => {
    await pendingOrder();
    vi.setSystemTime(new Date(BOOT.getTime() + 23 * HOUR));

    expect(await (await sweep()).json()).toEqual({
      checked: 0,
      paid: 0,
      expired: 0,
      unanswered: 0,
    });
    expect(statuses()).toEqual(["pending"]);
  });

  it.each([
    ["no authorization", null],
    ["the wrong secret", "Bearer not-the-secret-not-the-secret"],
    ["the secret without Bearer", SECRET],
  ])("refuses %s with 401, changing nothing", async (_what, authorization) => {
    await pendingOrder();
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));

    expect((await sweep(authorization)).status).toBe(401);
    expect(statuses()).toEqual(["pending"]);
  });

  it("answers 404 while the server has no CRON_SECRET", async () => {
    secret.current = undefined;
    await pendingOrder();
    vi.setSystemTime(new Date(BOOT.getTime() + 25 * HOUR));

    expect((await sweep()).status).toBe(404);
    expect(statuses()).toEqual(["pending"]);
  });
});
