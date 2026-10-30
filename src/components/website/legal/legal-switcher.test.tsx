import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalSwitcher } from "./legal-switcher";

const DOCUMENTS = [
  { kind: "privacy", title: "Privacy Policy" },
  { kind: "terms", title: "Terms of Use" },
] as const;

describe("LegalSwitcher", () => {
  it("links to every document, in order", () => {
    render(<LegalSwitcher current="privacy" documents={[...DOCUMENTS]} />);

    const links = within(screen.getByRole("navigation", { name: "Legal documents" })).getAllByRole(
      "link",
    );
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Privacy Policy", "/legal/privacy"],
      ["Terms of Use", "/legal/terms"],
    ]);
  });

  it("marks only the current document as the current page", () => {
    const { rerender } = render(<LegalSwitcher current="privacy" documents={[...DOCUMENTS]} />);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Terms of Use" })).not.toHaveAttribute("aria-current");

    rerender(<LegalSwitcher current="terms" documents={[...DOCUMENTS]} />);
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
