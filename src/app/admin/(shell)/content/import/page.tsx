import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import {
  ContentImport,
  type ContentImportActions,
} from "@/components/admin/content/content-import";
import { requireStaff } from "@/lib/admin/guard";
import { codeParam } from "@/lib/admin/topics-view";
import { IMPORT_KINDS, type ImportKind } from "@/lib/content-import/modes";
import { paths } from "@/paths";
import { listExamsForAdmin } from "@/services/admin";

import {
  checkCardImport,
  checkQuizImport,
  createImportUpload,
  importCards,
  importQuizzes,
} from "../actions";

interface ContentImportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Pure: what the address asks to import (`kind=quizzes`), cards unless it names another kind. */
const kindOf = (value: string | string[] | undefined): ImportKind =>
  IMPORT_KINDS.find((kind) => kind === value) ?? "cards";

const SCREENS: Record<
  ImportKind,
  {
    title: string;
    path: (exam: string, subject: string) => string;
    actions: ContentImportActions;
  }
> = {
  cards: {
    title: "Import cards",
    path: paths.admin.cardImport,
    actions: { createImportUpload, checkImport: checkCardImport, confirmImport: importCards },
  },
  quizzes: {
    title: "Import quizzes",
    path: paths.admin.quizImport,
    actions: { createImportUpload, checkImport: checkQuizImport, confirmImport: importQuizzes },
  },
};

export async function generateMetadata({
  searchParams,
}: ContentImportPageProps): Promise<Metadata> {
  return { title: SCREENS[kindOf((await searchParams).kind)].title };
}

/**
 * A Subject's spreadsheet import, for any Staff User: its cards (Phase 3,
 * ticket 06), opened from its Topics list with "Import cards", or its
 * quizzes (ticket 09, `kind=quizzes`), opened with "Import quizzes" (spec,
 * Phase 3 → Spreadsheet import). An Exam or Subject that isn't in the
 * catalogue answers 404.
 */
export default async function ContentImportPage({ searchParams }: ContentImportPageProps) {
  const query = await searchParams;
  const kind = kindOf(query.kind);
  const screen = SCREENS[kind];
  const examCode = codeParam(query.exam) ?? "";
  const subjectCode = codeParam(query.subject) ?? "";
  const actor = await requireStaff(screen.path(examCode, subjectCode));
  const exam = (await listExamsForAdmin(actor)).find((candidate) => candidate.code === examCode);
  const subject = exam?.subjects.find((candidate) => candidate.code === subjectCode);
  if (!exam || !subject) notFound();

  return (
    <AdminScreen screen="content">
      <Link
        href={paths.admin.contentTopics(exam.code, subject.code)}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← {subject.code} Topics
      </Link>
      <ContentImport
        key={kind}
        kind={kind}
        exam={{ code: exam.code, name: exam.name }}
        subject={{ code: subject.code, name: subject.name }}
        actions={screen.actions}
      />
    </AdminScreen>
  );
}
