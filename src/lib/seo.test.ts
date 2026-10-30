import { describe, expect, it } from "vitest";

import { buildRobots, buildSitemap, SITEMAP_ROUTES } from "./seo";

describe("buildSitemap", () => {
  it("lists every public route as an absolute URL (no double slashes)", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const entries = buildSitemap("https://example.com/", date);

    expect(entries).toHaveLength(SITEMAP_ROUTES.length);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://example.com/");
    // absolute + no accidental "//" after the scheme
    urls.forEach((u) => expect(u.replace("https://", "")).not.toContain("//"));
    expect(entries[0]?.lastModified).toBe(date);
  });

  it("lists no removed template auth screens", () => {
    const urls = buildSitemap("https://example.com/", new Date()).map((e) => e.url);
    expect(urls.filter((u) => u.includes("/auth/"))).toEqual([]);
  });
});

describe("buildRobots", () => {
  it("allows the Website and points at the sitemap", () => {
    const robots = buildRobots("https://example.com/");
    expect(robots.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(robots.sitemap).toBe("https://example.com/sitemap.xml");
  });

  it("has no rule for the removed template dashboard", () => {
    const robots = buildRobots("https://example.com/");
    expect(JSON.stringify(robots.rules)).not.toContain("/dashboard");
  });
});
