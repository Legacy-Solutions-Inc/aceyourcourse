"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { callAdminAction } from "@/components/admin/call-admin-action";
import type { AdminAction } from "@/lib/admin/action";
import { percentDone, progressLabel } from "@/lib/reviewer-pdfs/job";
import { PDF_CONTENT_TYPE, pdfFileProblem } from "@/lib/reviewer-pdfs/pdf-file";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type { AdminReviewerPdf } from "@/services/admin.types";
import type { ReviewerPdfUploadTicket } from "@/services/uploads.types";

import {
  DeletePdf,
  nameOf,
  refusalOf,
  SplitFailure,
  StatusChip,
  uploadLine,
  useRefreshWhileProcessing,
} from "./reviewer-pdf-parts";
import { sendReviewerPdf } from "./send-reviewer-pdf";

export interface ReviewerPdfsActions {
  /** Where the browser sends a PDF: a resumable upload, or the sample data's one-time URL. */
  createReviewerPdfUpload: AdminAction<ReviewerPdfUploadTicket>;
  /** Records the uploaded PDF, which starts its job. */
  addReviewerPdf: AdminAction<AdminReviewerPdf>;
  removeReviewerPdf: AdminAction<AdminReviewerPdf>;
}

interface ReviewerPdfsProps {
  pdfs: AdminReviewerPdf[];
  actions: ReviewerPdfsActions;
}

const LABEL = "font-mono text-[11px] font-bold tracking-[0.06em]";
const BUTTON =
  "inline-flex min-h-10 cursor-pointer items-center border-[1.5px] px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60";

const DIDNT_UPLOAD = "COULDN’T UPLOAD IT · CHECK YOUR CONNECTION AND TRY AGAIN";
const UPLOAD_STOPPED = "THE UPLOAD STOPPED · CHECK YOUR CONNECTION AND UPLOAD IT AGAIN";

type UploadState =
  | { kind: "idle" }
  | { kind: "sending"; name: string; sent: number }
  | { kind: "recording"; name: string }
  | { kind: "uploaded"; name: string }
  | { kind: "refused"; message: string };

/**
 * The drop zone (BUILD-MAP §3.5): the Editor drops or chooses a PDF, which the
 * browser checks (a PDF of up to 200 MB), sends straight to the private
 * bucket with its progress shown, then records. The page must stay open until
 * it's uploaded; after that the job carries on without it.
 */
function PdfUpload({
  actions,
  onUploaded,
}: {
  actions: ReviewerPdfsActions;
  onUploaded: () => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = state.kind === "sending" || state.kind === "recording";

  // Leaving mid-upload loses the upload: the browser asks first.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function upload(file: File) {
    const problem = pdfFileProblem(file);
    if (problem) {
      setState({ kind: "refused", message: problem });
      return;
    }
    const name = file.name;
    setState({ kind: "sending", name, sent: 0 });
    const ticket = await callAdminAction(actions.createReviewerPdfUpload, {
      input: { contentType: PDF_CONTENT_TYPE, size: file.size },
    });
    if (ticket.status !== "saved") {
      setState({ kind: "refused", message: refusalOf(ticket, DIDNT_UPLOAD) });
      return;
    }
    try {
      await sendReviewerPdf(ticket.value, file, (sent) =>
        setState({ kind: "sending", name, sent }),
      );
    } catch {
      setState({ kind: "refused", message: UPLOAD_STOPPED });
      return;
    }
    setState({ kind: "recording", name });
    const recorded = await callAdminAction(actions.addReviewerPdf, {
      input: { path: ticket.value.path, fileName: name },
    });
    if (recorded.status !== "saved") {
      setState({ kind: "refused", message: refusalOf(recorded, DIDNT_UPLOAD) });
      return;
    }
    setState({ kind: "uploaded", name });
    toast("✓ UPLOADED · SPLITTING IT INTO PAGES");
    onUploaded();
  }

  function chosen(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (file && !busy) void upload(file);
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    chosen(event.dataTransfer.files[0]);
  }

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className="flex flex-col gap-2"
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 border-2 border-dashed bg-ayc-paper px-5 py-4.5",
          dragging && "bg-ayc-sand",
        )}
      >
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <h2 id={`${inputId}-heading`} className="text-lg font-extrabold">
            Drop a Reviewer PDF here
          </h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Uploaded as-is. Each page becomes its own image. The PDF itself is never shown to
            Members. Up to 200 MB.
          </p>
        </div>
        <label
          htmlFor={inputId}
          className={cn(
            BUTTON,
            "bg-primary text-primary-foreground has-[:focus-visible]:outline-2",
            busy && "pointer-events-none opacity-60",
          )}
        >
          Choose a PDF
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={`${PDF_CONTENT_TYPE},.pdf`}
            disabled={busy}
            onChange={(event) => chosen(event.target.files?.[0])}
            className="sr-only"
          />
        </label>
      </div>

      {state.kind === "sending" ? (
        <div
          role="progressbar"
          aria-label={`Uploading ${state.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(state.sent * 100)}
          className="h-2 bg-ayc-ruled"
        >
          <span
            className="block h-full bg-ayc-blue"
            style={{ width: `${Math.round(state.sent * 100)}%` }}
          />
        </div>
      ) : null}
      <p role="status" aria-live="polite" className={`${LABEL} text-muted-foreground`}>
        {state.kind === "sending"
          ? `UPLOADING ${state.name} · ${Math.round(state.sent * 100)}% · KEEP THIS PAGE OPEN UNTIL IT’S UPLOADED`
          : state.kind === "recording"
            ? `UPLOADED ${state.name} · STARTING TO SPLIT IT INTO PAGES`
            : state.kind === "uploaded"
              ? `✓ UPLOADED ${state.name} · YOU CAN LEAVE THIS PAGE. IT KEEPS GOING AND SHOWS UP AS A DRAFT WHEN DONE.`
              : ""}
      </p>
      {state.kind === "refused" ? (
        <p role="alert" className={`${LABEL} text-destructive`}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

/** One Reviewer PDF: its file, where it's placed, its status and progress, and why it failed. */
function PdfRow({
  pdf,
  actions,
  onChanged,
}: {
  pdf: AdminReviewerPdf;
  actions: ReviewerPdfsActions;
  onChanged: () => void;
}) {
  const { upload, placement, status } = pdf;
  const name = nameOf(pdf);
  const progress = progressLabel({
    status,
    pageCount: upload?.pageCount ?? null,
    pagesDone: upload?.pagesDone ?? 0,
  });
  const done = status === "processing" && upload ? percentDone(upload) : null;

  return (
    <li className="flex flex-col gap-2 border-b border-ayc-ruled px-3.5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          <Link
            href={paths.admin.reviewerPdf(pdf.id)}
            className="w-fit text-sm font-semibold wrap-anywhere text-ayc-blue underline-offset-2 hover:underline"
          >
            {name}
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground">{uploadLine(pdf)}</span>
          <span className="text-xs text-muted-foreground">
            {placement
              ? `${placement.examCode} › ${placement.subjectCode} › ${placement.topicName}`
              : "Not placed under a Topic yet"}
          </span>
        </div>
        <StatusChip status={status} />
        <DeletePdf pdf={pdf} remove={actions.removeReviewerPdf} onDeleted={onChanged} />
      </div>
      <p className="font-mono text-xs font-medium">{progress}</p>
      {done !== null ? (
        <div
          role="progressbar"
          aria-label={`Pages split from ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={done}
          className="h-1.5 bg-ayc-ruled"
        >
          <span className="block h-full bg-ayc-blue" style={{ width: `${done}%` }} />
        </div>
      ) : null}
      <SplitFailure pdf={pdf} />
    </li>
  );
}

/**
 * The Reviewer PDFs screen (Phase 3, ticket 12; stories 114, 115; BUILD-MAP
 * §3.5): the drop zone, then every Reviewer PDF with its status and progress
 * ("Processing · 75 of 312 pages"), which reads itself again every few
 * seconds while any is Processing, so the Editor sees each one become a Draft
 * or fail with the fix to try. Delete removes one, its original and its page
 * images. Each one's name opens its own screen (ticket 13), where it's
 * placed, previewed and published.
 */
export function ReviewerPdfs({ pdfs, actions }: ReviewerPdfsProps) {
  const router = useRouter();
  useRefreshWhileProcessing(pdfs.some((pdf) => pdf.status === "processing"));

  return (
    <div className="flex flex-col gap-4">
      <PdfUpload actions={actions} onUploaded={() => router.refresh()} />
      <section aria-labelledby="reviewer-pdfs-list" className="border-[1.5px] bg-ayc-paper">
        <h2
          id="reviewer-pdfs-list"
          className={`${LABEL} border-b-[1.5px] px-3.5 py-2.5 text-muted-foreground`}
        >
          REVIEWER PDFS · {pdfs.length}
        </h2>
        {pdfs.length > 0 ? (
          <ul aria-label="Reviewer PDFs">
            {pdfs.map((pdf) => (
              <PdfRow key={pdf.id} pdf={pdf} actions={actions} onChanged={() => router.refresh()} />
            ))}
          </ul>
        ) : (
          <p className="px-3.5 py-7 text-center text-sm text-muted-foreground">
            No Reviewer PDFs yet. Upload one above.
          </p>
        )}
      </section>
    </div>
  );
}
