"use client";

import { type ChangeEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { putFile } from "@/components/admin/products/put-file";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { cardImageProblem, isCardImageType, textLength } from "@/lib/cards/card-rules";
import { cn } from "@/lib/utils";
import type { RecordStamp } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

// ─────────────────────────────────────────────────────────────────────────────
// What the card form (ticket 07) and the question form (ticket 10) share: a
// text field in the formula notation with its count and message, an
// optional image (a card's back image, a question's figure) that the browser
// checks and uploads straight to the private content bucket, and the save:
// the form's own checks, then the upload and the Server Action, with the
// stamp the form opened with, and what its answer shows (each field's
// message, a conflict, the saved line) above the two save buttons.
// ─────────────────────────────────────────────────────────────────────────────

/** An image as the form holds it: none, the record's own, or a file chosen here. */
export type ImageState =
  { kind: "none" } | { kind: "saved"; path: string } | { kind: "chosen"; file: File; url: string };

const UPLOAD_FAILED = "COULDN’T UPLOAD THE IMAGE · TRY AGAIN";

const BUTTON =
  "min-h-10 cursor-pointer border-[1.5px] px-3.5 text-[13px] font-bold disabled:cursor-wait";

/**
 * Pure: what a refused or failed save says, apart from its fields' messages
 * and a conflict, which show where they belong. `gone` is what a save of a
 * record that's no longer there says.
 */
function saveRefusal(state: AdminActionState<unknown>, gone: string): string | null {
  if (state.status === "failed") return "COULDN’T SAVE · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return null;
  const { error } = state;
  switch (error.kind) {
    case "invalid":
      return error.formError ?? "NOT SAVED · CHECK THE FIELDS MARKED IN RED";
    case "forbidden":
      return error.message;
    case "not-found":
      return gone;
    case "conflict":
      return null;
  }
}

/** Pure: each field's message from a refused save, for the fields the form has. */
function fieldErrorsOf<Field extends string>(
  state: AdminActionState<unknown>,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  if (state.status !== "refused" || state.error.kind !== "invalid") return {};
  const errors: Partial<Record<Field, string>> = {};
  for (const field of fields) {
    const message = state.error.fieldErrors[field]?.[0];
    if (message) errors[field] = message;
  }
  return errors;
}

/** A card or question as its save answers it: its place, and its new stamp. */
interface SavedItem {
  position: number;
  stamp: RecordStamp;
}

/**
 * A content form's save, "Save" or "Save & add next", and what it shows. The
 * form's own problems stop it before anything is uploaded or sent; `send`
 * uploads and saves, with the stamp the form opened with (then each save's
 * own), or gives null when the upload failed (its field says why). Once
 * saved it toasts and says so; a conflict, a field's refusal or a failure
 * shows where it belongs, and the form keeps what was typed.
 */
export function useContentSave<Saved extends SavedItem, Field extends string>({
  noun,
  gone,
  fields,
  opened,
}: {
  noun: "CARD" | "QUESTION";
  /** What a save of a record that's no longer there says. */
  gone: string;
  fields: readonly Field[];
  /** The record's stamp when the form opened, or none for a new one. */
  opened: RecordStamp | undefined;
}) {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savedLine, setSavedLine] = useState<string | null>(null);
  const [conflict, setConflict] = useState<RecordStamp | null>(null);
  const [pending, startTransition] = useTransition();
  const stamp = useRef(opened);

  function save({
    next,
    problems,
    send,
    onSaved,
  }: {
    next: boolean;
    problems: Partial<Record<Field, string>>;
    send: (expected: { savedAt: string } | undefined) => Promise<AdminActionState<Saved> | null>;
    onSaved: (saved: Saved) => void;
  }) {
    if (pending) return;
    setMessage(null);
    setSavedLine(null);
    setConflict(null);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const state = await send(stamp.current ? { savedAt: stamp.current.savedAt } : undefined);
      if (!state) return;
      if (state.status === "saved") {
        const saved = state.value;
        stamp.current = saved.stamp;
        toast(`✓ SAVED · ${noun} ${saved.position}`);
        const line = `✓ SAVED ${noun} ${saved.position}`;
        setSavedLine(next ? `${line} · WRITING THE NEXT ONE` : line);
        onSaved(saved);
      } else if (state.status === "refused" && state.error.kind === "conflict") {
        setConflict(state.error);
      } else {
        setErrors(fieldErrorsOf(state, fields));
        setMessage(saveRefusal(state, gone));
      }
    });
  }

  return { errors, setErrors, message, savedLine, conflict, pending, save };
}

/** One text field in the formula notation: a labelled textarea, with its count and its message. */
export function FormulaTextField({
  name,
  label,
  hint,
  limit,
  value,
  error,
  onChange,
  inputRef,
  rows = 3,
  mono = false,
}: {
  name: string;
  label: string;
  hint: string;
  limit: number;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  rows?: number;
  mono?: boolean;
}) {
  const id = useId();
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
        name={name}
        value={value}
        placeholder={hint}
        rows={rows}
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
 * An optional image's state, its checks and its upload. A chosen file is
 * checked before anything is uploaded (a JPEG, PNG or WebP of at most 5 MB;
 * the server checks it again), and its preview URL is freed once it's
 * replaced or the form goes. `onProblem` gets each message for the field.
 */
export function useImageUpload(
  saved: string | null,
  createUpload: AdminAction<ContentUploadTicket>,
  onProblem: (message: string | null) => void,
) {
  const [image, setImage] = useState<ImageState>(
    saved ? { kind: "saved", path: saved } : { kind: "none" },
  );

  const chosenUrl = image.kind === "chosen" ? image.url : null;
  useEffect(() => {
    return () => {
      if (chosenUrl) URL.revokeObjectURL(chosenUrl);
    };
  }, [chosenUrl]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = cardImageProblem({ type: file.type, size: file.size });
    onProblem(problem);
    if (!problem) setImage({ kind: "chosen", file, url: URL.createObjectURL(file) });
  }

  /** Uploads a chosen image: the path the save sends, null for none, or nothing when it couldn't. */
  async function upload(): Promise<{ ok: true; path: string | null } | { ok: false }> {
    if (image.kind === "none") return { ok: true, path: null };
    if (image.kind === "saved") return { ok: true, path: image.path };
    const { file } = image;
    // Checked when it was chosen; the server checks it again.
    if (!isCardImageType(file.type)) return { ok: false };
    const ticket = await callAdminAction(createUpload, {
      input: { contentType: file.type, size: file.size },
    });
    if (ticket.status !== "saved") {
      const refusal =
        ticket.status === "refused" && ticket.error.kind === "invalid"
          ? (ticket.error.fieldErrors.contentType?.[0] ?? ticket.error.fieldErrors.size?.[0])
          : undefined;
      onProblem(refusal ?? UPLOAD_FAILED);
      return { ok: false };
    }
    try {
      await putFile(ticket.value.uploadUrl, file, () => {}, ticket.value.contentType);
    } catch {
      onProblem(UPLOAD_FAILED);
      return { ok: false };
    }
    return { ok: true, path: ticket.value.path };
  }

  /** Where the browser shows the image from: a chosen file's preview, or the saved one's `savedSrc`. */
  const shownSrc = (savedSrc: string | null) =>
    image.kind === "chosen" ? image.url : image.kind === "saved" ? savedSrc : null;

  return { image, setImage, choose, upload, shownSrc };
}

/** The image field: a file input, "Remove", what it takes, and its message. */
export function ImageField({
  id,
  legend,
  noun,
  hint,
  image,
  error,
  onChoose,
  onRemove,
}: {
  id: string;
  legend: string;
  /** "image" or "figure": the input is "Add an image", "Replace the figure"… */
  noun: "image" | "figure";
  hint: string;
  image: ImageState;
  error?: string;
  onChoose: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const article = noun === "image" ? "an" : "a";
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 font-mono text-xs font-medium text-muted-foreground">
        {legend}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={image.kind === "none" ? `Add ${article} ${noun}` : `Replace the ${noun}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={onChoose}
          className="max-w-full text-[13px] file:mr-2 file:min-h-9 file:cursor-pointer file:border-[1.5px] file:bg-ayc-paper file:px-3 file:text-[13px] file:font-bold"
        />
        {image.kind !== "none" ? (
          <button
            type="button"
            onClick={onRemove}
            className="min-h-9 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
          >
            Remove {noun}
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        A JPEG, PNG or WebP, up to 5 MB. {hint}
        {image.kind === "chosen" ? ` Chosen: ${image.file.name}.` : ""}
      </p>
      {error ? (
        <p id={`${id}-error`} className="font-mono text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The foot of a content form: who saved first when the edit was stale, why a
 * save was refused or failed, the saved line, and "Save" (the form's submit)
 * and "Save & add next".
 */
export function SaveFooter({
  what,
  form,
  onNext,
}: {
  /** What the conflict says was saved: "this card". */
  what: string;
  form: Pick<ReturnType<typeof useContentSave>, "conflict" | "message" | "savedLine" | "pending">;
  onNext: () => void;
}) {
  const { conflict, message, savedLine, pending } = form;
  return (
    <>
      {conflict ? <ConflictNotice {...conflict} what={what} /> : null}
      {message ? (
        <p role="alert" className="font-mono text-[11px] font-bold text-destructive">
          {message}
        </p>
      ) : null}
      <p role="status" className="font-mono text-[11px] font-bold text-ayc-blue">
        {savedLine}
      </p>
      <SaveButtons pending={pending} onNext={onNext} />
    </>
  );
}

/** "Save" (the form's submit) and "Save & add next". */
function SaveButtons({ pending, onNext }: { pending: boolean; onNext: () => void }) {
  return (
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
        onClick={onNext}
        className={`${BUTTON} bg-ayc-paper`}
      >
        Save &amp; add next
      </button>
    </div>
  );
}
