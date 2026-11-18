import { describe, expect, it } from "vitest";

import { renderFormula } from "./render";

// Rendering text in the formula notation (spec, Phase 3 planning decisions →
// Formula notation in every text field), as the card editor's preview and the
// Member App show it: plain runs as text, each formula as KaTeX's HTML.

describe("renderFormula", () => {
  it("keeps plain text as text, a literal \\$ as a dollar sign", () => {
    expect(renderFormula("It costs \\$5")).toEqual({
      ok: true,
      parts: [{ kind: "text", text: "It costs $5" }],
    });
  });

  it("renders inline and block formulas with KaTeX, in order", () => {
    const rendered = renderFormula("Area $\\pi r^2$ and $$x^2$$");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.parts.map((part) => part.kind)).toEqual(["text", "math", "text", "math"]);
    const [, inline, , block] = rendered.parts;
    expect(inline).toMatchObject({ kind: "math", display: false });
    expect(block).toMatchObject({ kind: "math", display: true });
    expect(inline?.kind === "math" && inline.html).toContain('class="katex"');
    expect(block?.kind === "math" && block.html).toContain("katex-display");
  });

  it("renders as markup, never as script: KaTeX escapes what it's given", () => {
    const rendered = renderFormula("$\\text{<script>alert(1)</script>}$");
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const [part] = rendered.parts;
    expect(part?.kind === "math" && part.html).not.toContain("<script>");
  });

  it("never turns \\href or \\url into a link", () => {
    const rendered = renderFormula("$\\href{https://example.com}{x}$ $\\url{https://example.com}$");
    // trust is off, so each command shows as its own name, never a link.
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const html = rendered.parts.map((part) => (part.kind === "math" ? part.html : "")).join("");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });

  it("gives the problem, rather than throwing, for a formula that won't render", () => {
    expect(renderFormula("Half is $\\frac{1}{$")).toEqual({
      ok: false,
      problem:
        "has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
    });
    expect(renderFormula("Costs $5")).toEqual({
      ok: false,
      problem: "has a $ with no closing $ (write a dollar sign as \\$)",
    });
  });

  it("gives no parts for empty text", () => {
    expect(renderFormula("")).toEqual({ ok: true, parts: [] });
  });
});
