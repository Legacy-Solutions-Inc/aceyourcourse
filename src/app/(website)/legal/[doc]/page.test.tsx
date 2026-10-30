import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LegalPage, { generateMetadata } from "./page";

// The legal page's own decisions: which documents exist (only the exact
// lowercase kinds), its metadata, and what it renders from the real content and
// settings. e2e/legal.spec.ts covers the routes in a browser.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const EMAIL = "aceyourcourseinc@gmail.com";
const props = (doc: string) => ({ params: Promise.resolve({ doc }) });

describe("the legal page", () => {
  it.each([
    ["privacy", "Privacy Policy", "/legal/privacy"],
    ["terms", "Terms of Use", "/legal/terms"],
  ])("gives /legal/%s its title, description and canonical URL", async (doc, title, url) => {
    const metadata = await generateMetadata(props(doc));
    expect(metadata.title).toBe(title);
    expect(metadata.description).toMatch(/^.{80,160}$/);
    expect(metadata.alternates?.canonical).toBe(url);
    expect(metadata.openGraph).toMatchObject({
      title: `${title} · Ace Your Course`,
      url,
      images: [{ url: "/opengraph-image", alt: "Ace Your Course" }],
    });
  });

  it.each(["cookies", "PRIVACY", "Terms", "constructor", ""])(
    "is not found for /legal/%s",
    async (doc) => {
      await expect(LegalPage(props(doc))).rejects.toThrow("NEXT_NOT_FOUND");
      // Metadata stays empty; the page's notFound() renders the 404 in the shell.
      await expect(generateMetadata(props(doc))).resolves.toEqual({});
    },
  );

  it("renders the Privacy Policy with the switcher, summary, contents and sections", async () => {
    render(await LegalPage(props("privacy")));

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByTestId("legal-version")).toHaveTextContent(
      "Version 1.0 · Effective 1 Dec 2026 · Draft for legal review",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    expect(
      within(screen.getByRole("region", { name: "In short" })).getAllByRole("listitem"),
    ).toHaveLength(5);

    const contents = within(screen.getByRole("navigation", { name: "Contents" })).getAllByRole(
      "link",
    );
    expect(contents.map((link) => link.getAttribute("href"))).toEqual(
      ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((id) => `#${id}`),
    );
    for (const link of contents) {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("gives the settings' contact email as the data protection contact", async () => {
    render(await LegalPage(props("privacy")));

    const contact = screen.getByText(/^Our data protection contact is/);
    expect(within(contact).getByRole("link", { name: EMAIL })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );
  });

  it("renders the Terms of Use as the current document", async () => {
    render(await LegalPage(props("terms")));

    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it.each(["privacy", "terms"])("links nowhere in the Member App from /legal/%s", async (doc) => {
    const { container } = render(await LegalPage(props(doc)));

    const hrefs = Array.from(container.querySelectorAll("a[href]"), (a) => a.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((href) => href?.startsWith("/app"))).toEqual([]);
  });
});
