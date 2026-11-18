import { describe, expect, it } from "vitest";

import { watermarkBackground } from "./watermark";

// The overlay watermark (spec, Phase 3 → Burned-in watermark, the overlay
// part): the viewer's email tiled across a card as a faint picture.

const svgOf = (background: string) => {
  const match = /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(background);
  if (!match?.[1]) throw new Error(`Not an SVG background: ${background}`);
  return decodeURIComponent(match[1]);
};

describe("watermarkBackground", () => {
  it("is a CSS background of an SVG that shows the text, turned and faint", () => {
    const svg = svgOf(watermarkBackground("content@aceyourcourse.ph"));

    expect(svg).toContain("<text");
    expect(svg).toContain(">content@aceyourcourse.ph</text>");
    expect(svg).toContain("rotate(");
    expect(svg).toMatch(/fill-opacity="0\.\d+"/);
  });

  it("escapes the text, so it can never become markup", () => {
    const svg = svgOf(watermarkBackground(`<a href="x">&'</a>`));

    expect(svg).toContain(">&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;</text>");
    expect(svg).not.toContain("<a ");
  });

  it("keeps the CSS url intact: no bare quote or bracket from the text", () => {
    const background = watermarkBackground(`") red; x("`);
    expect(background.slice(5, -2)).not.toMatch(/["()]/);
  });
});
