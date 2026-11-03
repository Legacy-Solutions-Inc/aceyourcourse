import { describe, expect, it } from "vitest";

import type { AdminExamPage } from "@/services/admin.types";
import { examPageDefaults } from "@/services/catalogue.schema";

import { testExam } from "../../../test/fixtures/catalogue";
import {
  examDateWarning,
  examPageAddress,
  examPagesHref,
  examSectionRows,
  parseExamPagesParams,
  shareImageWarning,
} from "./exam-pages-view";

// Exam pages & promo's URL, its SECTIONS · SHOW OR HIDE list and its
// warnings (BUILD-MAP §3.2; CONVENTIONS §2: ?exam=ce&section=header,
// ?page=promo, ?page=announcement).

const STAMP = { savedAt: "2026-10-22T03:42:00.000Z", savedBy: null };

function adminPage(changes: Partial<AdminExamPage["page"]> = {}): AdminExamPage {
  return {
    exam: testExam(),
    page: { ...examPageDefaults("CE"), ...changes },
    stamps: {
      header: STAMP,
      subjects: STAMP,
      sections: STAMP,
      bundleOffer: STAMP,
      seo: STAMP,
      officialExamDate: STAMP,
    },
    products: [
      { id: "prd-008", shortName: "CE Review Bundle 3-in-1", state: "live", showOnWebsite: true },
    ],
  };
}

describe("parseExamPagesParams", () => {
  it("opens the Exam pages at the first Exam's Header with no selection", () => {
    expect(parseExamPagesParams({})).toEqual({ page: "exam", exam: null, section: "header" });
  });

  it("reads the Exam and the section", () => {
    expect(parseExamPagesParams({ exam: "me", section: "seo" })).toEqual({
      page: "exam",
      exam: "me",
      section: "seo",
    });
  });

  it.each(["promo", "announcement"] as const)("reads ?page=%s", (page) => {
    expect(parseExamPagesParams({ page })).toMatchObject({ page });
  });

  it("falls back to the Header for an unknown section, and to the Exam pages for an unknown page", () => {
    expect(parseExamPagesParams({ page: "about", section: "footer" })).toEqual({
      page: "exam",
      exam: null,
      section: "header",
    });
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseExamPagesParams({ exam: ["ee", "mt"] })).toMatchObject({ exam: "ee" });
  });
});

describe("examPagesHref", () => {
  it("links to an Exam's section with the code lowercased", () => {
    expect(examPagesHref({ exam: "CE", section: "subjects" })).toBe(
      "/admin/exam-pages?exam=ce&section=subjects",
    );
  });

  it("links to an Exam's Header without naming it", () => {
    expect(examPagesHref({ exam: "ME" })).toBe("/admin/exam-pages?exam=me");
  });

  it("links to the promo banner and announcement bar pages", () => {
    expect(examPagesHref({ page: "promo" })).toBe("/admin/exam-pages?page=promo");
    expect(examPagesHref({ page: "announcement" })).toBe("/admin/exam-pages?page=announcement");
  });
});

describe("examPageAddress", () => {
  it("is the page's address on the site, as the mockup shows it", () => {
    expect(examPageAddress("CE")).toBe("aceyourcourse.ph/exams/ce");
  });
});

describe("examSectionRows", () => {
  it("lists the sections in page order, Header and Reviewers always on", () => {
    expect(examSectionRows(adminPage())).toEqual([
      { key: "header", title: "Header", description: "Name, text, image", toggle: null },
      { key: "subjects", title: "Subjects covered", description: "3 subjects", toggle: "subjects" },
      { key: "reviewers", title: "Reviewers", description: "Every CE product", toggle: null },
      { key: "bundle", title: "Bundle offer", description: "No offer set", toggle: "bundleOffer" },
      { key: "reviews", title: "Reviews", description: "From CE products", toggle: "reviews" },
    ]);
  });

  it("names the bundle offer's Product, and counts one Subject", () => {
    const page = adminPage({
      bundleOffer: { productId: "prd-008", headline: "h", text: "t", buttonLabel: "b" },
    });
    page.exam.subjects = [{ code: "MATH", name: "Mathematics" }];
    const rows = examSectionRows(page);
    expect(rows.find((row) => row.key === "bundle")?.description).toBe("CE Review Bundle 3-in-1");
    expect(rows.find((row) => row.key === "subjects")?.description).toBe("1 subject");
  });
});

describe("examDateWarning", () => {
  it("warns about a date before today", () => {
    expect(examDateWarning("2026-11-02", "2026-11-03")).toBe(
      "THIS DATE HAS PASSED · SET THE NEXT ONE ONCE PRC ANNOUNCES IT",
    );
  });

  it.each([
    ["today", "2026-11-03"],
    ["a later date", "2027-04-24"],
    ["no date", ""],
    ["a date that isn't one", "2026-02-30"],
  ])("says nothing for %s", (_case, date) => {
    expect(examDateWarning(date, "2026-11-03")).toBeNull();
  });
});

describe("shareImageWarning", () => {
  it("says nothing for 1200 × 630", () => {
    expect(shareImageWarning({ width: 1200, height: 630 })).toBeNull();
  });

  it.each([
    [{ width: 1200, height: 1200 }, "1200 × 1200 · NOT 1200 × 630, SO IT MAY BE CROPPED"],
    [{ width: 2400, height: 1260 }, "2400 × 1260 · NOT 1200 × 630, SO IT MAY BE CROPPED"],
  ])("warns about %o", (size, warning) => {
    expect(shareImageWarning(size)).toBe(warning);
  });
});
