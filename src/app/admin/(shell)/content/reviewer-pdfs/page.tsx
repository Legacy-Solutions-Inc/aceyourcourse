import type { Metadata } from "next";
import Link from "next/link";

import { AdminScreen } from "@/components/admin/admin-screen";
import { ReviewerPdfs } from "@/components/admin/content/reviewer-pdfs";
import { requireStaff } from "@/lib/admin/guard";
import { paths } from "@/paths";
import { listReviewerPdfsForAdmin } from "@/services/admin";

import { addReviewerPdf, createReviewerPdfUpload, removeReviewerPdf } from "./actions";

export const metadata: Metadata = { title: "Reviewer PDFs" };

/**
 * The Reviewer PDFs, for any Staff User (Phase 3, ticket 12; stories 114,
 * 115; BUILD-MAP §3.5), read fresh on every request: upload one, follow each
 * job's progress until it's a Draft (or Failed, with the fix to try), and
 * delete one. Placing, previewing and publishing come with ticket 13.
 */
export default async function ReviewerPdfsPage() {
  const actor = await requireStaff(paths.admin.reviewerPdfs);
  const pdfs = await listReviewerPdfsForAdmin(actor);

  return (
    <AdminScreen screen="content">
      <Link
        href={paths.admin.content}
        className="w-fit text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline"
      >
        ← Topics
      </Link>
      <ReviewerPdfs
        pdfs={pdfs}
        actions={{ createReviewerPdfUpload, addReviewerPdf, removeReviewerPdf }}
      />
    </AdminScreen>
  );
}
