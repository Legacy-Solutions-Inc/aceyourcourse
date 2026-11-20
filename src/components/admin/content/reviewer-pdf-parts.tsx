"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { TypedDeleteDialog } from "@/components/admin/typed-delete-dialog";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { formatDateTime } from "@/lib/manila-time";
import { failureMessage } from "@/lib/reviewer-pdfs/job";
import { fileSizeLabel } from "@/lib/reviewer-pdfs/pdf-file";
import { cn } from "@/lib/utils";
import type { AdminReviewerPdf } from "@/services/admin.types";
import type { ReviewerPdfStatus } from "@/services/content.types";

// What the Reviewer PDFs screen (ticket 12) and one Reviewer PDF's screen
// (ticket 13) share: its name, its file's line, its status chip, why its
// split failed, Delete behind the typed confirmation, what a refused action
// says, and reading the page again while a job is Processing.

/** How often a screen reads itself again while a job is Processing. */
export const REFRESH_MS = 3000;

const STATUS_STYLE: Record<ReviewerPdfStatus, string> = {
  processing: "border-ayc-blue text-ayc-blue",
  draft: "border-foreground text-foreground",
  published: "border-ayc-success text-ayc-success",
  unpublished: "border-muted-foreground text-muted-foreground",
  failed: "border-destructive text-destructive",
};

/** Pure: what a refused or failed action says to the Editor. */
export function refusalOf(state: AdminActionState<unknown>, failed: string): string {
  if (state.status !== "refused") return failed;
  const { error } = state;
  if (error.kind === "forbidden") return error.message;
  if (error.kind === "invalid") {
    const field = Object.values(error.fieldErrors).flat()[0];
    return error.formError ?? field ?? failed;
  }
  return failed;
}

/**
 * Pure: a Reviewer PDF's name: its file's, or, for the sample data's (which
 * have no file), its Topic's.
 */
export const nameOf = ({ upload, placement }: AdminReviewerPdf) =>
  upload?.fileName ?? `${placement?.topicName ?? "Sample"} Reviewer PDF`;

/** Pure: its file's size and when it was uploaded, or that it's the sample data's, with none. */
export const uploadLine = ({ upload }: AdminReviewerPdf) =>
  upload
    ? `${fileSizeLabel(upload.fileSize)} · UPLOADED ${formatDateTime(upload.uploadedAt).toUpperCase()}`
    : "FROM THE SAMPLE DATA · NO FILE";

/** Reads the page again every few seconds while `processing`, so a job's progress shows. */
export function useRefreshWhileProcessing(processing: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [processing, router]);
}

/** A Reviewer PDF's status, as a chip. */
export function StatusChip({ status }: { status: ReviewerPdfStatus }) {
  return (
    <span
      className={cn(
        "border-[1.5px] px-1.5 py-1 font-mono text-[10px] leading-none font-bold",
        STATUS_STYLE[status],
      )}
    >
      {status.toUpperCase()}
    </span>
  );
}

/** Why a Failed one's split failed, with the fix to try (BUILD-MAP §3.5: the FAILED box). */
export function SplitFailure({ pdf }: { pdf: AdminReviewerPdf }) {
  if (pdf.status !== "failed" || !pdf.upload?.failure) return null;
  const { reason, fix } = failureMessage(pdf.upload.failure);
  return (
    <div className="flex flex-col gap-1 border-[1.5px] border-destructive bg-white px-3 py-2.5">
      <span className="text-sm font-bold text-destructive">Couldn’t split this PDF</span>
      <span className="text-[13px] leading-normal">
        {reason} {fix}
      </span>
    </div>
  );
}

/** Delete, behind the typed confirmation (BUILD-MAP §2: deleteReviewer). */
export function DeletePdf({
  pdf,
  remove,
  onDeleted,
}: {
  pdf: AdminReviewerPdf;
  remove: AdminAction<AdminReviewerPdf>;
  onDeleted: () => void;
}) {
  const name = nameOf(pdf);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(remove, { input: { id: pdf.id } });
      if (state.status === "saved") {
        setOpen(false);
        toast(`✓ DELETED · ${name}`);
        onDeleted();
      } else if (state.status === "refused" && state.error.kind === "not-found") {
        setError("IT’S ALREADY DELETED · RELOAD THE PAGE");
      } else {
        setError(refusalOf(state, "COULDN’T DELETE IT · CHECK YOUR CONNECTION AND TRY AGAIN"));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        aria-label={`Delete ${name}`}
        className="min-h-6 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
      >
        Delete
      </button>
      <TypedDeleteDialog
        open={open}
        onOpenChange={setOpen}
        tag="DELETE REVIEWER PDF"
        title={`Delete “${name}”?`}
        description={
          pdf.status === "processing"
            ? "Splitting it into pages stops. The original PDF and every page image are deleted from storage."
            : "Its pages are removed from the Member App, and Members lose their place in it. The original PDF and every page image are deleted from storage."
        }
        confirmLabel="Delete Reviewer PDF"
        onConfirm={confirm}
        pending={pending}
        error={error}
      />
    </>
  );
}
