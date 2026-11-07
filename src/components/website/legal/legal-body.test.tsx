import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LegalDocument } from "@/content/legal/types";

import { LegalBody } from "./legal-body";

const EMAIL = "help@example.com";

const DOCUMENT: LegalDocument = {
  kind: "privacy",
  title: "Privacy Policy",
  description: "How the Website handles data.",
  version: "1.0",
  effectiveDate: "2026-12-01",
  status: "draft",
  summary: ["No accounts.", "Anonymous analytics.", `Questions? Email ${EMAIL}.`],
  sections: [
    {
      id: "s1",
      title: "Who we are",
      paragraphs: ["We make reviewers.", `Our contact is ${EMAIL}. Write any time.`],
    },
    { id: "s2", title: "What we collect", paragraphs: ["Page views only."] },
  ],
};

describe("LegalBody", () => {
  it("shows the In short summary, numbered, with its caveat", () => {
    render(<LegalBody document={DOCUMENT} contactEmail={EMAIL} />);

    const summary = screen.getByRole("region", { name: "In short" });
    expect(
      within(summary)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["01No accounts.", "02Anonymous analytics.", `03Questions? Email ${EMAIL}.`]);
    expect(
      within(summary).getByText("This summary isn’t a replacement for the full text below."),
    ).toBeInTheDocument();
  });

  it("shows the Contents nav", () => {
    render(<LegalBody document={DOCUMENT} contactEmail={EMAIL} />);

    expect(screen.getByRole("navigation", { name: "Contents" })).toBeInTheDocument();
  });

  it("shows each section under a numbered heading, at its anchor", () => {
    render(<LegalBody document={DOCUMENT} contactEmail={EMAIL} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "In short",
      "1 Who we are",
      "2 What we collect",
    ]);
    const first = document.getElementById("s1");
    expect(first).toContainElement(screen.getByRole("heading", { name: "1 Who we are" }));
    expect(first).toContainElement(screen.getByText("We make reviewers."));
    expect(document.getElementById("s2")).toContainElement(screen.getByText("Page views only."));
  });

  it("links the contact email wherever it appears", () => {
    render(<LegalBody document={DOCUMENT} contactEmail={EMAIL} />);

    const links = screen.getAllByRole("link", { name: EMAIL });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", `mailto:${EMAIL}`);
    // The text around the email is kept.
    expect(links[1]?.closest("p")).toHaveTextContent(`Our contact is ${EMAIL}. Write any time.`);
  });

  it("leaves text without the email alone", () => {
    render(<LegalBody document={DOCUMENT} contactEmail={EMAIL} />);

    expect(within(screen.getByText("Page views only.")).queryByRole("link")).toBeNull();
  });
});
