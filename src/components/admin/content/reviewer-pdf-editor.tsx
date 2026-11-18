"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { AddExamForm, AddSubjectForm } from "@/components/admin/exam-pages/exam-manage";
import { SelectField, TextField } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { useInstantSave } from "@/components/admin/use-instant-save";
import { WatermarkOverlay } from "@/components/watermark-overlay";
import type { AdminAction } from "@/lib/admin/action";
import {
  libraryLine,
  openingPlacement,
  pickedTopicHolder,
  type PlacementExams,
  statusLine,
  topicOptions,
} from "@/lib/admin/reviewer-pdf-view";
import { progressLabel } from "@/lib/reviewer-pdfs/job";
import { changeRefusal, reviewerPdfState, TOPIC_TAKEN } from "@/lib/reviewer-pdfs/status";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";
import type {
  AdminError,
  AdminExamPage,
  AdminReviewerPdf,
  AdminReviewerPdfDetail,
  AdminReviewerPdfScreen,
  AdminTopic,
  PlacementTopic,
} from "@/services/admin.types";

import { ContentSwitch } from "./content-switch";
import {
  DeletePdf,
  nameOf,
  refusalOf,
  SplitFailure,
  StatusChip,
  uploadLine,
  useRefreshWhileProcessing,
} from "./reviewer-pdf-parts";
import { useAddTopic } from "./use-add-topic";

// ─────────────────────────────────────────────────────────────────────────────
// One Reviewer PDF's screen (Phase 3, ticket 13; stories 116, 128, 133o;
// BUILD-MAP §3.5, the detail panel): its pages previewed one at a time as
// Members will see them, with the Staff User's own email over them; its
// placement under an Exam, Subject and Topic, with "+ New topic" (and, for
// Owners, "+ Add exam" and "+ Add subject"), saved with the conflict check;
// its Free Preview switch; and Publish or Unpublish, disabled with the reason
// while it can't be. The server enforces every rule and records each change
// in Staff Activity; this screen only shows what it answered.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewerPdfEditorActions {
  savePlacement: AdminAction<AdminReviewerPdfDetail>;
  savePublished: AdminAction<AdminReviewerPdfDetail>;
  saveFreePreview: AdminAction<AdminReviewerPdfDetail>;
  /** The Topics editor's "+ Add topic", for "+ New topic". */
  addTopic: AdminAction<AdminTopic>;
  removeReviewerPdf: AdminAction<AdminReviewerPdf>;
}

/** Pages & promo's Owner-only forms (ticket 23), for "+ Add exam" and "+ Add subject". */
export interface ReviewerPdfOwnerActions {
  addExam: AdminAction<AdminExamPage>;
  addSubject: AdminAction<AdminExamPage>;
}

interface ReviewerPdfEditorProps {
  screen: AdminReviewerPdfScreen;
  /** Every Exam, in the catalogue's order, each with its Subjects. */
  exams: PlacementExams;
  /** The Staff User viewing: their email is over the preview, as a Member's is over theirs. */
  viewer: { email: string };
  actions: ReviewerPdfEditorActions;
  /** An Owner's "+ Add exam" and "+ Add subject"; null for an Editor, who sees neither. */
  ownerActions: ReviewerPdfOwnerActions | null;
}

const LABEL = "font-mono text-[11px] font-bold tracking-[0.06em]";
const PANEL = "flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4";
const DASHED_BUTTON =
  "min-h-8.5 cursor-pointer border-[1.5px] border-dashed bg-transparent px-3 text-xs font-bold text-ayc-blue hover:bg-ayc-sand";
const PAGE_BUTTON =
  "min-h-9 min-w-10 cursor-pointer border-[1.5px] px-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";

/** The preview: one page at a time, as Members see it, with the viewer's email over it. */
function PagePreview({ pdf, viewer }: { pdf: AdminReviewerPdfDetail; viewer: { email: string } }) {
  const headingId = useId();
  const stored = pdf.upload?.pagesDone ?? 0;
  const total = pdf.upload?.pageCount ?? stored;
  const [page, setPage] = useState(1);
  const shown = Math.min(page, Math.max(stored, 1));

  let empty: string | null = null;
  if (!pdf.upload) empty = "From the sample data: it has no file, so it has no pages.";
  else if (stored === 0 && pdf.status === "failed")
    empty = "It has no pages: it couldn’t be split.";
  else if (stored === 0) empty = "Its pages show here as they’re split.";

  return (
    <section aria-labelledby={headingId} className={PANEL}>
      <h3 id={headingId} className={`${LABEL} text-ayc-blue`}>
        PREVIEW
      </h3>
      {empty ? (
        <p className="border border-dashed border-ayc-rule p-3.5 text-sm">{empty}</p>
      ) : (
        <>
          <figure
            className="relative mx-auto w-full max-w-105 overflow-hidden border-[1.5px] bg-white select-none"
            onContextMenu={(event) => event.preventDefault()}
          >
            {/* A clean page read through the Admin's Staff-only route, never cached: not for next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paths.admin.reviewerPdfPage(pdf.id, shown)}
              alt={`Page ${shown} of ${total}`}
              draggable={false}
              className="block h-auto w-full"
            />
            <WatermarkOverlay text={viewer.email} />
          </figure>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous page"
              disabled={shown <= 1}
              onClick={() => setPage(shown - 1)}
              className={PAGE_BUTTON}
            >
              ←
            </button>
            <span role="status" className="font-mono text-[11px] font-medium text-muted-foreground">
              PREVIEW · {shown} / {total} · AS MEMBERS SEE IT
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={shown >= stored}
              onClick={() => setPage(shown + 1)}
              className={PAGE_BUTTON}
            >
              →
            </button>
          </div>
          {stored < total ? (
            <p className="text-xs text-muted-foreground">
              Pages {stored + 1}–{total} show here once they’re split.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/** "+ New topic": a Topic made in the Subject picked, by the Topics editor's rules, without leaving. */
function NewTopicForm({
  exam,
  subject,
  action,
  onMade,
  onCancel,
}: {
  exam: string;
  subject: string;
  action: AdminAction<AdminTopic>;
  onMade: (topic: AdminTopic) => void;
  onCancel: () => void;
}) {
  const { name, setName, error, pending, submit } = useAddTopic(
    action,
    { exam, subject },
    (topic) => {
      toast(`✓ TOPIC ADDED · ${topic.name}`);
      onMade(topic);
    },
  );

  return (
    <form
      aria-label="New topic"
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-2.5 border-[1.5px] bg-ayc-cream p-3"
    >
      <TextField
        label={`NEW TOPIC IN ${exam} › ${subject}`}
        placeholder="e.g. Transition Curves"
        value={name}
        onChange={setName}
        error={error}
      />
      <p className="text-xs leading-[1.4] text-muted-foreground">
        It goes last in {subject}’s Topics. Its name can’t be one {subject} has already.
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-9 cursor-pointer border-[1.5px] bg-primary px-3.5 text-[13px] font-bold text-primary-foreground disabled:cursor-wait"
        >
          Add topic
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-9 cursor-pointer border-[1.5px] px-3.5 text-[13px] font-bold hover:bg-ayc-sand"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Pure: the list, with each record of `made` the list doesn't have yet, by key. */
function withMade<T>(list: readonly T[], made: readonly T[], key: (item: T) => string): T[] {
  const have = new Set(list.map(key));
  return [...list, ...made.filter((item) => !have.has(key(item)))];
}

type Adding = "topic" | "exam" | "subject" | null;

/**
 * PLACEMENT: the Exam, Subject and Topic pickers, the Topic-making forms,
 * where Members will find it, and "Save placement". The pickers live outside
 * the save's <form>, so the Topic, Exam and Subject forms beside them are
 * never nested in it; the save sends what the pickers hold.
 */
function PlacementForm({
  pdf,
  topics,
  exams,
  actions,
  ownerActions,
}: Omit<ReviewerPdfEditorProps, "screen" | "viewer"> & {
  pdf: AdminReviewerPdfDetail;
  topics: readonly PlacementTopic[];
}) {
  const router = useRouter();
  const headingId = useId();
  const opening = openingPlacement(pdf, exams);
  const [exam, setExam] = useState(opening.exam);
  const [subject, setSubject] = useState(opening.subject);
  const [stamp, setStamp] = useState(pdf.stamp);
  const [adding, setAdding] = useState<Adding>(null);
  // What was made here, until the page's next read has it.
  const [madeTopics, setMadeTopics] = useState<PlacementTopic[]>([]);
  const [madeExams, setMadeExams] = useState<PlacementExams[number][]>([]);
  const allTopics = withMade(topics, madeTopics, (topic) => topic.id);
  const allExams = withMade(exams, madeExams, (each) => each.code).map(
    (each) => madeExams.find((made) => made.code === each.code) ?? each,
  );

  // Why it can't be placed now (still splitting, failed, or Published), or null.
  const placeRefusal = changeRefusal(reviewerPdfState(pdf, pdf.upload), "place");
  const form = useAdminForm<{ id: string; topic: string }, AdminReviewerPdfDetail>({
    action: actions.savePlacement,
    initialValues: { id: pdf.id, topic: opening.topic },
    savedAt: stamp.savedAt,
    valuesFrom: (saved) => ({ id: saved.id, topic: saved.topicId ?? "" }),
    onSaved: (saved) => {
      setStamp(saved.stamp);
      router.refresh();
    },
    title: "The placement",
    invalidMessage: "CHOOSE A TOPIC",
    blocker: ({ topic }) => {
      if (topic === "") return "CHOOSE A TOPIC";
      // Where it is already: saving changes nothing, so nothing refuses it.
      if (topic === pdf.topicId) return null;
      return placeRefusal ?? (pickedTopicHolder(allTopics, topic, pdf.id) ? TOPIC_TAKEN : null);
    },
  });
  const { values, change, fieldError } = form;
  const holder = pickedTopicHolder(allTopics, values.topic, pdf.id);
  const topicError = fieldError("topic");

  // The server knew of a Reviewer PDF on that Topic that this page didn't: read
  // the page again, so the link to it shows.
  useEffect(() => {
    if (topicError === TOPIC_TAKEN) router.refresh();
  }, [topicError, router]);

  function pickExam(code: string) {
    setExam(code);
    setSubject(allExams.find((each) => each.code === code)?.subjects[0]?.code ?? "");
    change("topic", "");
    setAdding(null);
  }

  function pickSubject(code: string) {
    setSubject(code);
    change("topic", "");
    setAdding(null);
  }

  function topicMade(topic: AdminTopic) {
    setMadeTopics((made) => [
      ...made,
      { ...topic, examCode: exam, subjectCode: subject, reviewerPdfId: null },
    ]);
    change("topic", topic.id);
    setAdding(null);
    router.refresh();
  }

  function examMade(saved: AdminExamPage) {
    setMadeExams((made) => [...made.filter((each) => each.code !== saved.exam.code), saved.exam]);
    setExam(saved.exam.code);
    setSubject(saved.exam.subjects[0]?.code ?? "");
    change("topic", "");
    setAdding(null);
    router.refresh();
  }

  function subjectMade(saved: AdminExamPage) {
    setMadeExams((made) => [...made.filter((each) => each.code !== saved.exam.code), saved.exam]);
    setSubject(saved.exam.subjects.at(-1)?.code ?? "");
    change("topic", "");
    setAdding(null);
  }

  const subjects = allExams.find((each) => each.code === exam)?.subjects ?? [];
  const toggle = (what: Exclude<Adding, null>) => setAdding(adding === what ? null : what);

  return (
    <section aria-labelledby={headingId} className={PANEL}>
      <h3 id={headingId} className={`${LABEL} text-ayc-blue`}>
        PLACEMENT
      </h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <SelectField
          label="EXAM"
          value={exam}
          options={allExams.map((each) => ({ value: each.code, label: each.code }))}
          onChange={pickExam}
        />
        <SelectField
          label="SUBJECT"
          value={subject}
          options={subjects.map((each) => ({
            value: each.code,
            label: `${each.code} · ${each.name}`,
          }))}
          onChange={pickSubject}
        />
      </div>
      {ownerActions ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={adding === "exam"}
            onClick={() => toggle("exam")}
            className={DASHED_BUTTON}
          >
            + Add exam
          </button>
          {exam ? (
            <button
              type="button"
              aria-expanded={adding === "subject"}
              onClick={() => toggle("subject")}
              className={DASHED_BUTTON}
            >
              + Add subject to {exam}
            </button>
          ) : null}
        </div>
      ) : null}
      {ownerActions && adding === "exam" ? (
        <div className="border-[1.5px] bg-ayc-cream p-3.5">
          <AddExamForm
            action={ownerActions.addExam}
            onSaved={examMade}
            onCancel={() => setAdding(null)}
          />
        </div>
      ) : null}
      {ownerActions && adding === "subject" ? (
        <div className="flex flex-col gap-2 border-[1.5px] bg-ayc-cream p-3.5">
          <AddSubjectForm exam={exam} action={ownerActions.addSubject} onSaved={subjectMade} />
          <button
            type="button"
            onClick={() => setAdding(null)}
            className="min-h-6 w-fit cursor-pointer text-[13px] font-semibold text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <SelectField
          label="TOPIC"
          value={values.topic}
          options={topicOptions(allTopics, exam, subject, pdf.id)}
          onChange={(topic) => change("topic", topic)}
          error={topicError}
        />
        {subject ? (
          <button
            type="button"
            aria-expanded={adding === "topic"}
            onClick={() => toggle("topic")}
            className={cn(DASHED_BUTTON, "self-start")}
          >
            + New topic
          </button>
        ) : null}
        {adding === "topic" ? (
          <NewTopicForm
            exam={exam}
            subject={subject}
            action={actions.addTopic}
            onMade={topicMade}
            onCancel={() => setAdding(null)}
          />
        ) : null}
        {holder ? (
          <p className="text-[13px] leading-[1.45]">
            This Topic already has a Reviewer PDF, and a Topic holds only one.{" "}
            <Link
              href={paths.admin.reviewerPdf(holder)}
              className="font-semibold text-ayc-blue underline-offset-2 hover:underline"
            >
              Open that Reviewer PDF
            </Link>
          </p>
        ) : null}
      </div>
      <p className="text-xs leading-[1.45] text-muted-foreground">
        {libraryLine(pdf.status, pdf.placement)}
      </p>
      {placeRefusal ? (
        <p className="font-mono text-[11px] font-medium text-muted-foreground">{placeRefusal}</p>
      ) : null}
      <form aria-label="Save placement" className="flex flex-col gap-3" {...form.formProps}>
        {form.conflict ? <ConflictNotice {...form.conflict} what="this placement" /> : null}
        <EditorSaveRow saveLabel="Save placement" savedMessage="✓ SAVED" form={form} />
      </form>
    </section>
  );
}

/** Pure: what a refused single action says, as a toast. */
const actionRefusal = (error: AdminError) =>
  refusalOf({ status: "refused", error }, "IT WASN’T CHANGED · RELOAD THE PAGE AND TRY AGAIN");

/** IN THE MEMBER APP: Free Preview, and Publish or Unpublish with why it can't be, when it can't. */
function Availability({
  pdf,
  actions,
}: {
  pdf: AdminReviewerPdfDetail;
  actions: ReviewerPdfEditorActions;
}) {
  const headingId = useId();
  const reasonId = useId();
  const name = nameOf(pdf);
  const kept = { what: name, kept: "Nothing changed.", refused: actionRefusal };
  const freePreview = useInstantSave(actions.saveFreePreview, kept);
  const publishing = useInstantSave(actions.savePublished, {
    ...kept,
    onSaved: (saved) =>
      toast(
        saved.status === "published"
          ? "✓ PUBLISHED · MEMBERS CAN SEE IT"
          : "✓ UNPUBLISHED · HIDDEN FROM MEMBERS",
      ),
  });
  const published = pdf.status === "published";
  const reason = changeRefusal(
    reviewerPdfState(pdf, pdf.upload),
    published ? "unpublish" : "publish",
  );

  return (
    <section aria-labelledby={headingId} className={PANEL}>
      <h3 id={headingId} className={`${LABEL} text-ayc-blue`}>
        IN THE MEMBER APP
      </h3>
      <ContentSwitch
        label="Free Preview"
        description="Members with no Access Pass can read it once it’s Published."
        checked={pdf.freePreview}
        disabledReason={null}
        pending={freePreview.pending}
        onChange={(checked) => freePreview.save({ id: pdf.id, freePreview: checked })}
      />
      <div className="flex flex-wrap items-center gap-3 border-t-[1.5px] pt-3.5">
        <button
          type="button"
          onClick={() => publishing.save({ id: pdf.id, published: !published })}
          disabled={publishing.pending || reason !== null}
          aria-describedby={reasonId}
          className="min-h-10.5 cursor-pointer border-[1.5px] bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {published ? "Unpublish" : "Publish"}
        </button>
        <span
          id={reasonId}
          className={cn(
            "min-w-0 flex-1 font-mono text-[11px] font-medium",
            reason ? "text-destructive" : published ? "text-ayc-success" : "text-muted-foreground",
          )}
        >
          {reason ?? statusLine(pdf.status)}
        </span>
      </div>
    </section>
  );
}

/**
 * A Reviewer PDF's screen: what it is and how its job went, then its
 * preview beside its placement and its place in the Member App. It reads
 * itself again every few seconds while it's still being split.
 */
export function ReviewerPdfEditor({
  screen,
  exams,
  viewer,
  actions,
  ownerActions,
}: ReviewerPdfEditorProps) {
  const router = useRouter();
  const { pdf, topics } = screen;
  const { upload, status } = pdf;
  const name = nameOf(pdf);
  useRefreshWhileProcessing(status === "processing");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        aria-labelledby="reviewer-pdf-title"
        className="flex min-w-0 flex-col gap-2 border-[1.5px] bg-ayc-paper p-4.5"
      >
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <h2
            id="reviewer-pdf-title"
            className="min-w-0 flex-[1_1_240px] text-lg font-bold wrap-anywhere"
          >
            {name}
          </h2>
          <StatusChip status={status} />
          <DeletePdf
            pdf={pdf}
            remove={actions.removeReviewerPdf}
            onDeleted={() => router.push(paths.admin.reviewerPdfs)}
          />
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">{uploadLine(pdf)}</p>
        <p className="font-mono text-xs font-medium">
          {progressLabel({
            status,
            pageCount: upload?.pageCount ?? null,
            pagesDone: upload?.pagesDone ?? 0,
          })}
        </p>
        <SplitFailure pdf={pdf} />
      </section>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <PagePreview pdf={pdf} viewer={viewer} />
        <div className="flex min-w-0 flex-col gap-4">
          <PlacementForm
            pdf={pdf}
            topics={topics}
            exams={exams}
            actions={actions}
            ownerActions={ownerActions}
          />
          <Availability pdf={pdf} actions={actions} />
        </div>
      </div>
    </div>
  );
}
