"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { measureImage, putFile } from "@/components/admin/products/put-file";
import { TextField } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import { seoFormValues } from "@/lib/admin/exam-page-form";
import { examPageAddress, shareImageWarning } from "@/lib/admin/exam-pages-view";
import {
  failedPhoto,
  pendingPhoto,
  photoFileRefusal,
  photoState,
  photoUploadBlocker,
} from "@/lib/admin/photo-rules";
import {
  fullTitle,
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  WHOLE_TITLE_MAX,
  seoCheck,
} from "@/lib/admin/seo-check";
import { examPageSeo } from "@/lib/catalogue/exam-copy";
import { cn } from "@/lib/utils";
import type { ExamSeoForm } from "@/services/admin.schema";
import type { AdminExamPage } from "@/services/admin.types";
import type { UploadTicket } from "@/services/uploads.types";

import { SAVED, useExamPartForm } from "./exam-page-editors";

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH & AI VISIBILITY (mockup 110–124, 1045–1048; spec, Phase 2 → Exam
// pages & promo: SEO per Exam page, and Site pages). PAGE TITLE and META
// DESCRIPTION are overrides: blank uses the generated text (an Exam page) or
// the text in code (a Site page), shown as the placeholder, and the counters,
// the search preview and GOOD or CHECK follow what the page will show. The
// share image is uploaded through the upload seam and saved with the rest;
// one that isn't 1200 × 630 is warned about, not refused.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the Website sets up by itself for an Exam page, the summary for AI
 * assistants being /llms.txt (ticket 22). The mockup's "Product data" isn't
 * on the Exam page, so it's left out rather than shown as ON.
 */
const EXAM_SET_UP_AUTOMATICALLY = [
  ["Breadcrumbs", "ON"],
  ["Summary for AI assistants", "ON"],
  ["Sitemap", "AUTO"],
] as const;

/** Pure: a counter's colour, as the mockup's (1046): red over, amber short, green otherwise. */
function counterTone(length: number, max: number, min = 0) {
  if (length > max) return "text-destructive";
  return length < min ? "text-ayc-warning" : "text-ayc-success";
}

/** The parts of an editor's form (useAdminForm) the search fields use. */
type SeoForm = Pick<
  ReturnType<typeof useAdminForm<ExamSeoForm, unknown>>,
  | "change"
  | "changeWith"
  | "fieldError"
  | "formProps"
  | "conflict"
  | "status"
  | "errorMessage"
  | "canSave"
> & { values: ExamSeoForm };

export interface SeoFieldsProps {
  form: SeoForm;
  /** PAGE ADDRESS, e.g. "aceyourcourse.ph/exams/ce". */
  address: string;
  /** What the page shows for a blank field, shown as its placeholder. */
  defaults: { title: string; description: string };
  /** The line that says where blank fields' text comes from. */
  blankNote: string;
  /** SET UP AUTOMATICALLY: what the Website does by itself for the page. */
  setUp: readonly (readonly [string, string])[];
  createUpload: AdminAction<UploadTicket>;
  /** What the share image's upload is for, besides the file: its Exam or its Site page. */
  uploadFor: Record<string, string>;
}

/**
 * The Search & AI visibility form, for an Exam page or a Site page: the
 * address, the title and description with their counters, GOOD or CHECK, the
 * search preview, the share image, and what's set up automatically.
 */
export function SeoFields({
  form,
  address,
  defaults,
  blankNote,
  setUp,
  createUpload,
  uploadFor,
}: SeoFieldsProps) {
  const { values, change, changeWith, fieldError } = form;
  const titleCounter = useId();
  const descriptionCounter = useId();

  const title = values.seoTitle.trim() || defaults.title;
  const description = values.seoDescription.trim() || defaults.description;
  const whole = fullTitle(title);
  const state = seoCheck({ title, description });

  return (
    <form aria-label="Search & AI visibility" className="flex flex-col gap-3.5" {...form.formProps}>
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-medium text-muted-foreground">PAGE ADDRESS</span>
        <p className="border-[1.5px] bg-ayc-sand px-2.5 py-2.25 font-mono text-[13px] text-muted-foreground">
          {address}
        </p>
      </div>
      <p className="text-[13px] leading-[1.45] text-muted-foreground">{blankNote}</p>
      <TextField
        label="PAGE TITLE"
        value={values.seoTitle}
        placeholder={defaults.title}
        onChange={(seoTitle) => change("seoTitle", seoTitle)}
        error={fieldError("seoTitle")}
        describedBy={titleCounter}
        aside={
          <span
            id={titleCounter}
            className={cn(
              "font-mono text-xs font-medium",
              counterTone(whole.length, WHOLE_TITLE_MAX),
            )}
          >
            {whole.length} / {WHOLE_TITLE_MAX}
            <span className="sr-only"> characters, with the site name</span>
          </span>
        }
      />
      <TextField
        label="META DESCRIPTION"
        multiline
        value={values.seoDescription}
        placeholder={defaults.description}
        onChange={(seoDescription) => change("seoDescription", seoDescription)}
        error={fieldError("seoDescription")}
        describedBy={descriptionCounter}
        inputClassName="min-h-18"
        aside={
          <span
            id={descriptionCounter}
            className={cn(
              "font-mono text-xs font-medium",
              counterTone(description.length, SEO_DESCRIPTION_MAX, SEO_DESCRIPTION_MIN),
            )}
          >
            {description.length} / {SEO_DESCRIPTION_MAX}
            <span className="sr-only"> characters</span>
          </span>
        }
      />
      <p className="font-mono text-[11px] font-medium">
        <span className="text-muted-foreground">SEARCH &amp; AI VISIBILITY · </span>
        <span className={state === "good" ? "text-ayc-success" : "text-ayc-warning"}>
          {state === "good"
            ? "GOOD"
            : `CHECK · KEEP THE TITLE TO ${WHOLE_TITLE_MAX} AND THE DESCRIPTION TO ${SEO_DESCRIPTION_MIN}–${SEO_DESCRIPTION_MAX}`}
        </span>
      </p>
      <figure className="flex flex-col gap-1.5">
        <figcaption className="font-mono text-xs font-medium text-muted-foreground">
          SEARCH PREVIEW
        </figcaption>
        <div className="flex flex-col gap-1 border border-ayc-rule bg-white px-4 py-3.5">
          <span className="text-xs text-ayc-slate">{address}</span>
          <span className="line-clamp-1 text-lg leading-[1.3] font-medium text-ayc-blue-dark">
            {whole}
          </span>
          <span className="line-clamp-2 text-[13px] leading-normal text-ayc-slate">
            {description}
          </span>
        </div>
      </figure>
      <ShareImageField
        value={values.shareImage}
        onChange={(next) => changeWith("shareImage", (current) => next(String(current ?? "")))}
        createUpload={createUpload}
        uploadFor={uploadFor}
        error={fieldError("shareImage")}
      />
      <div className="flex flex-col gap-2 border-t border-dashed border-ayc-rule pt-3">
        <span className="font-mono text-xs font-medium text-muted-foreground">
          SET UP AUTOMATICALLY
        </span>
        <dl className="flex flex-col gap-2">
          {setUp.map(([what, how]) => (
            <div key={what} className="flex justify-between gap-2 text-[13px]">
              <dt>{what}</dt>
              <dd className="font-mono text-[11px] font-bold text-ayc-success">{how}</dd>
            </div>
          ))}
        </dl>
      </div>
      {form.conflict ? <ConflictNotice {...form.conflict} what="these search settings" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

interface SeoEditorProps {
  opened: AdminExamPage;
  action: AdminAction<AdminExamPage>;
  createUpload: AdminAction<UploadTicket>;
}

/** An Exam page's Search & AI visibility, its blank fields generated from the Exam. */
export function SeoEditor({ opened, action, createUpload }: SeoEditorProps) {
  const form = useExamPartForm(opened, "seo", {
    action,
    valuesOf: ({ page }) => seoFormValues(page),
    title: `The ${opened.exam.code} search settings`,
    blocker: (values) => photoUploadBlocker([values.shareImage]),
  });
  // What the page shows for blank fields: the text generated from the Exam as saved.
  const generated = examPageSeo(opened.exam, { seoTitle: null, seoDescription: null });
  return (
    <SeoFields
      form={form}
      address={examPageAddress(opened.exam.code)}
      defaults={generated}
      blankNote="Leave a field blank to use the text made from the Exam, shown in grey."
      setUp={EXAM_SET_UP_AUTOMATICALLY}
      createUpload={createUpload}
      uploadFor={{ code: opened.exam.code }}
    />
  );
}

interface ShareImageFieldProps {
  /** The page's image (its src), a finished upload's path, an upload on its way, or "". */
  value: string;
  /** Changes the value from its current one: an upload finishes after other edits. */
  onChange: (next: (current: string) => string) => void;
  createUpload: AdminAction<UploadTicket>;
  /** Its Exam or its Site page, for Storage to file the image under. */
  uploadFor: Record<string, string>;
  error?: string;
}

/** SHARE IMAGE · 1200 × 630 (mockup 120): the image link previews show, or the site's. */
function ShareImageField({
  value,
  onChange,
  createUpload,
  uploadFor,
  error,
}: ShareImageFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; preview: string } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const nextKey = useRef(0);

  useEffect(() => {
    const preview = chosen?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [chosen]);

  async function upload(file: File) {
    const refused = photoFileRefusal(file);
    setRefusal(refused);
    if (refused) return;
    const key = String(nextKey.current++);
    const pending = pendingPhoto(key);
    setChosen({ name: file.name, preview: URL.createObjectURL(file) });
    setWarning(null);
    onChange(() => pending);
    // Measured in the browser; a warning never stops the save.
    void measureImage(file).then((size) => setWarning(size ? shareImageWarning(size) : null));

    const ticket = await callAdminAction(createUpload, {
      input: { ...uploadFor, contentType: file.type, size: file.size },
    });
    let sent = ticket.status === "saved";
    if (ticket.status === "saved") {
      try {
        await putFile(ticket.value.uploadUrl, file, () => {});
      } catch {
        sent = false;
      }
    }
    // Only if it's still the image waiting for this upload.
    const done = ticket.status === "saved" && sent ? ticket.value.path : failedPhoto(key);
    onChange((current) => (current === pending ? done : current));
  }

  const state = photoState(value);
  const shown = chosen && value !== "" ? chosen.preview : value.startsWith("/") ? value : null;
  const describedBy = [error || refusal ? `${id}-error` : null, `${id}-status`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
        SHARE IMAGE · 1200 × 630
      </label>
      <div
        className={cn(
          "flex items-center gap-2.5 border-[1.5px] border-dashed p-2.5 text-[13px] font-medium",
          (error || state === "failed") && "border-destructive",
        )}
      >
        <span className="relative h-8.5 w-16 flex-none overflow-hidden border bg-ayc-sand">
          {shown ? <Image src={shown} alt="" fill unoptimized className="object-cover" /> : null}
        </span>
        <span id={`${id}-status`} className="min-w-0 flex-1 break-words">
          {state === "pending"
            ? `Uploading ${chosen?.name ?? "the image"}…`
            : state === "failed"
              ? "The upload failed. Choose it again, or remove it."
              : value === ""
                ? "Uses the site’s share image"
                : (chosen?.name ?? "This page’s share image")}
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={describedBy}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="min-h-6 cursor-pointer font-bold text-ayc-blue hover:underline"
        >
          {value === "" ? "Upload" : "Replace"}
        </button>
        {value !== "" ? (
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              setWarning(null);
              onChange(() => "");
            }}
            className="min-h-6 cursor-pointer font-bold text-destructive hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
      {warning && value !== "" ? (
        <p className="font-mono text-[11px] font-medium text-ayc-warning">{warning}</p>
      ) : null}
      {error || refusal ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {refusal ?? error}
        </p>
      ) : null}
    </div>
  );
}
