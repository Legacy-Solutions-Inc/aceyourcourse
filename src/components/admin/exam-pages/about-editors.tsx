"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { CountedField } from "@/components/admin/products/product-fields";
import { measureImage, putFile } from "@/components/admin/products/put-file";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AboutPhoto } from "@/content/about";
import { aboutSectionFormValues } from "@/lib/admin/about-form";
import type { AdminAction } from "@/lib/admin/action";
import { ABOUT_SECTION_TITLES, aboutPhotoWarnings } from "@/lib/admin/exam-pages-view";
import {
  failedPhoto,
  pendingPhoto,
  photoFileRefusal,
  photoState,
  photoUploadBlocker,
} from "@/lib/admin/photo-rules";
import {
  ABOUT_ALT_MAX,
  ABOUT_DEFAULTS,
  ABOUT_LIMITS,
  ABOUT_SPEC_MAX,
  type AboutPhotoSlot,
} from "@/lib/catalogue/about-content";
import { listNumber } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { AboutSectionForm } from "@/services/admin.schema";
import type { AdminAbout } from "@/services/admin.types";
import type { AboutSectionKey } from "@/services/catalogue.types";
import type { UploadTicket } from "@/services/uploads.types";

import { INVALID, SAVED } from "./exam-page-editors";

// ─────────────────────────────────────────────────────────────────────────────
// Pages & promo's column 3 for About (ticket 21; spec, Phase 2 → Site pages):
// each section's editor. Every field starts blank and shows today's text as
// its placeholder; blank saves as none, so the Website shows today's text
// again. Each field counts to its limit, red when over. Each section saves
// on its own, with the conflict check against the stamp it opened with, and
// is live on its Save. The small labels, the buttons, the pill and the
// headline stay in code, so they have no fields here. Photos go through the
// upload seam; one that isn't about 4:3, or is under 1200 × 900, is warned
// about, not refused.
// ─────────────────────────────────────────────────────────────────────────────

type FormOf<S extends AboutSectionKey> = Extract<AboutSectionForm, { section: S }>;
type PhotoValue = FormOf<"header">["teamPhoto"];

const TITLES = ABOUT_SECTION_TITLES;

/** Pure: a photo field's value as the form holds it, or today's when it isn't one. */
function photoValueOf(value: unknown): PhotoValue {
  if (typeof value !== "object" || value === null) return { src: "", alt: "" };
  const src = "src" in value && typeof value.src === "string" ? value.src : "";
  const alt = "alt" in value && typeof value.alt === "string" ? value.alt : "";
  return { src, alt };
}

const NOTE = "text-[13px] leading-[1.45] text-muted-foreground";

/** The photos a section's form holds, for "Wait for uploads to finish." */
function photosIn(values: AboutSectionForm): string[] {
  if (values.section === "header") return [values.teamPhoto.src];
  if (values.section === "story") return values.photos.map((photo) => photo.src);
  return [];
}

/** One section's form: its values, its own stamp, and the screen read again after each save. */
function useAboutSectionForm<S extends AboutSectionKey>(
  opened: AdminAbout,
  section: S,
  action: AdminAction<AdminAbout>,
) {
  const router = useRouter();
  const [stamp, setStamp] = useState(opened.stamps[section]);
  return useAdminForm<FormOf<S>, AdminAbout>({
    action,
    initialValues: aboutSectionFormValues(opened.about, section),
    savedAt: stamp.savedAt,
    valuesFrom: (saved) => aboutSectionFormValues(saved.about, section),
    onSaved: (saved) => {
      setStamp(saved.stamps[section]);
      router.refresh();
    },
    title: `About’s ${TITLES[section]}`,
    invalidMessage: INVALID,
    blocker: (values) => photoUploadBlocker(photosIn(values)),
  });
}

type SectionForm<S extends AboutSectionKey> = ReturnType<typeof useAboutSectionForm<S>>;

interface AboutSectionEditorProps {
  section: AboutSectionKey;
  opened: AdminAbout;
  action: AdminAction<AdminAbout>;
  createUpload: AdminAction<UploadTicket>;
}

/** The selected section's editor. */
export function AboutSectionEditor({
  section,
  opened,
  action,
  createUpload,
}: AboutSectionEditorProps) {
  switch (section) {
    case "header":
      return <HeaderEditor opened={opened} action={action} createUpload={createUpload} />;
    case "story":
      return <StoryEditor opened={opened} action={action} createUpload={createUpload} />;
    case "growth":
      return <GrowthEditor opened={opened} action={action} />;
    case "mission":
      return <MissionEditor opened={opened} action={action} />;
    case "roots":
      return <RootsEditor opened={opened} action={action} />;
    case "closing":
      return <ClosingEditor opened={opened} action={action} />;
  }
}

interface EditorProps {
  opened: AdminAbout;
  action: AdminAction<AdminAbout>;
}

/** The form around a section's fields: its blank note, its conflict and its Save. */
function SectionForm<S extends AboutSectionKey>({
  section,
  form,
  children,
}: {
  section: S;
  form: SectionForm<S>;
  children: React.ReactNode;
}) {
  return (
    <form aria-label={TITLES[section]} className="flex flex-col gap-3.5" {...form.formProps}>
      <p className={NOTE}>Leave a field blank to use the page’s text today, shown in grey.</p>
      {children}
      {form.conflict ? <ConflictNotice {...form.conflict} what="this section" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

/** A text field, its counter to its limit and today's text as its placeholder. */
function Text<S extends AboutSectionKey>({
  form,
  path,
  label,
  max,
  placeholder,
  multiline = false,
}: {
  form: SectionForm<S>;
  path: string;
  label: string;
  max: number;
  placeholder: string;
  multiline?: boolean;
}) {
  const value = form.text(path).value;
  return (
    <CountedField
      label={label}
      max={max}
      placeholder={placeholder}
      value={value}
      onChange={(next) => form.change(path, next)}
      error={form.fieldError(path)}
      multiline={multiline}
      inputClassName={multiline ? "min-h-22" : undefined}
    />
  );
}

/** Header: the intro text and the team photo. */
function HeaderEditor({ opened, action, createUpload }: EditorProps & UploadProps) {
  const form = useAboutSectionForm(opened, "header", action);
  const d = ABOUT_DEFAULTS.header;
  return (
    <SectionForm section="header" form={form}>
      <Text
        form={form}
        path="intro"
        label="INTRO TEXT"
        max={ABOUT_LIMITS.header.intro}
        placeholder={d.intro}
        multiline
      />
      <PhotoField
        label="TEAM PHOTO"
        name="team photo"
        slot="team"
        today={d.teamPhoto}
        value={form.values.teamPhoto}
        onChange={(next) => form.changeWith("teamPhoto", (current) => next(photoValueOf(current)))}
        errors={{ src: form.fieldError("teamPhoto.src"), alt: form.fieldError("teamPhoto.alt") }}
        createUpload={createUpload}
      />
    </SectionForm>
  );
}

/** Pure: a list's fields' placeholders: today's items while the whole list is blank, then none. */
const listPlaceholders = (typed: readonly string[], today: readonly string[]) =>
  typed.every((item) => item.trim() === "")
    ? typed.map((_, index) => today[index] ?? "")
    : typed.map(() => "");

/** Our story: the heading, the paragraphs, the before and after, and the three photos. */
function StoryEditor({ opened, action, createUpload }: EditorProps & UploadProps) {
  const form = useAboutSectionForm(opened, "story", action);
  const { values, change, changeWith, fieldError } = form;
  const d = ABOUT_DEFAULTS.story;
  const L = ABOUT_LIMITS.story;
  const paragraphHints = listPlaceholders(values.paragraphs, d.paragraphs);
  const specHints = listPlaceholders(values.afterSpecs, d.afterSpecs);
  const slots: AboutPhotoSlot[] = ["story-1", "story-2", "story-3"];
  return (
    <SectionForm section="story" form={form}>
      <Text form={form} path="heading" label="HEADING" max={L.heading} placeholder={d.heading} />
      <p className={NOTE}>
        Up to three paragraphs. Leave all three blank to use today’s; once one has text, only the
        paragraphs typed show.
      </p>
      {values.paragraphs.map((paragraph, index) => (
        <CountedField
          key={index}
          label={`PARAGRAPH ${index + 1}`}
          max={L.paragraph}
          placeholder={paragraphHints[index] ?? ""}
          value={paragraph}
          onChange={(next) =>
            change(
              "paragraphs",
              values.paragraphs.map((p, i) => (i === index ? next : p)),
            )
          }
          error={fieldError(`paragraphs.${index}`)}
          multiline
          inputClassName="min-h-22"
        />
      ))}
      <Text
        form={form}
        path="beforeTitle"
        label="BEFORE · TITLE"
        max={L.beforeTitle}
        placeholder={d.beforeTitle}
      />
      <Text
        form={form}
        path="beforeBody"
        label="BEFORE · TEXT"
        max={L.beforeBody}
        placeholder={d.beforeBody}
      />
      <Text
        form={form}
        path="afterTitle"
        label="AFTER · TITLE"
        max={L.afterTitle}
        placeholder={d.afterTitle}
      />
      <p className={NOTE}>
        Up to five spec chips, each up to {ABOUT_SPEC_MAX} characters. Leave all five blank to use
        today’s.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
        {values.afterSpecs.map((spec, index) => (
          <CountedField
            key={index}
            label={`SPEC CHIP ${index + 1}`}
            max={ABOUT_SPEC_MAX}
            placeholder={specHints[index] ?? ""}
            value={spec}
            onChange={(next) =>
              change(
                "afterSpecs",
                values.afterSpecs.map((s, i) => (i === index ? next : s)),
              )
            }
            error={fieldError(`afterSpecs.${index}`)}
          />
        ))}
      </div>
      {values.photos.map((photo, index) => (
        <PhotoField
          key={index}
          label={`STORY PHOTO ${index + 1}`}
          name={`story photo ${index + 1}`}
          slot={slots[index] ?? "story-1"}
          today={d.photos[index] ?? d.photos[0] ?? ABOUT_DEFAULTS.header.teamPhoto}
          value={photo}
          onChange={(next) =>
            changeWith("photos", (current) =>
              (Array.isArray(current) ? current : []).map((p: unknown, i) => {
                const photo = photoValueOf(p);
                return i === index ? next(photo) : photo;
              }),
            )
          }
          errors={{
            src: fieldError(`photos.${index}.src`),
            alt: fieldError(`photos.${index}.alt`),
          }}
          createUpload={createUpload}
        />
      ))}
    </SectionForm>
  );
}

/** How it grew: the First item's title, the Now and Today texts, and the closing line. */
function GrowthEditor({ opened, action }: EditorProps) {
  const form = useAboutSectionForm(opened, "growth", action);
  const d = ABOUT_DEFAULTS.growth;
  const L = ABOUT_LIMITS.growth;
  return (
    <SectionForm section="growth" form={form}>
      <Text
        form={form}
        path="firstTitle"
        label="FIRST · TITLE"
        max={L.firstTitle}
        placeholder={d.firstTitle}
      />
      <div className="flex flex-col gap-1.5">
        <Text
          form={form}
          path="nowLead"
          label="NOW · TEXT"
          max={L.nowLead}
          placeholder={d.nowLead}
          multiline
        />
        <p className={NOTE}>
          The website adds “We now make reviewers for …” after it, listing the Exams.
        </p>
      </div>
      <Text
        form={form}
        path="todayBody"
        label="TODAY · TEXT"
        max={L.todayBody}
        placeholder={d.todayBody}
        multiline
      />
      <Text
        form={form}
        path="beginning"
        label="CLOSING LINE"
        max={L.beginning}
        placeholder={d.beginning}
      />
    </SectionForm>
  );
}

/** The mission: the heading, the intro and the four tabs, always four. */
function MissionEditor({ opened, action }: EditorProps) {
  const form = useAboutSectionForm(opened, "mission", action);
  const { values, change, fieldError } = form;
  const d = ABOUT_DEFAULTS.mission;
  const L = ABOUT_LIMITS.mission;
  const setTab = (index: number, part: "title" | "body", next: string) =>
    change(
      "tabs",
      values.tabs.map((tab, i) => (i === index ? { ...tab, [part]: next } : tab)),
    );
  return (
    <SectionForm section="mission" form={form}>
      <Text form={form} path="heading" label="HEADING" max={L.heading} placeholder={d.heading} />
      <Text form={form} path="intro" label="INTRO" max={L.intro} placeholder={d.intro} multiline />
      {values.tabs.map((tab, index) => {
        const number = listNumber(index);
        return (
          <fieldset key={index} className="flex flex-col gap-2.5 border-t border-dashed pt-3">
            <legend className="sr-only">Tab {number}</legend>
            <CountedField
              label={`TAB ${number} · TITLE`}
              max={L.tabs[index]?.title ?? 0}
              placeholder={d.tabs[index]?.title ?? ""}
              value={tab.title}
              onChange={(next) => setTab(index, "title", next)}
              error={fieldError(`tabs.${index}.title`)}
            />
            <CountedField
              label={`TAB ${number} · TEXT`}
              max={L.tabs[index]?.body ?? 0}
              placeholder={d.tabs[index]?.body ?? ""}
              value={tab.body}
              onChange={(next) => setTab(index, "body", next)}
              error={fieldError(`tabs.${index}.body`)}
              multiline
              inputClassName="min-h-22"
            />
            {index === 2 ? (
              <p className="font-mono text-[11px] font-medium text-ayc-warning">
                This text names prices. Update it when prices change.
              </p>
            ) : null}
          </fieldset>
        );
      })}
    </SectionForm>
  );
}

/** Iloilo City roots: the heading, the text, and the shipping label's "To" line. */
function RootsEditor({ opened, action }: EditorProps) {
  const form = useAboutSectionForm(opened, "roots", action);
  const d = ABOUT_DEFAULTS.roots;
  const L = ABOUT_LIMITS.roots;
  return (
    <SectionForm section="roots" form={form}>
      <Text form={form} path="heading" label="HEADING" max={L.heading} placeholder={d.heading} />
      <Text form={form} path="body" label="TEXT" max={L.body} placeholder={d.body} multiline />
      <Text
        form={form}
        path="recipient"
        label="SHIPPING LABEL · TO"
        max={L.recipient}
        placeholder={d.recipient}
      />
    </SectionForm>
  );
}

/** Closing: the heading above the Exam tiles. */
function ClosingEditor({ opened, action }: EditorProps) {
  const form = useAboutSectionForm(opened, "closing", action);
  return (
    <SectionForm section="closing" form={form}>
      <Text
        form={form}
        path="heading"
        label="HEADING"
        max={ABOUT_LIMITS.closing.heading}
        placeholder={ABOUT_DEFAULTS.closing.heading}
      />
    </SectionForm>
  );
}

// ── Photos ──────────────────────────────────────────────────────────────────

interface UploadProps {
  createUpload: AdminAction<UploadTicket>;
}

interface PhotoFieldProps extends UploadProps {
  /** The field's label: "TEAM PHOTO", "STORY PHOTO 2". */
  label: string;
  /** How its buttons name it: "story photo 2". */
  name: string;
  slot: AboutPhotoSlot;
  /** Today's photo, shown while it isn't replaced. */
  today: AboutPhoto;
  /** "" for today's, the photo it has, a finished upload's path, or an upload on its way. */
  value: PhotoValue;
  /** Changes the value from its current one: an upload finishes after other edits. */
  onChange: (next: (current: PhotoValue) => PhotoValue) => void;
  errors: { src?: string; alt?: string };
}

/**
 * One of About's photos, in a 4:3 frame on the Website: today's, or one
 * uploaded in its place with its alt text. Replace uploads a new one; "Use
 * today's photo" puts today's back.
 */
function PhotoField({
  label,
  name,
  slot,
  today,
  value,
  onChange,
  errors,
  createUpload,
}: PhotoFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; preview: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
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
    setWarnings([]);
    onChange((current) => ({ ...current, src: pending }));
    // Measured in the browser; a warning never stops the save.
    void measureImage(file).then((size) => setWarnings(size ? aboutPhotoWarnings(size) : []));

    const ticket = await callAdminAction(createUpload, {
      input: { slot, contentType: file.type, size: file.size },
    });
    let sent = ticket.status === "saved";
    if (ticket.status === "saved") {
      try {
        await putFile(ticket.value.uploadUrl, file, () => {});
      } catch {
        sent = false;
      }
    }
    // Only if it's still the photo waiting for this upload.
    const done = ticket.status === "saved" && sent ? ticket.value.path : failedPhoto(key);
    onChange((current) => (current.src === pending ? { ...current, src: done } : current));
  }

  const replaced = value.src !== "";
  const state = photoState(value.src);
  const shown = !replaced
    ? today.src
    : chosen
      ? chosen.preview
      : value.src.startsWith("/") || value.src.startsWith("http")
        ? value.src
        : null;
  const error = errors.src ?? refusal;
  const describedBy = [error ? `${id}-error` : null, `${id}-status`].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-2.5 border-[1.5px] border-dashed p-2.5 text-[13px] font-medium",
          (error || state === "failed") && "border-destructive",
        )}
      >
        <span className="relative aspect-4/3 w-16 flex-none overflow-hidden border bg-ayc-sand">
          {shown ? <Image src={shown} alt="" fill unoptimized className="object-cover" /> : null}
        </span>
        <span id={`${id}-status`} className="min-w-0 flex-1 break-words">
          {state === "pending"
            ? `Uploading ${chosen?.name ?? "the photo"}…`
            : state === "failed"
              ? "The upload failed. Choose it again, or use today’s photo."
              : !replaced
                ? "Today’s photo"
                : (chosen?.name ?? "A photo in place of today’s")}
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
          Replace<span className="sr-only"> {name}</span>
        </button>
        {replaced ? (
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              setWarnings([]);
              onChange(() => ({ src: "", alt: "" }));
            }}
            className="min-h-6 cursor-pointer font-bold text-destructive hover:underline"
          >
            Use today’s photo<span className="sr-only"> for {name}</span>
          </button>
        ) : null}
      </div>
      {replaced
        ? warnings.map((warning) => (
            <p key={warning} className="font-mono text-[11px] font-medium text-ayc-warning">
              {warning}
            </p>
          ))
        : null}
      {error ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {replaced ? (
        <CountedField
          label={`${label} · ALT TEXT`}
          max={ABOUT_ALT_MAX}
          placeholder="What the photo shows, for screen readers"
          value={value.alt}
          onChange={(alt) => onChange((current) => ({ ...current, alt }))}
          error={errors.alt}
        />
      ) : null}
    </div>
  );
}
