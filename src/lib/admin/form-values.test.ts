import { describe, expect, it } from "vitest";

import { sameValues, valueAt, withValueAt } from "./form-values";

// An Admin form holds its values as plain data shaped like the seam's input,
// and names each field by its dotted path, as the seam's field errors do.
const values = {
  contactEmail: "hello@aceyourcourse.ph",
  shopLinks: { shopee: "shopee.ph/aceyourcourse", lazada: "" },
};

describe("valueAt", () => {
  it("reads a top-level or nested field by its path", () => {
    expect(valueAt(values, "contactEmail")).toBe("hello@aceyourcourse.ph");
    expect(valueAt(values, "shopLinks.shopee")).toBe("shopee.ph/aceyourcourse");
  });

  it("gives undefined for a path that isn't there", () => {
    expect(valueAt(values, "shopLinks.tiktok")).toBeUndefined();
    expect(valueAt(values, "socialLinks.tiktok")).toBeUndefined();
    expect(valueAt(values, "contactEmail.length")).toBeUndefined();
  });
});

describe("withValueAt", () => {
  it("returns a copy with one field changed, leaving the original alone", () => {
    const changed = withValueAt(values, "shopLinks.lazada", "lazada.com.ph/shop/aceyourcourse");
    expect(changed).toEqual({
      ...values,
      shopLinks: { ...values.shopLinks, lazada: "lazada.com.ph/shop/aceyourcourse" },
    });
    expect(values.shopLinks.lazada).toBe("");
  });

  it("changes a top-level field", () => {
    expect(withValueAt(values, "contactEmail", "x@y.ph").contactEmail).toBe("x@y.ph");
  });

  it("throws for a path that isn't one of the form's fields", () => {
    expect(() => withValueAt(values, "socialLinks.tiktok", "x")).toThrow(
      'The form has no field "socialLinks.tiktok"',
    );
  });
});

describe("sameValues", () => {
  it("compares by value, not identity", () => {
    expect(sameValues(values, structuredClone(values))).toBe(true);
    expect(sameValues(values, withValueAt(values, "shopLinks.lazada", "x"))).toBe(false);
  });
});
