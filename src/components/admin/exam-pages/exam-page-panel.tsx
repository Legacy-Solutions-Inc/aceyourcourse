import type { AdminAction } from "@/lib/admin/action";
import { type ExamPageEditorKey, examSectionRows } from "@/lib/admin/exam-pages-view";
import type { AdminExamPage } from "@/services/admin.types";
import type { UploadTicket } from "@/services/uploads.types";

import {
  BundleEditor,
  DateEditor,
  HeaderEditor,
  ReviewersNote,
  ReviewsNote,
  SubjectsEditor,
} from "./exam-page-editors";
import { AddSubjectForm, DeleteExam, type ExamManageActions } from "./exam-manage";
import { SeoEditor } from "./exam-seo-editor";

export interface ExamPageActions {
  setSection: AdminAction<AdminExamPage>;
  saveHeader: AdminAction<AdminExamPage>;
  saveSubjects: AdminAction<AdminExamPage>;
  saveBundle: AdminAction<AdminExamPage>;
  saveSeo: AdminAction<AdminExamPage>;
  saveDate: AdminAction<AdminExamPage>;
  createShareImageUpload: AdminAction<UploadTicket>;
}

interface ExamPagePanelProps {
  opened: AdminExamPage;
  selected: ExamPageEditorKey;
  actions: ExamPageActions;
  /** Today in Manila, for the past-date warning. */
  today: string;
  /**
   * For an Owner: "+ Add subject", each Subject's remove button and "Delete
   * exam" (ticket 23). An Editor's panel has none of them.
   */
  manage?: ExamManageActions;
}

const LABELS: Record<ExamPageEditorKey, string> = {
  header: "EDIT · HEADER",
  subjects: "EDIT · SUBJECTS COVERED",
  reviewers: "EDIT · REVIEWERS",
  bundle: "EDIT · BUNDLE OFFER",
  reviews: "EDIT · REVIEWS",
  seo: "SEARCH & AI VISIBILITY · EXAM PAGES",
  date: "OFFICIAL EXAM DATE",
};

/**
 * Column 3 (mockup 103–145): the selected section's editor, Search & AI
 * visibility, or the Official Exam Date. Each editor is keyed by its Exam, so
 * another Exam opens its own values.
 */
export function ExamPagePanel({ opened, selected, actions, today, manage }: ExamPagePanelProps) {
  const key = `${opened.exam.code}-${selected}`;
  // A section that can be hidden says so over its editor.
  const toggle = examSectionRows(opened).find((row) => row.key === selected)?.toggle;
  const hidden = toggle ? !opened.page.sections[toggle] : false;

  let editor: React.ReactNode;
  switch (selected) {
    case "header":
      editor = (
        <>
          <HeaderEditor key={key} opened={opened} action={actions.saveHeader} />
          {manage ? <DeleteExam opened={opened} action={manage.removeExam} /> : null}
        </>
      );
      break;
    case "subjects":
      editor = (
        <>
          <SubjectsEditor
            // A Subject added or removed opens the editor again, with the new list and stamp.
            key={`${key}-${opened.exam.subjects.map((subject) => subject.code).join("|")}`}
            opened={opened}
            action={actions.saveSubjects}
            removeSubject={manage?.removeSubject}
          />
          {manage ? <AddSubjectForm key={key} opened={opened} action={manage.addSubject} /> : null}
        </>
      );
      break;
    case "reviewers":
      editor = <ReviewersNote opened={opened} />;
      break;
    case "bundle":
      editor = <BundleEditor key={key} opened={opened} action={actions.saveBundle} />;
      break;
    case "reviews":
      editor = <ReviewsNote opened={opened} />;
      break;
    case "seo":
      editor = (
        <SeoEditor
          key={key}
          opened={opened}
          action={actions.saveSeo}
          createUpload={actions.createShareImageUpload}
        />
      );
      break;
    case "date":
      editor = <DateEditor key={key} opened={opened} action={actions.saveDate} today={today} />;
      break;
  }

  return (
    <aside
      aria-label="Exam page editor"
      className="flex min-w-0 flex-col gap-3.5 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
          {LABELS[selected]} · {opened.exam.code}
        </h2>
        {hidden ? (
          <span className="font-mono text-[10px] font-bold text-ayc-warning">HIDDEN ON SITE</span>
        ) : null}
      </div>
      {editor}
    </aside>
  );
}
