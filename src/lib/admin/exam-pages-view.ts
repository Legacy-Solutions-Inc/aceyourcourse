import { ABOUT_SECTIONS, isAboutSection } from "@/lib/catalogue/about-content";
import { isCalendarDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import type { AdminExamPage } from "@/services/admin.types";
import { isSitePageKey } from "@/services/catalogue.schema";
import type { AboutSectionKey, ExamPageSection, SitePageKey } from "@/services/catalogue.types";

// Pages & promo's URL, its SECTIONS · SHOW OR HIDE list and its warnings
// (BUILD-MAP §3.2). The page, the Exam or Site page, and the section live in
// the URL, so a reload keeps them: ?exam=ce&section=header,
// ?page=site&site=faq, ?page=site&site=about&section=story, ?page=promo,
// ?page=announcement, or ?page=exam&add=exam for "+ Add exam" (CONVENTIONS §2). The page checks the Exam; any other
// Site page opens Home, and any other About section its Header.

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

/** What column 3 edits for About (ticket 21): one of its sections, or Search & AI visibility. */
export type AboutEditorKey = AboutSectionKey | "seo";

const isAboutEditor = (value: string | undefined): value is AboutEditorKey =>
  value === "seo" || isAboutSection(value);

/**
 * Pure: the page, the Exam (as given, or null), its section, the Site page
 * (Home by default), and About's section (its Header by default) in the URL.
 */
export function parseExamPagesParams(params: SearchParams): {
  page: ExamPagesPage;
  exam: string | null;
  section: ExamPageEditorKey;
  site: SitePageKey;
  aboutSection: AboutEditorKey;
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
    aboutSection: isAboutEditor(section) ? section : "header",
  };
}

/** Pure: whether the URL opens "+ Add exam"'s form: ?page=exam&add=exam (ticket 23, Owners only). */
export function addingExam(params: SearchParams): boolean {
  const value = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim();
  };
  const page = value("page");
  return (page === undefined || page === "exam") && value("add") === "exam";
}

/**
 * Pure: the screen's URL for a page, for an Exam and its section (the Header
 * by default), or for a Site page (Home by default) and, for About, its
 * section (its Header by default).
 */
export function examPagesHref({
  page = "exam",
  exam,
  section = "header",
  site = "home",
  aboutSection = "header",
  add = false,
}: {
  /** "+ Add exam"'s form, for Owners. */
  add?: boolean;
  page?: ExamPagesPage;
  exam?: string;
  section?: ExamPageEditorKey;
  site?: SitePageKey;
  aboutSection?: AboutEditorKey;
}): string {
  if (add) return `${paths.admin.examPages}?page=exam&add=exam`;
  const params = new URLSearchParams();
  if (page !== "exam") {
    params.set("page", page);
    if (page === "site") params.set("site", site);
    if (page === "site" && site === "about" && aboutSection !== "header") {
      params.set("section", aboutSection);
    }
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

/** One row of About's SECTIONS: each is always on, since About's shape is fixed. */
export interface AboutSectionRow {
  key: AboutSectionKey;
  title: string;
  description: string;
}

/** About's sections' names, as the SECTIONS list, the editor column and the forms show them. */
export const ABOUT_SECTION_TITLES: Record<AboutSectionKey, string> = {
  header: "Header",
  story: "Our story",
  growth: "How it grew",
  mission: "The mission",
  roots: "Iloilo City roots",
  closing: "Closing",
};

const ABOUT_SECTION_DESCRIPTIONS: Record<AboutSectionKey, string> = {
  header: "Intro, team photo",
  story: "Heading, story, before and after, photos",
  growth: "First, Now, Today, closing line",
  mission: "Heading, intro, 4 tabs",
  roots: "Heading, text, shipping label",
  closing: "Heading",
};

/** Pure: About's sections in page order (ticket 21; spec, Phase 2 → Site pages), for column 2. */
export function aboutSectionRows(): AboutSectionRow[] {
  return ABOUT_SECTIONS.map((key) => ({
    key,
    title: ABOUT_SECTION_TITLES[key],
    description: ABOUT_SECTION_DESCRIPTIONS[key],
  }));
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

/** The ratio About's photo frames show without cropping much: about 4:3. */
const ABOUT_RATIO = { min: 1.27, max: 1.4 };

/** The smallest About photo that looks sharp in its largest frame (560 px wide, at 2×). */
const ABOUT_WIDTH = 1200;
const ABOUT_HEIGHT = 900;

/**
 * Pure: the warnings for a photo put in one of About's 4:3 frames: one that
 * isn't about 4:3, and one under 1200 × 900. It still saves.
 */
export function aboutPhotoWarnings({ width, height }: { width: number; height: number }) {
  const ratio = width / height;
  return [
    ...(ratio < ABOUT_RATIO.min || ratio > ABOUT_RATIO.max
      ? ["This photo isn't 4:3, so its edges will be cropped."]
      : []),
    ...(width < ABOUT_WIDTH || height < ABOUT_HEIGHT
      ? [`This photo is smaller than ${ABOUT_WIDTH} × ${ABOUT_HEIGHT}, so it may look soft.`]
      : []),
  ];
}
