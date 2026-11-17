import { describe, expect, it } from "vitest";

import { formulaProblem } from "./check";

// "Does this render?" (spec, Phase 3 planning decisions → Formula notation in
// every text field): a formula the renderer can't parse is reported, never
// thrown, so the import planner and the card editor can name the cell.

describe("formulaProblem", () => {
  it.each([
    ["plain text", "Degree of curve"],
    ["inline maths", "Area is $\\pi r^2$"],
    ["block maths", "$$L_c = \\frac{20I}{D}$$"],
    ["a literal dollar sign", "It costs \\$5"],
    ["a dollar sign inside maths", "$\\$5 + x$"],
    ["empty text", ""],
  ])("accepts %s", (_label, text) => {
    expect(formulaProblem(text)).toBeNull();
  });

  it("reports a formula KaTeX can't parse, quoting it, without throwing", () => {
    expect(formulaProblem("Half is $\\frac{1}{$ here")).toBe(
      "has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
    );
  });

  it("reports an unknown command", () => {
    expect(formulaProblem("$a\\bogus b$")).toBe(
      "has a formula that won’t render, “a\\bogus b”: Undefined control sequence: \\bogus",
    );
  });

  it("reports the first formula that won't render, in order", () => {
    expect(formulaProblem("$x$ then $\\nope$ then $\\frac{$")).toMatch(/“\\nope”/);
  });

  it("reports notation it can't read", () => {
    expect(formulaProblem("It costs $5")).toBe(
      "has a $ with no closing $ (write a dollar sign as \\$)",
    );
  });

  it("shortens a long formula in the message", () => {
    const long = `$\\frac{${"x".repeat(100)}$`;
    const problem = formulaProblem(long) ?? "";
    expect(problem).toContain("…”");
    expect(problem.length).toBeLessThan(200);
  });
});
