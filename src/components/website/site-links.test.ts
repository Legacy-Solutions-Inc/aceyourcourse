import { describe, expect, it } from "vitest";

import { isCurrentPath } from "./site-links";

describe("isCurrentPath", () => {
  it.each([
    ["/products", "/products"],
    ["/products/ce-formula-flash-cards", "/products"],
    ["/faq", "/faq"],
  ])("marks %s as inside %s", (pathname, href) => {
    expect(isCurrentPath(pathname, href)).toBe(true);
  });

  it.each([
    ["/", "/products"],
    ["/products-sale", "/products"],
    ["/about", "/faq"],
    ["", "/faq"],
  ])("does not mark %s as inside %s", (pathname, href) => {
    expect(isCurrentPath(pathname, href)).toBe(false);
  });

  it("marks Home only on Home itself", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/products", "/")).toBe(false);
  });
});
