import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { ReviewerPdfEditor } from "@/components/admin/content/reviewer-pdf-editor";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { getReviewerPdfForAdmin, listExamsForAdmin } from "@/services/admin";

import { addTopic } from "@/app/admin/(shell)/content/actions";
import { addExam, addExamSubject } from "@/app/admin/(shell)/exam-pages/actions";
import {
  removeReviewerPdf,
  saveReviewerPdfFreePreview,
  saveReviewerPdfPlacement,
  saveReviewerPdfPublished,
} from "../actions";

export const metadata: Metadata = { title: "Reviewer PDF" };

interface ReviewerPdfPageProps {
  params: Promise<{ id: string }>;
}

/**
 * One Reviewer PDF, for any Staff User (Phase 3, ticket 13; stories 116, 128,
 * 133o; BUILD-MAP §3.5), read fresh on every request: its preview, its
 * placement under an Exam, Subject and Topic ("+ New topic" makes one), its
 * Free Preview switch, and Publish or Unpublish. "+ Add exam" and "+ Add
 * subject" are Pages & promo's Owner-only forms: an Editor gets neither, and
 * their Server Actions refuse one. An id that isn't a Reviewer PDF's is a 404.
 */
export default async function ReviewerPdfPage({ params }: ReviewerPdfPageProps) {
  const { id } = await params;
  const actor = await requireStaff(paths.admin.reviewerPdf(id));
  const [screen, exams] = await Promise.all([
    getReviewerPdfForAdmin(actor, id),
    listExamsForAdmin(actor),
  ]);
  if (!screen) notFound();

  return (
    <AdminScreen screen="content">
      <Link
        href={paths.admin.reviewerPdfs}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← Reviewer PDFs
      </Link>
      <ReviewerPdfEditor
        screen={screen}
        exams={exams.map(({ code, subjects }) => ({
          code,
          subjects: subjects.map((subject) => ({ code: subject.code, name: subject.name })),
        }))}
        viewer={{ email: actor.email }}
        actions={{
          savePlacement: saveReviewerPdfPlacement,
          savePublished: saveReviewerPdfPublished,
          saveFreePreview: saveReviewerPdfFreePreview,
          addTopic,
          removeReviewerPdf,
        }}
        ownerActions={actor.role === "owner" ? { addExam, addSubject: addExamSubject } : null}
      />
    </AdminScreen>
  );
}
