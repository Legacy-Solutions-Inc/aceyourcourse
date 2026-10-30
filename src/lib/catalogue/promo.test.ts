import { describe, expect, it } from "vitest";

import type { PromoBanner } from "@/services/catalogue.types";

import { isPromoActive, promoLink } from "./promo";

// The Home promo strip runs over whole Asia/Manila calendar days (UTC+8, no
// DST): from 00:00 Manila on its start date until 23:59:59 Manila on its end
// date, whatever the server's own time zone is.

const elevenEleven: PromoBanner = {
  visible: true,
  text: "11.11 · Any 2 reviewers, 4% off on Shopee",
  buttonLabel: "Shop the sale",
  href: "https://shopee.ph/aceyourcourse",
  startDate: "2026-11-09",
  endDate: "2026-11-11",
};

const at = (iso: string) => new Date(iso);

describe("isPromoActive", () => {
  it.each([
    ["00:00 Manila on the start date", "2026-11-08T16:00:00Z"],
    ["midday Manila on the middle day", "2026-11-10T04:00:00Z"],
    ["23:59:59 Manila on the end date", "2026-11-11T15:59:59Z"],
  ])("is on at %s", (_when, now) => {
    expect(isPromoActive(elevenEleven, at(now))).toBe(true);
  });

  it.each([
    ["one second before the start, 23:59:59 Manila the day before", "2026-11-08T15:59:59Z"],
    ["one second after the end, 00:00 Manila the day after", "2026-11-11T16:00:00Z"],
    ["a month later", "2026-12-11T04:00:00Z"],
  ])("is off %s", (_when, now) => {
    expect(isPromoActive(elevenEleven, at(now))).toBe(false);
  });

  it("is off at 20:00 UTC on the end date, already the next day in Manila", () => {
    // 2026-11-11T20:00Z is 04:00 on 12 Nov in Manila, though still the 11th in UTC.
    expect(isPromoActive(elevenEleven, at("2026-11-11T20:00:00Z"))).toBe(false);
  });

  it("runs a one-day sale for that whole Manila day", () => {
    const oneDay = { ...elevenEleven, startDate: "2026-11-11", endDate: "2026-11-11" };
    expect(isPromoActive(oneDay, at("2026-11-10T16:00:00Z"))).toBe(true);
    expect(isPromoActive(oneDay, at("2026-11-11T15:59:59Z"))).toBe(true);
    expect(isPromoActive(oneDay, at("2026-11-10T15:59:59Z"))).toBe(false);
    expect(isPromoActive(oneDay, at("2026-11-11T16:00:00Z"))).toBe(false);
  });

  it("is off while the banner is turned off, even inside its dates", () => {
    expect(isPromoActive({ ...elevenEleven, visible: false }, at("2026-11-10T04:00:00Z"))).toBe(
      false,
    );
  });

  it("is off with no banner", () => {
    expect(isPromoActive(null, at("2026-11-10T04:00:00Z"))).toBe(false);
  });

  it("is off when the end date is before the start date", () => {
    const backwards = { ...elevenEleven, startDate: "2026-11-11", endDate: "2026-11-09" };
    expect(isPromoActive(backwards, at("2026-11-10T04:00:00Z"))).toBe(false);
    expect(isPromoActive(backwards, at("2026-11-11T04:00:00Z"))).toBe(false);
  });

  it("is off when a date is not an ISO date", () => {
    expect(
      isPromoActive({ ...elevenEleven, startDate: "9 Nov 2026" }, at("2026-11-10T04:00:00Z")),
    ).toBe(false);
    expect(
      isPromoActive({ ...elevenEleven, endDate: "not a date" }, at("2026-11-10T04:00:00Z")),
    ).toBe(false);
  });
});

describe("promoLink", () => {
  it("keeps a Website path on the Website", () => {
    expect(promoLink("/products?format=posters")).toEqual({ kind: "internal" });
    expect(promoLink("/apply")).toEqual({ kind: "internal" });
  });

  it("knows a Member App path, which only links while the Member App is live", () => {
    expect(promoLink("/app")).toEqual({ kind: "member-app" });
    expect(promoLink("/app/plans")).toEqual({ kind: "member-app" });
  });

  it.each([
    ["https://shopee.ph/aceyourcourse", "shopee"],
    ["https://www.lazada.com.ph/shop/aceyourcourse", "lazada"],
    ["https://vt.tiktok.com/ZS49ve6cu/?page=TikTokShop", "tiktok"],
  ])("knows %s is a Marketplace shop link", (href, marketplace) => {
    expect(promoLink(href)).toEqual({ kind: "marketplace", marketplace });
  });

  it("treats any other https link as external, including a look-alike host", () => {
    expect(promoLink("https://www.facebook.com/aceyourcourse")).toEqual({ kind: "external" });
    expect(promoLink("https://shopee.ph.example.com/sale")).toEqual({ kind: "external" });
    expect(promoLink("https://notshopee.ph/sale")).toEqual({ kind: "external" });
  });
});
