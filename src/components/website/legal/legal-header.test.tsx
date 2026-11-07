import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalHeader } from "./legal-header";

const DOCUMENT = {
  title: "Privacy Policy",
  version: "1.0",
  effectiveDate: "2026-12-01",
};

describe("LegalHeader", () => {
  it("shows the title, version, effective date and a draft label while the document is a draft", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "draft" }} switcher={null} />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByTestId("legal-version")).toHaveTextContent(
      /^Version 1\.0 · Effective 1 Dec 2026 · Draft for legal review$/,
    );
  });

  it("drops the draft label once the document is final", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "final" }} switcher={null} />);

    expect(screen.getByTestId("legal-version")).toHaveTextContent(
      /^Version 1\.0 · Effective 1 Dec 2026$/,
    );
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument();
  });

  it("marks up the effective date as a machine-readable date", () => {
    render(<LegalHeader document={{ ...DOCUMENT, status: "final" }} switcher={null} />);

    expect(screen.getByText("1 Dec 2026")).toHaveAttribute("datetime", "2026-12-01");
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
