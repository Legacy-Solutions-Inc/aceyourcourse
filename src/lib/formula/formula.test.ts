import { describe, expect, it } from "vitest";

import { splitFormula } from "./formula";

// The formula notation (spec, Phase 3 planning decisions → Formula notation in
// every text field): plain text with maths in $...$ (inline) or $$...$$ (its
// own line), and \$ for a literal dollar sign.

describe("splitFormula", () => {
  it("gives plain text as one text segment", () => {
    expect(splitFormula("Degree of curve")).toEqual({
      ok: true,
      segments: [{ kind: "text", text: "Degree of curve" }],
    });
  });

  it("gives no segments for empty text", () => {
    expect(splitFormula("")).toEqual({ ok: true, segments: [] });
  });

  it("splits out inline maths in $...$", () => {
    expect(splitFormula("Area is $\\pi r^2$ exactly")).toEqual({
      ok: true,
      segments: [
        { kind: "text", text: "Area is " },
        { kind: "math", tex: "\\pi r^2", display: false },
        { kind: "text", text: " exactly" },
      ],
    });
  });

  it("splits out block maths in $$...$$", () => {
    expect(splitFormula("Use $$L_c = \\frac{20I}{D}$$ for the length")).toEqual({
      ok: true,
      segments: [
        { kind: "text", text: "Use " },
        { kind: "math", tex: "L_c = \\frac{20I}{D}", display: true },
        { kind: "text", text: " for the length" },
      ],
    });
  });

  it("reads \\$ as a literal dollar sign, in text", () => {
    expect(splitFormula("It costs \\$5, not \\$50")).toEqual({
      ok: true,
      segments: [{ kind: "text", text: "It costs $5, not $50" }],
    });
  });

  it("keeps \\$ inside maths for the renderer, without closing it", () => {
    expect(splitFormula("$\\$5 + x$")).toEqual({
      ok: true,
      segments: [{ kind: "math", tex: "\\$5 + x", display: false }],
    });
  });

  it("keeps other backslashes in text as typed", () => {
    expect(splitFormula("C:\\temp and a\\b")).toEqual({
      ok: true,
      segments: [{ kind: "text", text: "C:\\temp and a\\b" }],
    });
  });

  it("reads several formulas, inline and block, in order", () => {
    expect(splitFormula("$a$ and $$b$$ then $c$")).toEqual({
      ok: true,
      segments: [
        { kind: "math", tex: "a", display: false },
        { kind: "text", text: " and " },
        { kind: "math", tex: "b", display: true },
        { kind: "text", text: " then " },
        { kind: "math", tex: "c", display: false },
      ],
    });
  });

  it("keeps line breaks in text and in maths", () => {
    expect(splitFormula("one\ntwo $x\n+ y$")).toEqual({
      ok: true,
      segments: [
        { kind: "text", text: "one\ntwo " },
        { kind: "math", tex: "x\n+ y", display: false },
      ],
    });
  });

  it("refuses a $ with no closing $, saying how to write a dollar sign", () => {
    expect(splitFormula("It costs $5")).toEqual({
      ok: false,
      problem: "has a $ with no closing $ (write a dollar sign as \\$)",
    });
  });

  it("refuses a $$ with no closing $$", () => {
    expect(splitFormula("$$x + y$")).toEqual({
      ok: false,
      problem: "has a $$ with no closing $$",
    });
  });

  it("refuses an empty formula", () => {
    expect(splitFormula("a $ $ b")).toEqual({ ok: false, problem: "has an empty formula" });
    expect(splitFormula("a $$$$ b")).toEqual({ ok: false, problem: "has an empty formula" });
  });

  it("refuses a lone backslash before the closing $ as unclosed", () => {
    // "\$" inside maths is the renderer's dollar sign, so this $ is never closed.
    expect(splitFormula("$x\\$")).toEqual({
      ok: false,
      problem: "has a $ with no closing $ (write a dollar sign as \\$)",
    });
  });
});
