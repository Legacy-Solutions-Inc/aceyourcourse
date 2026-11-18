"use client";

import { type FormEvent, useRef, useState } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { CardFace } from "@/components/flashcards/card-face";
import type { AdminAction } from "@/lib/admin/action";
import { type CardField, cardFieldProblems } from "@/lib/cards/card-fields";
import { CARD_TEXT_LIMITS } from "@/lib/cards/card-rules";
import { renderFormula } from "@/lib/formula/render";
import type { AdminCard } from "@/services/admin.types";
import type { ContentUploadTicket } from "@/services/uploads.types";

import {
  FormulaTextField,
  ImageField,
  SaveFooter,
  useContentSave,
  useImageUpload,
} from "./content-form-parts";

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

const LABELS: Record<CardField, { label: string; hint: string; mono?: boolean }> = {
  front: { label: "FRONT · THE PROMPT", hint: "e.g. Tangent distance" },
  back: { label: "BACK · THE ANSWER OR FORMULA", hint: "e.g. $T = R \\tan(I/2)$", mono: true },
  note: { label: "NOTE · OPTIONAL", hint: "Units, conditions, or a memory tip" },
};

const GONE = "THAT CARD OR TOPIC IS GONE · RELOAD THE PAGE";
const FIELDS = ["front", "back", "note", "image"] as const;

/** One of the card's text fields, with its label, hint and limit. */
function CardTextField({
  field,
  ...props
}: {
  field: CardField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const { label, hint, mono } = LABELS[field];
  return (
    <FormulaTextField
      name={field}
      label={label}
      hint={hint}
      mono={mono}
      limit={CARD_TEXT_LIMITS[field]}
      rows={field === "front" ? 2 : 3}
      {...props}
    />
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
  const form = useContentSave<AdminCard, CardField | "image">({
    noun: "CARD",
    gone: GONE,
    fields: FIELDS,
    opened: card?.stamp,
  });
  const { errors, setErrors } = form;
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const { image, setImage, choose, upload, shownSrc } = useImageUpload(
    card?.image ?? null,
    actions.createCardImageUpload,
    (message) =>
      setErrors(({ image: _, ...rest }) => (message ? { ...rest, image: message } : rest)),
  );
  const previewProblems = (["front", "back", "note"] as const).flatMap((field) => {
    const rendered = renderFormula({ front, back, note }[field]);
    return rendered.ok ? [] : [`The ${field} ${rendered.problem}`];
  });

  function save(next: boolean) {
    form.save({
      next,
      problems: cardFieldProblems({ front, back, note }),
      send: async (expected) => {
        const uploaded = await upload();
        if (!uploaded.ok) return null;
        const fields = { front, back, note, image: uploaded.path };
        return card
          ? callAdminAction(actions.saveCard, { input: { id: card.id, ...fields }, expected })
          : callAdminAction(actions.addCard, { input: { topic: topicId, ...fields } });
      },
      onSaved: (saved) => {
        if (next) {
          setFront("");
          setBack("");
          setNote("");
          setImage({ kind: "none" });
          frontRef.current?.focus();
        } else {
          setImage(saved.image ? { kind: "saved", path: saved.image } : { kind: "none" });
        }
        onSaved(saved, next);
      },
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

      <ImageField
        id={`${topicId}-card-image`}
        legend="IMAGE ON THE BACK · OPTIONAL"
        noun="image"
        hint="Members see it on the back."
        image={image}
        error={errors.image}
        onChoose={choose}
        onRemove={() => setImage({ kind: "none" })}
      />

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
            imageSrc={shownSrc(imageSrc)}
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

      <SaveFooter what="this card" form={form} onNext={() => save(true)} />
    </form>
  );
}
