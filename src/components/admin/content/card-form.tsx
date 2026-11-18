"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { putFile } from "@/components/admin/products/put-file";
import { CardFace } from "@/components/flashcards/card-face";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { type CardField, cardFieldProblems } from "@/lib/cards/card-fields";
import {
  CARD_TEXT_LIMITS,
  cardImageProblem,
  isCardImageType,
  textLength,
} from "@/lib/cards/card-rules";
import { renderFormula } from "@/lib/formula/render";
import { cn } from "@/lib/utils";
import type { AdminCard, RecordStamp } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

export interface CardFormActions {
  createCardImageUpload: AdminAction<ContentUploadTicket>;
  addCard: AdminAction<AdminCard>;
  saveCard: AdminAction<AdminCard>;
}

interface CardFormProps {
  topicId: string;
  /** The label each preview face carries, e.g. "MSTC · SIMPLE CURVES". */
  label: string;
  /** The card being edited, or null for a new one. */
  card: AdminCard | null;
  /** Where the browser loads the card's saved image from, when it has one. */
  imageSrc: string | null;
  /** The Staff User's email, the preview's watermark, as Members see their own. */
  watermark: string;
  actions: CardFormActions;
  /** After a save: the card, and whether the Editor asked for the next one. */
  onSaved: (card: AdminCard, next: boolean) => void;
}

/** The back image as the form holds it: none, the card's own, or a file chosen here. */
type ImageState =
  { kind: "none" } | { kind: "saved"; path: string } | { kind: "chosen"; file: File; url: string };

type FieldErrors = Partial<Record<CardField | "image", string>>;

const LABELS: Record<CardField, { label: string; hint: string; mono?: boolean }> = {
  front: { label: "FRONT · THE PROMPT", hint: "e.g. Tangent distance" },
  back: { label: "BACK · THE ANSWER OR FORMULA", hint: "e.g. $T = R \\tan(I/2)$", mono: true },
  note: { label: "NOTE · OPTIONAL", hint: "Units, conditions, or a memory tip" },
};

const BUTTON =
  "min-h-10 cursor-pointer border-[1.5px] px-3.5 text-[13px] font-bold disabled:cursor-wait";

/** Pure: each field's message from a refused save, the image's included. */
function fieldErrorsOf(state: AdminActionState<unknown>): FieldErrors {
  if (state.status !== "refused" || state.error.kind !== "invalid") return {};
  const errors: FieldErrors = {};
  for (const field of ["front", "back", "note", "image"] as const) {
    const message = state.error.fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }
  return errors;
}

/** Pure: what a refused or failed save says, apart from its fields' messages and a conflict. */
function formMessage(state: AdminActionState<unknown>): string | null {
  if (state.status === "failed") return "COULDN’T SAVE · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return null;
  const { error } = state;
  switch (error.kind) {
    case "invalid":
      return error.formError ?? "NOT SAVED · CHECK THE FIELDS MARKED IN RED";
    case "forbidden":
      return error.message;
    case "not-found":
      return "THAT CARD OR TOPIC IS GONE · RELOAD THE PAGE";
    case "conflict":
      return null;
  }
}

/** One of the card's text fields: a labelled textarea, with its count and its message. */
function CardTextField({
  field,
  value,
  error,
  onChange,
  inputRef,
}: {
  field: CardField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  const { label, hint, mono } = LABELS[field];
  const limit = CARD_TEXT_LIMITS[field];
  const length = textLength(value.trim());
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-mono text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <span
          className={cn(
            "font-mono text-[11px] text-muted-foreground",
            length > limit && "font-bold text-destructive",
          )}
        >
          {length.toLocaleString("en")} / {limit.toLocaleString("en")}
        </span>
      </div>
      <textarea
        id={id}
        ref={inputRef}
        name={field}
        value={value}
        placeholder={hint}
        rows={field === "front" ? 2 : 3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full min-w-0 resize-y border-[1.5px] bg-white px-2.5 py-2 text-[14px] text-foreground aria-invalid:border-destructive",
          mono && "font-mono text-[13px]",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The card form (BUILD-MAP §3.6 → Card editor; story 125): the front, back
 * and note in the formula notation, an optional back image, and a live
 * preview of both faces as Members will see them, maths rendered. A formula
 * that won't render is shown in the preview and refused on save. "Save"
 * opens the saved card; "Save & add next" clears the form for the next one.
 * The browser checks each field and the image first, uploads a new image
 * straight to the private content bucket, and the server checks it all
 * again, with the conflict check on an edit.
 */
export function CardForm({
  topicId,
  label,
  card,
  imageSrc,
  watermark,
  actions,
  onSaved,
}: CardFormProps) {
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [note, setNote] = useState(card?.note ?? "");
  const [image, setImage] = useState<ImageState>(
    card?.image ? { kind: "saved", path: card.image } : { kind: "none" },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savedLine, setSavedLine] = useState<string | null>(null);
  const [conflict, setConflict] = useState<RecordStamp | null>(null);
  const [pending, startTransition] = useTransition();
  // The stamp the next save sends: the card's when the form opened, then each save's own.
  const stamp = useRef(card?.stamp);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A chosen file's preview URL is freed once it's replaced, or the form goes.
  const chosenUrl = image.kind === "chosen" ? image.url : null;
  useEffect(() => {
    return () => {
      if (chosenUrl) URL.revokeObjectURL(chosenUrl);
    };
  }, [chosenUrl]);

  const shownImage = image.kind === "chosen" ? image.url : image.kind === "saved" ? imageSrc : null;
  const previewProblems = (["front", "back", "note"] as const).flatMap((field) => {
    const rendered = renderFormula({ front, back, note }[field]);
    return rendered.ok ? [] : [`The ${field} ${rendered.problem}`];
  });

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Refused before anything is uploaded; the server checks the file again.
    const problem = cardImageProblem({ type: file.type, size: file.size });
    if (problem) {
      setErrors((current) => ({ ...current, image: problem }));
      return;
    }
    setErrors(({ image: _, ...rest }) => rest);
    setImage({ kind: "chosen", file, url: URL.createObjectURL(file) });
  }

  /** Uploads a chosen image: the path the save sends, null for none, or why it couldn't. */
  async function imagePath(): Promise<{ ok: true; path: string | null } | { ok: false }> {
    if (image.kind === "none") return { ok: true, path: null };
    if (image.kind === "saved") return { ok: true, path: image.path };
    const { file } = image;
    // Checked when it was chosen; the server checks it again.
    if (!isCardImageType(file.type)) return { ok: false };
    const ticket = await callAdminAction(actions.createCardImageUpload, {
      input: { contentType: file.type, size: file.size },
    });
    if (ticket.status !== "saved") {
      const refusal =
        ticket.status === "refused" && ticket.error.kind === "invalid"
          ? (ticket.error.fieldErrors.contentType?.[0] ?? ticket.error.fieldErrors.size?.[0])
          : undefined;
      setErrors((current) => ({
        ...current,
        image: refusal ?? "COULDN’T UPLOAD THE IMAGE · TRY AGAIN",
      }));
      return { ok: false };
    }
    try {
      await putFile(ticket.value.uploadUrl, file, () => {}, ticket.value.contentType);
    } catch {
      setErrors((current) => ({ ...current, image: "COULDN’T UPLOAD THE IMAGE · TRY AGAIN" }));
      return { ok: false };
    }
    return { ok: true, path: ticket.value.path };
  }

  function save(next: boolean) {
    if (pending) return;
    setMessage(null);
    setSavedLine(null);
    setConflict(null);
    const problems = cardFieldProblems({ front, back, note });
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const uploaded = await imagePath();
      if (!uploaded.ok) return;
      const fields = { front, back, note, image: uploaded.path };
      const state = card
        ? await callAdminAction(actions.saveCard, {
            input: { id: card.id, ...fields },
            expected: stamp.current ? { savedAt: stamp.current.savedAt } : undefined,
          })
        : await callAdminAction(actions.addCard, { input: { topic: topicId, ...fields } });

      if (state.status === "saved") {
        const saved = state.value;
        stamp.current = saved.stamp;
        toast(`✓ SAVED · CARD ${saved.position}`);
        if (next) {
          setFront("");
          setBack("");
          setNote("");
          setImage({ kind: "none" });
          setSavedLine(`✓ SAVED CARD ${saved.position} · WRITING THE NEXT ONE`);
          frontRef.current?.focus();
        } else {
          setImage(saved.image ? { kind: "saved", path: saved.image } : { kind: "none" });
          setSavedLine(`✓ SAVED CARD ${saved.position}`);
        }
        onSaved(saved, next);
      } else if (state.status === "refused" && state.error.kind === "conflict") {
        setConflict(state.error);
      } else {
        setErrors(fieldErrorsOf(state));
        setMessage(formMessage(state));
      }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(false);
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={card ? `Card ${card.position}` : "New card"}
      className="flex min-w-0 flex-col gap-3"
    >
      <h3 className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
        {card ? `CARD ${card.position}` : "NEW CARD"}
      </h3>
      <CardTextField
        field="front"
        value={front}
        error={errors.front}
        onChange={setFront}
        inputRef={frontRef}
      />
      <CardTextField field="back" value={back} error={errors.back} onChange={setBack} />

      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 font-mono text-xs font-medium text-muted-foreground">
          IMAGE ON THE BACK · OPTIONAL
        </legend>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            id={`${topicId}-card-image`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={image.kind === "none" ? "Add an image" : "Replace the image"}
            aria-invalid={errors.image ? true : undefined}
            aria-describedby={errors.image ? `${topicId}-card-image-error` : undefined}
            onChange={chooseImage}
            className="max-w-full text-[13px] file:mr-2 file:min-h-9 file:cursor-pointer file:border-[1.5px] file:bg-ayc-paper file:px-3 file:text-[13px] file:font-bold"
          />
          {image.kind !== "none" ? (
            <button
              type="button"
              onClick={() => setImage({ kind: "none" })}
              className="min-h-9 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
            >
              Remove image
            </button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          A JPEG, PNG or WebP, up to 5 MB. Members see it on the back.
          {image.kind === "chosen" ? ` Chosen: ${image.file.name}.` : ""}
        </p>
        {errors.image ? (
          <p
            id={`${topicId}-card-image-error`}
            className="font-mono text-[11px] font-medium text-destructive"
          >
            {errors.image}
          </p>
        ) : null}
      </fieldset>

      <CardTextField field="note" value={note} error={errors.note} onChange={setNote} />

      <section aria-labelledby={`${topicId}-preview`} className="flex flex-col gap-2">
        <h4
          id={`${topicId}-preview`}
          className="font-mono text-[11px] font-bold tracking-[0.06em] text-muted-foreground"
        >
          PREVIEW · AS MEMBERS SEE IT
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <CardFace
            side="front"
            label={label}
            text={front}
            placeholder="The front shows here"
            watermark={watermark}
          />
          <CardFace
            side="back"
            label={label}
            text={back}
            note={note}
            imageSrc={shownImage}
            placeholder="The back shows here"
            watermark={watermark}
          />
        </div>
        <div aria-live="polite">
          {previewProblems.map((problem) => (
            <p key={problem} className="font-mono text-[11px] font-medium text-destructive">
              {problem}
            </p>
          ))}
        </div>
      </section>

      {conflict ? <ConflictNotice {...conflict} what="this card" /> : null}
      {message ? (
        <p role="alert" className="font-mono text-[11px] font-bold text-destructive">
          {message}
        </p>
      ) : null}
      <p role="status" className="font-mono text-[11px] font-bold text-ayc-blue">
        {savedLine}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON} bg-primary text-primary-foreground`}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save(true)}
          className={`${BUTTON} bg-ayc-paper`}
        >
          Save &amp; add next
        </button>
      </div>
    </form>
  );
}
