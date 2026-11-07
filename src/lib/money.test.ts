import { describe, expect, it } from "vitest";

import { formatPeso } from "./money";

// Money is stored in centavos as integers and shown in ₱ with en-PH formatting.
// Decimals appear only when the amount is not a whole peso.
describe("formatPeso", () => {
  it.each([
    [120000, "₱1,200"],
    [124950, "₱1,249.50"],
    [105, "₱1.05"],
    [40000, "₱400"],
    [1234567800, "₱12,345,678"],
  ])("formats %i centavos as %s", (centavos, expected) => {
    expect(formatPeso(centavos)).toBe(expected);
  });

  it("formats zero as a whole peso", () => {
    expect(formatPeso(0)).toBe("₱0");
  });

  it("rejects a fractional centavo amount", () => {
    expect(() => formatPeso(1200.5)).toThrow(RangeError);
  });

  it("rejects a non-finite amount", () => {
    expect(() => formatPeso(Number.NaN)).toThrow(RangeError);
  });
});
