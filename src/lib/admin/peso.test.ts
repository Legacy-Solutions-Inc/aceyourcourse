import { describe, expect, it } from "vitest";

import { parsePeso, pesoText } from "./peso";

describe("parsePeso", () => {
  it("reads pesos as centavos, with or without ₱, commas and centavos", () => {
    expect(parsePeso("1250")).toEqual({ ok: true, centavos: 125000 });
    expect(parsePeso("₱1,250")).toEqual({ ok: true, centavos: 125000 });
    expect(parsePeso(" ₱ 1,249.50 ")).toEqual({ ok: true, centavos: 124950 });
    expect(parsePeso("0.1")).toEqual({ ok: true, centavos: 10 });
    expect(parsePeso("19.99")).toEqual({ ok: true, centavos: 1999 });
  });

  it("reads a blank price as none", () => {
    expect(parsePeso("")).toEqual({ ok: true, centavos: null });
    expect(parsePeso("  ₱ ")).toEqual({ ok: true, centavos: null });
  });

  it("refuses text that isn't a price", () => {
    expect(parsePeso("abc")).toEqual({ ok: false, message: "ENTER A PRICE IN PESOS, LIKE 1,250" });
    expect(parsePeso("1.2.3")).toMatchObject({ ok: false });
    expect(parsePeso("12e3")).toMatchObject({ ok: false });
  });

  it("refuses a negative price", () => {
    expect(parsePeso("-5")).toEqual({ ok: false, message: "A PRICE CAN’T BE BELOW ₱0" });
  });

  it("refuses more than 2 decimals", () => {
    expect(parsePeso("12.345")).toEqual({
      ok: false,
      message: "USE AT MOST 2 DECIMALS, LIKE 1,250.50",
    });
  });

  it("refuses a price of ₱10,000,000 or more", () => {
    expect(parsePeso("9,999,999.99")).toEqual({ ok: true, centavos: 999999999 });
    expect(parsePeso("10000000")).toMatchObject({ ok: false });
  });
});

describe("pesoText", () => {
  it("writes centavos as the form shows them", () => {
    expect(pesoText(125000)).toBe("1,250");
    expect(pesoText(124950)).toBe("1,249.50");
    expect(pesoText(null)).toBe("");
  });

  it("round-trips through parsePeso", () => {
    for (const centavos of [1, 99, 40000, 124950, 349900]) {
      expect(parsePeso(pesoText(centavos))).toEqual({ ok: true, centavos });
    }
  });
});
