"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { MOVE_BUTTON } from "@/components/admin/move-buttons";
import { CountedField, TextField, ToggleRow } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import { announcementFormValues, newAnnouncementMessage } from "@/lib/admin/promo-form";
import { ANNOUNCEMENT_MESSAGES_MAX, ANNOUNCEMENT_TEXT_MAX } from "@/services/admin.schema";
import type { AdminAnnouncement } from "@/services/admin.types";

import { INVALID, InfoNote } from "./exam-page-editors";

// ─────────────────────────────────────────────────────────────────────────────
// The announcement bar (spec, Phase 2 → Exam pages & promo; story 76; not in
// the mockup, so it's built in the banner editor's style): 1–3 messages, each
// with its text, link and "Only while the Member App is live", in the order
// the bar rotates through them. ▲▼, "+ Add message" and Remove change the
// form; Save makes them live on every page. Changed messages show the bar
// again to Visitors who dismissed it.
// ─────────────────────────────────────────────────────────────────────────────

const SAVED = "✓ SAVED · LIVE ON EVERY PAGE";

const SMALL_BUTTON =
  "min-h-6 cursor-pointer text-[13px] font-semibold hover:underline disabled:cursor-not-allowed disabled:text-ayc-rule disabled:no-underline";

type Message = ReturnType<typeof newAnnouncementMessage>;

interface AnnouncementEditorProps {
  opened: AdminAnnouncement;
  action: AdminAction<AdminAnnouncement>;
}

export function AnnouncementEditor({ opened, action }: AnnouncementEditorProps) {
  const router = useRouter();
  const [stamp, setStamp] = useState(opened.stamp);
  const form = useAdminForm({
    action,
    initialValues: announcementFormValues(opened.announcement),
    savedAt: stamp.savedAt,
    valuesFrom: (saved: AdminAnnouncement) => announcementFormValues(saved.announcement),
    onSaved: (saved) => {
      setStamp(saved.stamp);
      router.refresh();
    },
    title: "The announcement bar",
    invalidMessage: INVALID,
  });
  const messages = form.values.messages;

  // Each message's key, which moves with it, so a reordered field keeps its focus.
  const nextKey = useRef(messages.length);
  const [keys, setKeys] = useState(() => messages.map((_, index) => index));

  function setMessages(next: Message[], nextKeys: number[]) {
    form.change("messages", next);
    setKeys(nextKeys);
  }
  function move(index: number, by: -1 | 1) {
    const swap = <T,>(list: T[]) => {
      const copy = [...list];
      const [a, b] = [copy[index], copy[index + by]];
      if (a === undefined || b === undefined) return list;
      copy[index] = b;
      copy[index + by] = a;
      return copy;
    };
    setMessages(swap(messages), swap(keys));
  }
  function edit(index: number, changes: Partial<Message>) {
    setMessages(
      messages.map((message, i) => (i === index ? { ...message, ...changes } : message)),
      keys,
    );
  }
  function remove(index: number) {
    setMessages(
      messages.filter((_, i) => i !== index),
      keys.filter((_, i) => i !== index),
    );
  }
  function add() {
    setMessages([...messages, newAnnouncementMessage()], [...keys, nextKey.current++]);
  }

  const full = messages.length >= ANNOUNCEMENT_MESSAGES_MAX;
  return (
    <form aria-label="Announcement bar" className="flex flex-col gap-3.5" {...form.formProps}>
      <p className="text-[13px] text-muted-foreground">
        Strip at the top of every page · it shows one message at a time
      </p>
      <ol className="flex flex-col gap-3">
        {messages.map((message, index) => (
          <li key={keys[index]}>
            <MessageFields
              message={message}
              index={index}
              count={messages.length}
              errors={{
                text: form.fieldError(`messages.${index}.text`),
                href: form.fieldError(`messages.${index}.href`),
              }}
              onEdit={(changes) => edit(index, changes)}
              onMove={(by) => move(index, by)}
              onRemove={() => remove(index)}
            />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <button
          type="button"
          onClick={add}
          disabled={full}
          className={`${SMALL_BUTTON} text-ayc-blue`}
        >
          + Add message
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {messages.length} OF {ANNOUNCEMENT_MESSAGES_MAX} MESSAGES
        </span>
      </div>
      <InfoNote>
        Saving changed messages shows the bar again to Visitors who closed it.
        {opened.memberAppLive
          ? null
          : " The Member App isn’t live yet, so messages only for it don’t show."}
      </InfoNote>
      {form.conflict ? <ConflictNotice {...form.conflict} what="the announcement bar" /> : null}
      <EditorSaveRow saveLabel="Save" savedMessage={SAVED} form={form} />
    </form>
  );
}

interface MessageFieldsProps {
  message: Message;
  index: number;
  count: number;
  errors: { text?: string; href?: string };
  onEdit: (changes: Partial<Message>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

/** One message: MESSAGE n with ▲▼ and Remove, its TEXT, LINK and Member App switch. */
function MessageFields({
  message,
  index,
  count,
  errors,
  onEdit,
  onMove,
  onRemove,
}: MessageFieldsProps) {
  const name = `message ${index + 1}`;
  const heading = useId();
  return (
    <div
      role="group"
      aria-labelledby={heading}
      className="flex flex-col gap-3 border-[1.5px] bg-white/60 p-3.5"
    >
      <div className="flex items-center justify-between gap-2.5">
        <h3
          id={heading}
          className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
        >
          MESSAGE {index + 1}
        </h3>
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1">
            <button
              type="button"
              aria-label={`Move ${name} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
              className={MOVE_BUTTON}
            >
              <span aria-hidden="true">▲</span>
            </button>
            <button
              type="button"
              aria-label={`Move ${name} down`}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
              className={MOVE_BUTTON}
            >
              <span aria-hidden="true">▼</span>
            </button>
          </span>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            title={count === 1 ? "The bar needs at least one message" : undefined}
            disabled={count === 1}
            onClick={onRemove}
            className={`${SMALL_BUTTON} text-destructive`}
          >
            Remove
          </button>
        </div>
      </div>
      <CountedField
        label="TEXT"
        max={ANNOUNCEMENT_TEXT_MAX}
        placeholder="Like “Ships from Iloilo City · SPayLater 0% on Shopee”"
        value={message.text}
        onChange={(text) => onEdit({ text })}
        error={errors.text}
      />
      <TextField
        label="LINK"
        inputMode="url"
        placeholder="/products or https://…"
        value={message.href}
        onChange={(href) => onEdit({ href })}
        error={errors.href}
      />
      <ToggleRow
        label="Only while the Member App is live"
        hint="For messages about the app, its plans or its prices"
      >
        {(ids) => (
          <AdminSwitch
            checked={message.requiresMemberApp}
            onCheckedChange={(requiresMemberApp) => onEdit({ requiresMemberApp })}
            {...ids}
          />
        )}
      </ToggleRow>
    </div>
  );
}
