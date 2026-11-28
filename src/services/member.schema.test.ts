import { describe, expect, it } from "vitest";

import {
  INVOICE_ADDRESS_MAX,
  INVOICE_ADDRESS_REQUIRED,
  INVOICE_NAME_MAX,
  INVOICE_NAME_REQUIRED,
  INVOICE_TIN_SHAPE,
  invoiceFieldErrors,
  invoiceRequestInputSchema,
} from "./member.schema";

// "Request official invoice"'s form (Phase 4, ticket 08; spec, Phase 4
// planning decisions → Payment Acknowledgement and Invoice Requests; story
// 151j): the name and address to put on the invoice, both required and
// trimmed, and a TIN for businesses, optional, kept with dashes.

const parse = (input: Record<string, unknown>) => invoiceRequestInputSchema.safeParse(input);
const fieldsOf = (input: Record<string, unknown>) => {
  const parsed = parse(input);
  if (parsed.success) throw new Error("The form was accepted.");
  return invoiceFieldErrors(parsed.error);
};

describe("invoiceRequestInputSchema", () => {
  it("takes a name and address, trimmed, with no TIN", () => {
    expect(
      parse({ name: "  Bea Tester ", address: " Iloilo City, Iloilo  ", tin: "" }),
    ).toMatchObject({
      success: true,
      data: { name: "Bea Tester", address: "Iloilo City, Iloilo", tin: null },
    });
  });

  it("keeps a business's TIN with dashes, its branch code too", () => {
    expect(
      parse({ name: "Sample Builders Inc.", address: "Jaro", tin: "123456789000" }),
    ).toMatchObject({ success: true, data: { tin: "123-456-789-000" } });
    expect(
      parse({ name: "Sample Builders Inc.", address: "Jaro", tin: " 123-456-789 " }),
    ).toMatchObject({ success: true, data: { tin: "123-456-789" } });
  });

  it("takes a missing TIN as none", () => {
    expect(parse({ name: "Bea Tester", address: "Jaro" })).toMatchObject({
      success: true,
      data: { tin: null },
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])("refuses a name or address that's %s, each with its own message", (_what, blank) => {
    expect(fieldsOf({ name: blank, address: blank, tin: "" })).toEqual({
      name: INVOICE_NAME_REQUIRED,
      address: INVOICE_ADDRESS_REQUIRED,
    });
  });

  it("refuses a form with no name or address at all", () => {
    expect(fieldsOf({})).toEqual({
      name: INVOICE_NAME_REQUIRED,
      address: INVOICE_ADDRESS_REQUIRED,
    });
  });

  it.each(["12345678", "1234567890", "123-456-789-0", "ABC-DEF-GHI", "123 456 789"])(
    "refuses the TIN %j as the wrong shape",
    (tin) => {
      expect(fieldsOf({ name: "Bea Tester", address: "Jaro", tin })).toEqual({
        tin: INVOICE_TIN_SHAPE,
      });
    },
  );

  it("refuses a name or address that's too long", () => {
    expect(
      fieldsOf({
        name: "N".repeat(INVOICE_NAME_MAX + 1),
        address: "A".repeat(INVOICE_ADDRESS_MAX + 1),
      }),
    ).toEqual({
      name: `Keep the name to ${INVOICE_NAME_MAX} characters.`,
      address: `Keep the address to ${INVOICE_ADDRESS_MAX} characters.`,
    });
    expect(
      parse({ name: "N".repeat(INVOICE_NAME_MAX), address: "A".repeat(INVOICE_ADDRESS_MAX) })
        .success,
    ).toBe(true);
  });
});
