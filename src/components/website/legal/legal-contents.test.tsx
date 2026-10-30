import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalContents } from "./legal-contents";

describe("LegalContents", () => {
  it("links to each section's anchor, numbered in order", () => {
    render(
      <LegalContents
        sections={[
          { id: "s1", title: "Who we are", paragraphs: ["…"] },
          { id: "s2", title: "What we collect", paragraphs: ["…"] },
        ]}
      />,
    );

    const links = within(screen.getByRole("navigation", { name: "Contents" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["1. Who we are", "#s1"],
      ["2. What we collect", "#s2"],
    ]);
  });
});
