import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StatusPage } from "./status-page";

describe("StatusPage", () => {
  it("shows the code, title and description, with links to Home and Products", () => {
    render(<StatusPage code="404" title="Page not found" description="That page isn't here." />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("That page isn't here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /browse products/i })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("offers Try again only when it can reset", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<StatusPage code="Error" title="t" description="d" />);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();

    const user = userEvent.setup();
    rerender(<StatusPage code="Error" title="t" description="d" onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows a support reference only when given a digest", () => {
    const { rerender } = render(<StatusPage code="Error" title="t" description="d" />);
    expect(screen.queryByText(/reference:/i)).not.toBeInTheDocument();

    rerender(<StatusPage code="Error" title="t" description="d" digest="abc123" />);
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
  });

  it("renders as a section, without its own main landmark or logo, inside the Website shell", () => {
    render(<StatusPage code="404" title="Page not found" description="Gone." withinShell />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });

  it("is a full page with its own main landmark otherwise", () => {
    render(<StatusPage code="404" title="Page not found" description="Gone." />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
