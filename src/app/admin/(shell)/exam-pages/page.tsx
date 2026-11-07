import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import {
  ExamPageColumn,
  ExamPagesNav,
  NewExamColumn,
  SitePageColumn,
} from "@/components/admin/exam-pages/exam-pages-columns";
import { AddExamForm } from "@/components/admin/exam-pages/exam-manage";
import { AboutSectionEditor } from "@/components/admin/exam-pages/about-editors";
import { AnnouncementEditor } from "@/components/admin/exam-pages/announcement-editor";
import { ExamPagePanel } from "@/components/admin/exam-pages/exam-page-panel";
import { PromoBannerEditor } from "@/components/admin/exam-pages/promo-banner-editor";
import { SitePageSeoEditor } from "@/components/admin/exam-pages/site-page-seo-editor";
import {
  ABOUT_SECTION_TITLES,
  type AboutEditorKey,
  addingExam,
  parseExamPagesParams,
} from "@/lib/admin/exam-pages-view";
import { requireStaff } from "@/lib/admin/guard";
import { promoStatus } from "@/lib/admin/promo-status";
import { seoCheck } from "@/lib/admin/seo-check";
import { examPageSeo } from "@/lib/catalogue/exam-copy";
import { SITE_PAGE_DEFAULTS, sitePageAddress, sitePageSeo } from "@/lib/catalogue/site-page-seo";
import { manilaDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import {
  getAboutForAdmin,
  getAnnouncementForAdmin,
  getExamPageForAdmin,
  getPromoForAdmin,
  getSitePageForAdmin,
  listExamsForAdmin,
} from "@/services/admin";
import type { StaffActor } from "@/services/admin.types";
import type { SitePageKey } from "@/services/catalogue.types";

import {
  addExam,
  addExamSubject,
  createAboutPhotoUpload,
  createShareImageUpload,
  createSitePageShareImageUpload,
  removeExam,
  removeExamSubject,
  saveAboutSection,
  saveAnnouncement,
  saveBundleOffer,
  saveExamHeader,
  saveExamSeo,
  saveOfficialExamDate,
  savePromoBanner,
  saveSitePageSeo,
  saveSubjectNames,
  setExamPageSection,
  setPromoBanner,
} from "./actions";

export const metadata: Metadata = { title: adminScreen("exam-pages").title };

interface ExamPagesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The grid of the mockup's three columns (mockup 83), stacked on narrower screens.
 * Stacked, its one column still fits the screen: a long unbroken title in the
 * search preview can't widen it.
 */
const COLUMNS =
  "grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_290px_minmax(0,1fr)]";

/**
 * Pages & promo (BUILD-MAP §3.2; renamed from "Exam pages & promo" in ticket
 * 20): PAGES, the selected Exam page's chips, search check and sections, and
 * the selected part's editor; a Site page's chips, search check and its
 * Search & AI visibility, and for About its sections and the selected one's
 * editor (ticket 21); or the Home promo banner's or the announcement bar's
 * editor. An Owner also adds Exams (?page=exam&add=exam) and Subjects, and
 * deletes those nothing uses (ticket 23). The page, the Exam or Site page, and the section live in the URL;
 * an unknown Exam shows the first, an unknown Site page Home, and an unknown
 * About section its Header. Everything is read fresh on every request.
 */
export default async function ExamPagesPage({ searchParams }: ExamPagesPageProps) {
  const actor = await requireStaff(paths.admin.examPages);
  const params = await searchParams;
  const { page, exam: wanted, section, site, aboutSection } = parseExamPagesParams(params);
  const exams = await listExamsForAdmin(actor);
  // Adding and deleting Exams and Subjects is for Owners (ticket 23): an
  // Editor sees none of it, and the actions and the seam refuse one anyway.
  const isOwner = actor.role === "owner";

  if (page === "site") {
    return (
      <AdminScreen screen="exam-pages">
        <div className={COLUMNS}>
          <ExamPagesNav current="site" examCount={exams.length} />
          {await sitePage(actor, site, aboutSection)}
        </div>
      </AdminScreen>
    );
  }

  if (page !== "exam") {
    const editor = page === "promo" ? await promoEditor(actor) : await announcementEditor(actor);
    return (
      <AdminScreen screen="exam-pages">
        <div className={COLUMNS}>
          <ExamPagesNav current={page} examCount={exams.length} />
          <aside
            aria-label="Page editor"
            className="flex min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5 xl:col-span-2"
          >
            <h2 className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
              {page === "promo" ? "HOME PROMO BANNER" : "ANNOUNCEMENT BAR"}
            </h2>
            {editor}
          </aside>
        </div>
      </AdminScreen>
    );
  }

  const exam = exams.find((e) => e.code === wanted?.toUpperCase()) ?? exams[0];
  const opened = exam ? await getExamPageForAdmin(actor, exam.code) : null;

  if (isOwner && (addingExam(params) || !opened)) {
    return (
      <AdminScreen screen="exam-pages">
        <div className={COLUMNS}>
          <ExamPagesNav current="exam" examCount={exams.length} />
          <NewExamColumn
            examCodes={exams.map((e) => e.code)}
            onWebsite={opened?.examsOnWebsite ?? []}
          />
          <aside
            aria-label="Exam page editor"
            className="flex min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5 lg:col-span-2 xl:col-span-1"
          >
            <h2 className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
              ADD EXAM
            </h2>
            <AddExamForm action={addExam} />
          </aside>
        </div>
      </AdminScreen>
    );
  }

  if (!opened) {
    return (
      <AdminScreen screen="exam-pages">
        <p className="text-sm text-muted-foreground">The catalogue has no Exams yet.</p>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen screen="exam-pages">
      <div className={COLUMNS}>
        <ExamPagesNav current="exam" examCount={exams.length} />
        <ExamPageColumn
          opened={opened}
          examCodes={exams.map((e) => e.code)}
          selected={section}
          seoState={seoCheck(examPageSeo(opened.exam, opened.page))}
          setSection={setExamPageSection}
          canAddExam={isOwner}
        />
        <div className="lg:col-span-2 xl:col-span-1">
          <ExamPagePanel
            opened={opened}
            selected={section}
            today={manilaDate(new Date())}
            actions={{
              setSection: setExamPageSection,
              saveHeader: saveExamHeader,
              saveSubjects: saveSubjectNames,
              saveBundle: saveBundleOffer,
              saveSeo: saveExamSeo,
              saveDate: saveOfficialExamDate,
              createShareImageUpload,
            }}
            manage={
              isOwner
                ? {
                    addSubject: addExamSubject,
                    removeSubject: removeExamSubject,
                    removeExam,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </AdminScreen>
  );
}

/**
 * Columns 2 and 3 for a Site page: its chips and search check, and its
 * Search & AI visibility; for About, its sections too, and the selected
 * one's editor.
 */
async function sitePage(actor: StaffActor, site: SitePageKey, aboutSection: AboutEditorKey) {
  const opened = await getSitePageForAdmin(actor, site);
  const { path, title, description } = SITE_PAGE_DEFAULTS[site];
  const column = (
    <SitePageColumn
      site={site}
      path={path}
      seoState={seoCheck(sitePageSeo(opened.page))}
      aboutSection={aboutSection}
    />
  );
  if (site === "about" && aboutSection !== "seo") {
    const about = await getAboutForAdmin(actor);
    return (
      <>
        {column}
        <aside
          aria-label="Site page editor"
          className="flex min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5 lg:col-span-2 xl:col-span-1"
        >
          <h2 className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            EDIT · {ABOUT_SECTION_TITLES[aboutSection].toUpperCase()} · ABOUT
          </h2>
          <AboutSectionEditor
            key={aboutSection}
            section={aboutSection}
            opened={about}
            action={saveAboutSection}
            createUpload={createAboutPhotoUpload}
          />
        </aside>
      </>
    );
  }
  return (
    <>
      {column}
      <aside
        aria-label="Site page editor"
        className="flex min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5 lg:col-span-2 xl:col-span-1"
      >
        <h2 className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
          SEARCH &amp; AI VISIBILITY · SITE PAGES · {site.toUpperCase()}
        </h2>
        <SitePageSeoEditor
          key={site}
          opened={opened}
          defaults={{ address: sitePageAddress(site), title, description }}
          action={saveSitePageSeo}
          createUpload={createSitePageShareImageUpload}
        />
      </aside>
    </>
  );
}

/** The Home promo banner's editor, with its status as the Website sees it now. */
async function promoEditor(actor: StaffActor) {
  const opened = await getPromoForAdmin(actor);
  return (
    <PromoBannerEditor
      opened={opened}
      status={promoStatus(opened.banner, new Date())}
      actions={{ save: savePromoBanner, setVisible: setPromoBanner }}
    />
  );
}

async function announcementEditor(actor: StaffActor) {
  const opened = await getAnnouncementForAdmin(actor);
  return <AnnouncementEditor opened={opened} action={saveAnnouncement} />;
}
