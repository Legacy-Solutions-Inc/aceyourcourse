import { describe, expect, it } from "vitest";

import { buildRobots, buildSitemap, STATIC_ROUTES } from "./seo";

const DATE = new Date("2026-01-01T00:00:00.000Z");
const CATALOGUE = {
  examCodes: ["CE", "ME"],
  productSlugs: ["ce-formula-flash-cards", "ce-solving-notebook"],
};

const urls = (baseUrl: string, catalogue = CATALOGUE) =>
  buildSitemap(baseUrl, DATE, catalogue).map((entry) => entry.url);

describe("buildSitemap", () => {
  it("lists the static pages, then every Exam page, then every Product page", () => {
    expect(urls("https://example.com/")).toEqual([
      "https://example.com/",
      "https://example.com/products",
      "https://example.com/reviews",
      "https://example.com/faq",
      "https://example.com/about",
      "https://example.com/legal/privacy",
      "https://example.com/legal/terms",
      "https://example.com/exams/ce",
      "https://example.com/exams/me",
      "https://example.com/products/ce-formula-flash-cards",
      "https://example.com/products/ce-solving-notebook",
    ]);
  });

  it("dates every entry with the date passed in", () => {
    for (const entry of buildSitemap("https://example.com/", DATE, CATALOGUE)) {
      expect(entry.lastModified).toBe(DATE);
    }
  });

  it("ranks Home first and the catalogue pages above the rest", () => {
    const priority = (url: string) =>
      buildSitemap("https://example.com/", DATE, CATALOGUE).find((entry) => entry.url === url)
        ?.priority;
    expect(priority("https://example.com/")).toBe(1);
    expect(priority("https://example.com/exams/ce")).toBeGreaterThan(
      priority("https://example.com/faq") ?? 1,
    );
    expect(priority("https://example.com/products/ce-solving-notebook")).toBeGreaterThan(
      priority("https://example.com/legal/terms") ?? 1,
    );
  });

  it("lists only the static pages for an empty catalogue", () => {
    expect(urls("https://example.com/", { examCodes: [], productSlugs: [] })).toHaveLength(
      STATIC_ROUTES.length,
    );
  });

  it.each(["https://example.com", "https://example.com/", "https://www.example.ph"])(
    "gives absolute URLs with no double slash after the host on %s",
    (baseUrl) => {
      for (const url of urls(baseUrl)) {
        expect(url).toMatch(/^https:\/\/[^/]+\//);
        expect(url.replace("https://", "")).not.toContain("//");
      }
    },
  );

  it("never lists an auth, Member App or Admin route", () => {
    for (const url of urls("https://example.com/")) {
      expect(new URL(url).pathname).not.toMatch(/^\/(auth|app|admin|dashboard)(\/|$)/);
    }
  });
});

describe("buildRobots", () => {
  it("allows the Website, keeps the signed-in areas out, and points at the sitemap", () => {
    expect(buildRobots("https://example.com/")).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/app$", "/app/", "/admin$", "/admin/", "/auth$", "/auth/", "/relay/"],
      },
      sitemap: "https://example.com/sitemap.xml",
      host: "https://example.com",
    });
  });

  it("has no rule for the removed template dashboard", () => {
    const robots = buildRobots("https://example.com");
    expect(JSON.stringify(robots.rules)).not.toContain("/dashboard");
    expect(robots.sitemap).toBe("https://example.com/sitemap.xml");
  });
});
