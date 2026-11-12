import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminExamPage, BundleProductOption } from "@/services/admin.types";
import { examPageDefaults } from "@/services/catalogue.schema";

import { testExam } from "../../../../test/fixtures/catalogue";
import { ExamPageColumn } from "./exam-pages-columns";

// Column 2's note over a NOT ON SITE Exam's chips (ticket 25): what Staff
// turn on, and a link to the Exam's Products. The router is the framework
// boundary the section switches reach for, so it is replaced.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, replace: () => {} }),
}));

const STAMP = { savedAt: "2026-10-22T03:42:00.000Z", savedBy: null };

const product = (id: string, changes: Partial<BundleProductOption> = {}): BundleProductOption => ({
  id,
  shortName: `EE Product ${id}`,
  state: "live",
  showOnWebsite: false,
  ...changes,
});

function eePage(products: BundleProductOption[], examsOnWebsite: string[]): AdminExamPage {
  return {
    exam: testExam({ code: "EE", name: "Electrical Engineering" }),
    page: examPageDefaults("EE"),
    stamps: {
      header: STAMP,
      subjects: STAMP,
      sections: STAMP,
      bundleOffer: STAMP,
      seo: STAMP,
      officialExamDate: STAMP,
    },
    products,
    subjectProducts: {},
    examsOnWebsite,
  };
}

function renderColumn(opened: AdminExamPage) {
  render(
    <ExamPageColumn
      opened={opened}
      examCodes={["CE", "EE"]}
      selected="header"
      seoState="good"
      setSection={vi.fn()}
    />,
  );
  return screen.getByRole("region", { name: "EE Exam page" });
}

/** The note's text: the paragraph that starts "EE isn’t on the Website yet." */
const note = (column: HTMLElement) => within(column).queryByText(/isn’t on the Website yet\./);

describe("ExamPageColumn's NOT ON SITE note", () => {
  it("tells Staff to show one of EE's 3 hidden Products, linking to them in the same tab", () => {
    const column = renderColumn(eePage([product("a"), product("b"), product("c")], ["CE"]));
    expect(note(column)).toHaveTextContent(
      "EE isn’t on the Website yet. To show it, turn on Show on website for one of its 3 Products. Open EE’s Products →",
    );
    expect(within(column).getByText("Show on website").tagName).toBe("STRONG");
    const link = within(column).getByRole("link", { name: "Open EE’s Products" });
    expect(link).toHaveAttribute("href", "/admin/products?exam=ee");
    expect(link).not.toHaveAttribute("target");
  });

  it('says "1 Product" for a single hidden Product, never "1 Products"', () => {
    const column = renderColumn(eePage([product("a")], ["CE"]));
    expect(note(column)).toHaveTextContent("for one of its 1 Product.");
    expect(note(column)).not.toHaveTextContent("1 Products");
  });

  it("tells Staff to add a Product for an Exam with none", () => {
    const column = renderColumn(eePage([], ["CE"]));
    expect(note(column)).toHaveTextContent(
      "EE isn’t on the Website yet. Add a Product for EE, then turn on Show on website. Add a Product →",
    );
    expect(within(column).getByRole("link", { name: "Add a Product" })).toHaveAttribute(
      "href",
      "/admin/products?exam=ee",
    );
  });

  it("still shows the note while a Live Product is hidden: hidden Products don't count", () => {
    const column = renderColumn(
      eePage(
        [product("live", { state: "live" }), product("soon", { state: "coming-soon" })],
        ["CE"],
      ),
    );
    expect(note(column)).toHaveTextContent("for one of its 2 Products.");
  });

  it("shows no note for an Exam on the Website, even when its only shown Product is Coming Soon", () => {
    const column = renderColumn(
      eePage(
        [product("soon", { state: "coming-soon", showOnWebsite: true }), product("b")],
        ["CE", "EE"],
      ),
    );
    expect(note(column)).toBeNull();
    expect(within(column).queryByRole("link", { name: /Products$/ })).toBeNull();
    expect(within(column).getByRole("link", { name: /^View page/ })).toBeInTheDocument();
  });

  it("falls back to the plain note, with no link, when the Products don't add up", () => {
    // A shown Product on an Exam the Website doesn't show: the count can't be trusted.
    const column = renderColumn(eePage([product("a", { showOnWebsite: true })], ["CE"]));
    expect(note(column)).toHaveTextContent(
      "EE isn’t on the Website yet. It shows once one of its Products is on the Website.",
    );
    expect(within(column).queryByRole("link", { name: /Products$|^Add a Product/ })).toBeNull();
    expect(
      within(column).getByRole("link", { name: /^Search & AI visibility/ }),
    ).toBeInTheDocument();
  });
});
