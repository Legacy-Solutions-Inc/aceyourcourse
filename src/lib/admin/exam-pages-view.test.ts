import { describe, expect, it } from "vitest";

import type { AdminExamPage } from "@/services/admin.types";
import { examPageDefaults } from "@/services/catalogue.schema";

import { testExam } from "../../../test/fixtures/catalogue";
import {
  aboutPhotoWarnings,
  addingExam,
  aboutSectionRows,
  examDateWarning,
  examPageAddress,
  examPagesHref,
  examSectionRows,
  parseExamPagesParams,
  shareImageWarning,
} from "./exam-pages-view";

// Pages & promo's URL, its SECTIONS · SHOW OR HIDE list and its
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
    subjectProducts: {},
    examsOnWebsite: ["CE"],
  };
}

describe("parseExamPagesParams", () => {
  it("opens the Exam pages at the first Exam's Header with no selection", () => {
    expect(parseExamPagesParams({})).toEqual({
      page: "exam",
      exam: null,
      section: "header",
      site: "home",
      aboutSection: "header",
    });
  });

  it("reads the Exam and the section", () => {
    expect(parseExamPagesParams({ exam: "me", section: "seo" })).toEqual({
      page: "exam",
      exam: "me",
      section: "seo",
      site: "home",
      aboutSection: "seo",
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
      site: "home",
      aboutSection: "header",
    });
  });

  it.each(["home", "about", "products", "faq", "reviews"] as const)(
    "reads ?page=site&site=%s",
    (site) => {
      expect(parseExamPagesParams({ page: "site", site })).toMatchObject({ page: "site", site });
    },
  );

  it.each([["legal"], ["ABOUT "], [""], [["menu", "about"]]])(
    "opens Home for ?page=site&site=%j, which isn't a Site page",
    (site) => {
      expect(parseExamPagesParams({ page: "site", site })).toMatchObject({
        page: "site",
        site: "home",
      });
    },
  );

  it.each(["header", "story", "growth", "mission", "roots", "closing", "seo"] as const)(
    "reads About's ?section=%s",
    (section) => {
      expect(parseExamPagesParams({ page: "site", site: "about", section })).toMatchObject({
        page: "site",
        site: "about",
        aboutSection: section,
      });
    },
  );

  it.each([["team"], ["subjects"], [""], [undefined]])(
    "opens About's Header for ?section=%j, which isn't one of its sections",
    (section) => {
      expect(parseExamPagesParams({ page: "site", site: "about", section })).toMatchObject({
        site: "about",
        aboutSection: "header",
      });
    },
  );

  it("opens Home when ?page=site names no Site page", () => {
    expect(parseExamPagesParams({ page: "site" })).toMatchObject({ page: "site", site: "home" });
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseExamPagesParams({ exam: ["ee", "mt"] })).toMatchObject({ exam: "ee" });
  });
});

describe("addingExam", () => {
  it('opens "+ Add exam" at ?page=exam&add=exam, and at ?add=exam', () => {
    expect(addingExam({ page: "exam", add: "exam" })).toBe(true);
    expect(addingExam({ add: "exam" })).toBe(true);
  });

  it("doesn't for any other page or value", () => {
    expect(addingExam({})).toBe(false);
    expect(addingExam({ page: "site", add: "exam" })).toBe(false);
    expect(addingExam({ page: "exam", add: "subject" })).toBe(false);
  });
});

describe("examPagesHref", () => {
  it('links to "+ Add exam"', () => {
    expect(examPagesHref({ add: true })).toBe("/admin/exam-pages?page=exam&add=exam");
  });

  it("links to an Exam's section with the code lowercased", () => {
    expect(examPagesHref({ exam: "CE", section: "subjects" })).toBe(
      "/admin/exam-pages?exam=ce&section=subjects",
    );
  });

  it("links to an Exam's Header without naming it", () => {
    expect(examPagesHref({ exam: "ME" })).toBe("/admin/exam-pages?exam=me");
  });

  it("links to each Site page, Home included", () => {
    expect(examPagesHref({ page: "site", site: "about" })).toBe(
      "/admin/exam-pages?page=site&site=about",
    );
    expect(examPagesHref({ page: "site" })).toBe("/admin/exam-pages?page=site&site=home");
  });

  it("links to each of About's sections, and its Header without naming it", () => {
    expect(examPagesHref({ page: "site", site: "about", aboutSection: "story" })).toBe(
      "/admin/exam-pages?page=site&site=about&section=story",
    );
    expect(examPagesHref({ page: "site", site: "about", aboutSection: "seo" })).toBe(
      "/admin/exam-pages?page=site&site=about&section=seo",
    );
    expect(examPagesHref({ page: "site", site: "about", aboutSection: "header" })).toBe(
      "/admin/exam-pages?page=site&site=about",
    );
    // The other Site pages have only their search settings.
    expect(examPagesHref({ page: "site", site: "faq", aboutSection: "story" })).toBe(
      "/admin/exam-pages?page=site&site=faq",
    );
  });

  it("links to the promo banner and announcement bar pages", () => {
    expect(examPagesHref({ page: "promo" })).toBe("/admin/exam-pages?page=promo");
    expect(examPagesHref({ page: "announcement" })).toBe("/admin/exam-pages?page=announcement");
  });
});

describe("aboutSectionRows", () => {
  it("lists About's six sections in page order, each always on", () => {
    expect(aboutSectionRows()).toEqual([
      { key: "header", title: "Header", description: "Intro, team photo" },
      { key: "story", title: "Our story", description: "Heading, story, before and after, photos" },
      { key: "growth", title: "How it grew", description: "First, Now, Today, closing line" },
      { key: "mission", title: "The mission", description: "Heading, intro, 4 tabs" },
      { key: "roots", title: "Iloilo City roots", description: "Heading, text, shipping label" },
      { key: "closing", title: "Closing", description: "Heading" },
    ]);
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

describe("aboutPhotoWarnings", () => {
  const FOUR_THREE = "This photo isn't 4:3, so its edges will be cropped.";
  const SOFT = "This photo is smaller than 1200 × 900, so it may look soft.";

  it("has none for a 4:3 photo of at least 1200 × 900", () => {
    expect(aboutPhotoWarnings({ width: 1600, height: 1200 })).toEqual([]);
    expect(aboutPhotoWarnings({ width: 1200, height: 900 })).toEqual([]);
  });

  it("warns about a photo that isn't about 4:3", () => {
    expect(aboutPhotoWarnings({ width: 2000, height: 2000 })).toEqual([FOUR_THREE]);
    expect(aboutPhotoWarnings({ width: 1920, height: 1080 })).toEqual([FOUR_THREE]);
    // 1.27 and 1.40 are close enough.
    expect(aboutPhotoWarnings({ width: 1270, height: 1000 })).toEqual([]);
    expect(aboutPhotoWarnings({ width: 1400, height: 1000 })).toEqual([]);
  });

  it("warns about a photo under 1200 × 900 on either side", () => {
    expect(aboutPhotoWarnings({ width: 800, height: 600 })).toEqual([SOFT]);
    expect(aboutPhotoWarnings({ width: 1000, height: 1000 })).toEqual([FOUR_THREE, SOFT]);
  });
});
