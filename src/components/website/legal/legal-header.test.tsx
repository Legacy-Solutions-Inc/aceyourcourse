import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalHeader } from "./legal-header";

const DOCUMENT = {
  title: "Privacy Policy",
  version: "2.0",
  effectiveDate: "2026-11-17",
};

describe("LegalHeader", () => {
  it("shows the title, version and effective date", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "final" }} switcher={null} />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByTestId("legal-version")).toHaveTextContent(
      /^Version 2\.0 · Effective 17 Nov 2026$/,
    );
  });

  it("shows a visible “Draft, pending legal review” notice under the header while the document is a draft", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "draft" }} switcher={null} />);

    const notice = screen.getByRole("note", { name: "Draft, pending legal review" });
    expect(notice).toBeVisible();
    expect(notice).toHaveTextContent(/hasn’t been reviewed by our lawyer yet/);
    // It sits after the version line, which keeps only the version and date.
    const version = screen.getByTestId("legal-version");
    expect(version.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(version).toHaveTextContent(/^Version 2\.0 · Effective 17 Nov 2026$/);
  });

  it("drops the notice once the document is final", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "final" }} switcher={null} />);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument();
  });

  it("marks up the effective date as a machine-readable date", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "final" }} switcher={null} />);

    expect(screen.getByText("17 Nov 2026")).toHaveAttribute("datetime", "2026-11-17");
  });

  it("shows the switcher above the title", () => {
    render(
      <LegalHeader
        document={{ ...DOCUMENT, status: "draft" }}
        switcher={<nav aria-label="Legal documents" />}
      />,
    );

    const switcher = screen.getByRole("navigation", { name: "Legal documents" });
    const title = screen.getByRole("heading", { level: 1 });
    expect(switcher.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
