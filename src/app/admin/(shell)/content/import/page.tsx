import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { CardImport } from "@/components/admin/content/card-import";
import { requireStaff } from "@/lib/admin/guard";
import { codeParam } from "@/lib/admin/topics-view";
import { paths } from "@/paths";
import { listExamsForAdmin } from "@/services/admin";

import { checkCardImport, createImportUpload, importCards } from "../actions";

export const metadata: Metadata = { title: "Import cards" };

interface CardImportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * A Subject's card import, for any Staff User (Phase 3, ticket 06; spec,
 * Phase 3 → Spreadsheet import), opened from its Topics list with "Import
 * cards". An Exam or Subject that isn't in the catalogue answers 404.
 */
export default async function CardImportPage({ searchParams }: CardImportPageProps) {
  const query = await searchParams;
  const examCode = codeParam(query.exam) ?? "";
  const subjectCode = codeParam(query.subject) ?? "";
  const actor = await requireStaff(paths.admin.cardImport(examCode, subjectCode));
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
      <CardImport
        exam={{ code: exam.code, name: exam.name }}
        subject={{ code: subject.code, name: subject.name }}
        actions={{ createImportUpload, checkCardImport, importCards }}
      />
    </AdminScreen>
  );
}
