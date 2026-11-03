import type { Metadata } from "next";

import { adminScreen } from "@/components/admin/admin-menu";
import { AdminScreen } from "@/components/admin/admin-screen";
import { ExamPageColumn, ExamPagesNav } from "@/components/admin/exam-pages/exam-pages-columns";
import { AnnouncementEditor } from "@/components/admin/exam-pages/announcement-editor";
import { ExamPagePanel } from "@/components/admin/exam-pages/exam-page-panel";
import { PromoBannerEditor } from "@/components/admin/exam-pages/promo-banner-editor";
import { parseExamPagesParams } from "@/lib/admin/exam-pages-view";
import { requireStaff } from "@/lib/admin/guard";
import { promoStatus } from "@/lib/admin/promo-status";
import { seoCheck } from "@/lib/admin/seo-check";
import { examPageSeo } from "@/lib/catalogue/exam-copy";
import { manilaDate } from "@/lib/manila-time";
import { paths } from "@/paths";
import {
  getAnnouncementForAdmin,
  getExamPageForAdmin,
  getPromoForAdmin,
  listExamsForAdmin,
} from "@/services/admin";
import type { StaffActor } from "@/services/admin.types";

import {
  createShareImageUpload,
  saveAnnouncement,
  saveBundleOffer,
  saveExamHeader,
  saveExamSeo,
  saveOfficialExamDate,
  savePromoBanner,
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
 * Exam pages & promo (BUILD-MAP §3.2): PAGES, the selected Exam page's chips,
 * search check and sections, and the selected part's editor; or the Home
 * promo banner's or the announcement bar's editor. The page, the
 * Exam and the section live in the URL; an unknown Exam shows the first.
 * Everything is read fresh on every request.
 */
export default async function ExamPagesPage({ searchParams }: ExamPagesPageProps) {
  const actor = await requireStaff(paths.admin.examPages);
  const { page, exam: wanted, section } = parseExamPagesParams(await searchParams);
  const exams = await listExamsForAdmin(actor);

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
          />
        </div>
      </div>
    </AdminScreen>
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
