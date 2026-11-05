import { isCalendarDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import type { AdminExamPage } from "@/services/admin.types";
import { isSitePageKey } from "@/services/catalogue.schema";
import type { ExamPageSection, SitePageKey } from "@/services/catalogue.types";

// Pages & promo's URL, its SECTIONS · SHOW OR HIDE list and its warnings
// (BUILD-MAP §3.2). The page, the Exam or Site page, and the section live in
// the URL, so a reload keeps them: ?exam=ce&section=header,
// ?page=site&site=about, ?page=promo or ?page=announcement (CONVENTIONS §2).
// The page checks the Exam; any other Site page opens Home.

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The PAGES column's pages. The promo banner and the announcement bar are
 * ticket 10's, and the Site pages ticket 20's.
 */
export type ExamPagesPage = "exam" | "site" | "promo" | "announcement";

/** What column 3 edits for an Exam page: a section, Search & AI visibility, or the date. */
const EDITORS = ["header", "subjects", "reviewers", "bundle", "reviews", "seo", "date"] as const;

export type ExamPageEditorKey = (typeof EDITORS)[number];

const PAGES: readonly ExamPagesPage[] = ["exam", "site", "promo", "announcement"];

const isPage = (value: string | undefined): value is ExamPagesPage =>
  PAGES.some((page) => page === value);
const isEditor = (value: string | undefined): value is ExamPageEditorKey =>
  EDITORS.some((key) => key === value);

/** Pure: the page, the Exam (as given, or null), its section, and the Site page (Home by default) in the URL. */
export function parseExamPagesParams(params: SearchParams): {
  page: ExamPagesPage;
  exam: string | null;
  section: ExamPageEditorKey;
  site: SitePageKey;
} {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() || undefined;
  };
  const page = value("page");
  const section = value("section");
  const site = value("site");
  return {
    page: isPage(page) ? page : "exam",
    exam: value("exam")?.slice(0, 20) ?? null,
    section: isEditor(section) ? section : "header",
    site: isSitePageKey(site) ? site : "home",
  };
}

/**
 * Pure: the screen's URL for a page, for an Exam and its section (the Header
 * by default), or for a Site page (Home by default).
 */
export function examPagesHref({
  page = "exam",
  exam,
  section = "header",
  site = "home",
}: {
  page?: ExamPagesPage;
  exam?: string;
  section?: ExamPageEditorKey;
  site?: SitePageKey;
}): string {
  const params = new URLSearchParams();
  if (page !== "exam") {
    params.set("page", page);
    if (page === "site") params.set("site", site);
  } else {
    if (exam) params.set("exam", exam.toLowerCase());
    if (section !== "header") params.set("section", section);
  }
  const search = params.toString();
  return search ? `${paths.admin.examPages}?${search}` : paths.admin.examPages;
}

/** Pure: PAGE ADDRESS, as the mockup shows it: "aceyourcourse.ph/exams/ce". */
export const examPageAddress = (code: string) => `aceyourcourse.ph${paths.exams.details(code)}`;

/** One row of SECTIONS · SHOW OR HIDE. `toggle` is null for a section that's always on. */
export interface ExamSectionRow {
  key: ExamPageEditorKey;
  title: string;
  description: string;
  toggle: ExamPageSection | null;
}

/** Pure: the Exam page's sections in page order (mockup 981–989), for column 2. */
export function examSectionRows({ exam, page, products }: AdminExamPage): ExamSectionRow[] {
  const count = exam.subjects.length;
  const offered = page.bundleOffer
    ? products.find((product) => product.id === page.bundleOffer?.productId)
    : undefined;
  return [
    { key: "header", title: "Header", description: "Name, text, image", toggle: null },
    {
      key: "subjects",
      title: "Subjects covered",
      description: `${count} ${count === 1 ? "subject" : "subjects"}`,
      toggle: "subjects",
    },
    {
      key: "reviewers",
      title: "Reviewers",
      description: `Every ${exam.code} product`,
      toggle: null,
    },
    {
      key: "bundle",
      title: "Bundle offer",
      description: offered?.shortName ?? "No offer set",
      toggle: "bundleOffer",
    },
    {
      key: "reviews",
      title: "Reviews",
      description: `From ${exam.code} products`,
      toggle: "reviews",
    },
  ];
}

/** Pure: the warning for an Official Exam Date before today (Manila), or null. It still saves. */
export function examDateWarning(date: string, today: string): string | null {
  return isCalendarDate(date) && date < today
    ? "THIS DATE HAS PASSED · SET THE NEXT ONE ONCE PRC ANNOUNCES IT"
    : null;
}

/** The share image's size, which link previews show without cropping. */
const SHARE_WIDTH = 1200;
const SHARE_HEIGHT = 630;

/** Pure: the warning for a share image that isn't 1200 × 630, or null. It still saves. */
export function shareImageWarning({ width, height }: { width: number; height: number }) {
  return width === SHARE_WIDTH && height === SHARE_HEIGHT
    ? null
    : `${width} × ${height} · NOT ${SHARE_WIDTH} × ${SHARE_HEIGHT}, SO IT MAY BE CROPPED`;
}
