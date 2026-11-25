// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { CheckoutOrder } from "@/services/payments.types";

import created from "../../../test/fixtures/paymongo/checkout-created.json";
import paid from "../../../test/fixtures/paymongo/checkout-paid.json";
import pending from "../../../test/fixtures/paymongo/checkout-pending.json";
import refused from "../../../test/fixtures/paymongo/error.json";

import { PAYMONGO_CHECKOUT_ORIGIN } from "./checkout-origin";
import { createPayMongoClient, payMongoMethod } from "./client";

// The real payments client (Phase 4, ticket 04; spec, Phase 4 → PayMongo
// integration; Phase 4 planning decisions → Paying, Recording an outcome),
// over PayMongo's Checkout Session API. Every test answers from a recorded
// fixture through an injected fetch: no test ever calls PayMongo. The
// fixtures follow PayMongo's documented examples, with fake ids.

const TEST_KEY = "sk_test_Ab12Cd34Ef56Gh78";
const SITE = "https://aceyourcourse.example/";

const ORDER: CheckoutOrder = {
  orderId: "0b6a3f1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b",
  reference: "AYC-10001",
  description: "CE All-Access · 3 months",
  priceCentavos: 129_900,
  method: "gcash",
  buyer: { name: "Bea Tester", email: "tester@example.com" },
  successPath: "/app/plans/orders/AYC-10001",
  cancelPath: "/app/plans?exam=CE&payment=cancelled",
};
const REF = {
  orderId: ORDER.orderId,
  reference: "AYC-10001",
  checkoutId: "cs_FakeCreated0001TestOnly",
};

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A client whose fetch answers `response` (or throws it), keeping each request. */
function clientAnswering(response: Response | Error, secretKey = TEST_KEY) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const log = vi.fn<(message: string) => void>();
  const client = createPayMongoClient({ secretKey, siteUrl: SITE, fetch, log });
  const request = () => {
    const [url, init] = fetch.mock.calls[0] ?? [];
    return {
      url: String(url),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : null,
    };
  };
  return { client, fetch, log, request };
}

/** The fixture with its checkout address replaced. */
const createdWithUrl = (checkoutUrl: string) => ({
  data: { ...created.data, attributes: { ...created.data.attributes, checkout_url: checkoutUrl } },
});

describe("payMongoMethod", () => {
  it("names each Payment Method as PayMongo's payment_method_types do", () => {
    expect(payMongoMethod("qrph")).toBe("qrph");
    expect(payMongoMethod("gcash")).toBe("gcash");
    expect(payMongoMethod("maya")).toBe("paymaya");
    expect(payMongoMethod("card")).toBe("card");
  });
});

describe("createPayMongoClient", () => {
  it("is the PayMongo client, taking real money only with a live key", () => {
    expect(clientAnswering(answer(200, created)).client).toMatchObject({
      kind: "paymongo",
      livemode: false,
    });
    expect(clientAnswering(answer(200, created), "sk_live_Ab12Cd34Ef56Gh78").client.livemode).toBe(
      true,
    );
  });
});

describe("startCheckout", () => {
  it("creates a Checkout Session for the one Plan, with only the chosen method", async () => {
    const { client, request } = clientAnswering(answer(200, created));

    await client.startCheckout(ORDER);

    const sent = request();
    expect(sent.url).toBe("https://api.paymongo.com/v1/checkout_sessions");
    expect(sent.method).toBe("POST");
    expect(sent.headers.get("content-type")).toBe("application/json");
    expect(sent.body).toEqual({
      data: {
        attributes: {
          line_items: [
            { name: "CE All-Access · 3 months", amount: 129_900, currency: "PHP", quantity: 1 },
          ],
          payment_method_types: ["gcash"],
          description: "CE All-Access · 3 months",
          success_url: "https://aceyourcourse.example/app/plans/orders/AYC-10001",
          cancel_url: "https://aceyourcourse.example/app/plans?exam=CE&payment=cancelled",
          reference_number: "AYC-10001",
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          metadata: { order_id: ORDER.orderId, reference: "AYC-10001" },
        },
      },
    });
  });

  it("offers Maya as PayMongo's paymaya", async () => {
    const { client, request } = clientAnswering(answer(200, created));

    await client.startCheckout({ ...ORDER, method: "maya" });

    expect(request().body).toMatchObject({
      data: { attributes: { payment_method_types: ["paymaya"] } },
    });
  });

  it("signs in with the secret key as the Basic auth username and no password", async () => {
    const { client, request } = clientAnswering(answer(200, created));

    await client.startCheckout(ORDER);

    expect(request().headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`${TEST_KEY}:`).toString("base64")}`,
    );
  });

  it("gives PayMongo's checkout page, the session's id and its livemode", async () => {
    const { client } = clientAnswering(answer(200, created));

    expect(await client.startCheckout(ORDER)).toEqual({
      ok: true,
      checkoutId: "cs_FakeCreated0001TestOnly",
      redirectTo: "https://checkout.paymongo.com/cs_FakeCreated0001TestOnly#ZmFrZS1wdWJsaWMta2V5",
      livemode: false,
    });
  });

  it.each([400, 401, 500])(
    "isn't started when PayMongo answers HTTP %i, logging the codes without the key",
    async (status) => {
      const { client, log } = clientAnswering(answer(status, refused));

      expect(await client.startCheckout(ORDER)).toEqual({ ok: false });
      expect(log).toHaveBeenCalledWith(
        `PayMongo didn't start the checkout for AYC-10001 (HTTP ${status}: parameter_invalid).`,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(TEST_KEY);
    },
  );

  it("isn't started when PayMongo can't be reached", async () => {
    const { client, log } = clientAnswering(new TypeError("fetch failed"));

    expect(await client.startCheckout(ORDER)).toEqual({ ok: false });
    expect(log).toHaveBeenCalledWith(
      "PayMongo didn't start the checkout for AYC-10001 (it couldn't be reached).",
    );
  });

  it("isn't started by an answer that isn't a Checkout Session", async () => {
    const { client, log } = clientAnswering(answer(200, { data: { id: "nope" } }));

    expect(await client.startCheckout(ORDER)).toEqual({ ok: false });
    expect(log).toHaveBeenCalledWith(
      "PayMongo didn't start the checkout for AYC-10001 (its answer wasn't a Checkout Session).",
    );
  });

  it.each([
    ["over http", "http://checkout.paymongo.com/cs_FakeCreated0001TestOnly"],
    ["on another host", "https://checkout.paymongo.com.example.net/cs_FakeCreated0001TestOnly"],
    ["on a look-alike host", "https://evil.example/checkout.paymongo.com"],
    ["that isn't an address", "javascript:alert(1)"],
  ])("refuses a checkout address %s", async (_what, checkoutUrl) => {
    const { client, log } = clientAnswering(answer(200, createdWithUrl(checkoutUrl)));

    expect(await client.startCheckout(ORDER)).toEqual({ ok: false });
    expect(log).toHaveBeenCalledWith(
      `PayMongo didn't start the checkout for AYC-10001 (its checkout address isn't on ${PAYMONGO_CHECKOUT_ORIGIN}).`,
    );
  });
});

describe("checkoutStatus", () => {
  it("reads the Order's Checkout Session", async () => {
    const { client, request } = clientAnswering(answer(200, pending));

    await client.checkoutStatus(REF);

    const sent = request();
    expect(sent.url).toBe(
      "https://api.paymongo.com/v1/checkout_sessions/cs_FakeCreated0001TestOnly",
    );
    expect(sent.method).toBe("GET");
    expect(sent.headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`${TEST_KEY}:`).toString("base64")}`,
    );
  });

  it("says paid, with the paid payment's id, once a payment is paid, even after a failed try", async () => {
    const { client } = clientAnswering(answer(200, paid));

    expect(await client.checkoutStatus(REF)).toEqual({
      status: "paid",
      paymentId: "pay_FakePaid0001TestOnly",
    });
  });

  it("says pending while nothing is paid: a failed try can be retried on the same page", async () => {
    const { client } = clientAnswering(answer(200, pending));

    expect(await client.checkoutStatus(REF)).toEqual({ status: "pending" });
  });

  it("says pending before any payment is tried", async () => {
    const { client } = clientAnswering(answer(200, created));

    expect(await client.checkoutStatus(REF)).toEqual({ status: "pending" });
  });

  it("ignores an answer about another Order's checkout", async () => {
    const { client, log } = clientAnswering(answer(200, paid));

    expect(await client.checkoutStatus({ ...REF, reference: "AYC-10002" })).toEqual({
      status: "unknown",
    });
    expect(log).toHaveBeenCalledWith(
      "PayMongo's status for AYC-10002 was about another checkout, so it was ignored.",
    );
  });

  it("ignores an answer about another Checkout Session", async () => {
    const { client } = clientAnswering(answer(200, paid));

    expect(await client.checkoutStatus({ ...REF, checkoutId: "cs_Another0002TestOnly" })).toEqual({
      status: "unknown",
    });
  });

  it("asks nothing for an Order with no checkout id", async () => {
    const { client, fetch } = clientAnswering(answer(200, paid));

    expect(await client.checkoutStatus({ ...REF, checkoutId: null })).toEqual({
      status: "unknown",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("can't say when PayMongo answers an error, logging it without the key", async () => {
    const { client, log } = clientAnswering(answer(404, refused));

    expect(await client.checkoutStatus(REF)).toEqual({ status: "unknown" });
    expect(log).toHaveBeenCalledWith(
      "PayMongo didn't give the status for AYC-10001 (HTTP 404: parameter_invalid).",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(TEST_KEY);
  });

  it("can't say from an answer that isn't a Checkout Session", async () => {
    const { client, log } = clientAnswering(answer(200, { data: [] }));

    expect(await client.checkoutStatus(REF)).toEqual({ status: "unknown" });
    expect(log).toHaveBeenCalledWith(
      "PayMongo didn't give the status for AYC-10001 (its answer wasn't a Checkout Session).",
    );
  });

  it("can't say when PayMongo can't be reached", async () => {
    const { client } = clientAnswering(new TypeError("fetch failed"));

    expect(await client.checkoutStatus(REF)).toEqual({ status: "unknown" });
  });
});

describe("verifyWebhook", () => {
  it("refuses every webhook until ticket 05 checks PayMongo's signature", async () => {
    const { client } = clientAnswering(answer(200, created));

    expect(await client.verifyWebhook("{}", "t=1,te=abc")).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });
});
