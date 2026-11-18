"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { AdminTextField } from "@/components/admin/admin-text-field";
import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConflictNotice } from "@/components/admin/conflict-notice";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { MoveButtons } from "@/components/admin/move-buttons";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { topicContentLabels } from "@/lib/admin/topics-view";
import { paths } from "@/paths";
import type { AdminError, AdminTopic, AdminTopicList } from "@/services/admin.types";
import type { Topic } from "@/services/content.types";

export interface TopicsEditorActions {
  addTopic: AdminAction<AdminTopic>;
  saveTopicName: AdminAction<AdminTopic>;
  moveTopicInSubject: AdminAction<string[]>;
  removeTopic: AdminAction<Topic>;
}

interface TopicsEditorProps {
  /** The Subject's Topics list, read on the server for this render. */
  list: AdminTopicList;
  actions: TopicsEditorActions;
}

/** What a refused or failed save says, apart from the name field's own message and a conflict. */
function refusalText(state: AdminActionState<unknown>): string {
  if (state.status === "failed") return "COULDN’T SAVE · CHECK YOUR CONNECTION AND TRY AGAIN";
  if (state.status !== "refused") return "";
  const error: AdminError = state.error;
  switch (error.kind) {
    case "invalid":
      return error.formError ?? "NOT SAVED · CHECK THE NAME";
    case "forbidden":
      return error.message;
    case "not-found":
      return "THAT TOPIC OR SUBJECT IS GONE · RELOAD THE PAGE";
    case "conflict":
      return "NOT SAVED · RELOAD THE PAGE AND TRY AGAIN";
  }
}

const nameError = (state: AdminActionState<unknown>) =>
  state.status === "refused" && state.error.kind === "invalid"
    ? state.error.fieldErrors.name?.[0]
    : undefined;

const BUTTON =
  "min-h-9 cursor-pointer border-[1.5px] px-3 text-[13px] font-bold disabled:cursor-wait";
const TEXT_BUTTON =
  "min-h-6 cursor-pointer text-[13px] font-semibold text-ayc-blue underline-offset-2 hover:underline";

/** One Topic's row: its place, name and content, with Rename, ▲▼ and Delete. */
function TopicRow({
  topic,
  first,
  last,
  subject,
  actions,
}: {
  topic: AdminTopic;
  first: boolean;
  last: boolean;
  subject: string;
  actions: TopicsEditorActions;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(topic.name);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState<{ savedBy: string | null; savedAt: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(actions.saveTopicName, {
        input: { id: topic.id, name },
        expected: { savedAt: topic.stamp.savedAt },
      });
      if (state.status === "saved") {
        setRenaming(false);
        toast(`✓ RENAMED · ${state.value.name.toUpperCase()}`);
        router.refresh();
      } else if (state.status === "refused" && state.error.kind === "conflict") {
        setConflict(state.error);
      } else {
        setError(nameError(state) ?? refusalText(state));
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 border-b border-ayc-ruled py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-xs font-bold text-ayc-blue">
          {String(topic.position).padStart(2, "0")}
        </span>
        <h3 className="min-w-0 flex-[1_1_180px] text-[15px] font-bold wrap-anywhere">
          {topic.name}
        </h3>
        <MoveButtons
          id={topic.id}
          labels={{ up: `Move up: ${topic.name}`, down: `Move down: ${topic.name}` }}
          first={first}
          last={last}
          disabledReason={null}
          action={actions.moveTopicInSubject}
          what={`The ${subject} order`}
          gone="That Topic is gone. Reload the page."
        />
      </div>
      <ul aria-label={`What ${topic.name} holds`} className="flex flex-wrap gap-1">
        {topicContentLabels(topic.content).map((label) => (
          <li
            key={label}
            className="border border-ayc-rule px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.04em] text-muted-foreground"
          >
            {label}
          </li>
        ))}
      </ul>

      {renaming ? (
        <form noValidate onSubmit={rename} className="flex flex-wrap items-start gap-2">
          <AdminTextField
            label="NAME"
            name="name"
            value={name}
            error={error}
            onChange={(event) => setName(event.target.value)}
            className="flex-[1_1_240px]"
          />
          <button
            type="submit"
            disabled={pending}
            className={`${BUTTON} mt-[22px] bg-primary text-primary-foreground`}
          >
            {pending ? "Saving…" : "Save name"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRenaming(false);
              setName(topic.name);
              setError(undefined);
            }}
            className={`${BUTTON} mt-[22px] bg-ayc-paper`}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={paths.admin.deck(topic.id)}
            aria-label={`Flashcards in ${topic.name}`}
            className={TEXT_BUTTON}
          >
            Flashcards
          </Link>
          <button
            type="button"
            aria-label={`Rename ${topic.name}`}
            onClick={() => setRenaming(true)}
            className={TEXT_BUTTON}
          >
            Rename
          </button>
          {topic.deleteBlocker ? (
            <p className="text-xs leading-[1.45] text-muted-foreground">{topic.deleteBlocker}</p>
          ) : (
            <ConfirmDelete
              label="Delete"
              ariaLabel={`Delete ${topic.name}`}
              buttonClassName="min-h-6 cursor-pointer text-[13px] font-semibold text-destructive hover:underline"
              tag="DELETE TOPIC"
              title={`Delete “${topic.name}” from ${subject}?`}
              description="It’s empty, so nothing else goes with it. This can’t be undone."
              confirmLabel="Delete topic"
              send={() => callAdminAction(actions.removeTopic, { input: { id: topic.id } })}
              onDeleted={() => {
                toast(`✓ DELETED · ${topic.name.toUpperCase()}`);
                router.refresh();
              }}
            />
          )}
        </div>
      )}
      {conflict ? <ConflictNotice {...conflict} what="this Topic’s name" /> : null}
    </li>
  );
}

/**
 * A Subject's Topics list in Member App content (spec, Phase 3 planning
 * decisions → Topics editor; story 133n; BUILD-MAP §3.6): the Topics in
 * order, each with what it holds, Rename, ▲▼ and Delete (only when it's
 * empty; otherwise the reason replaces the button), then "+ Add topic". The
 * server enforces every rule and records each change in Staff Activity; this
 * screen only shows what it answered.
 */
export function TopicsEditor({ list, actions }: TopicsEditorProps) {
  const router = useRouter();
  const { exam, subject, topics } = list;
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(actions.addTopic, {
        input: { exam: exam.code, subject: subject.code, name },
      });
      if (state.status === "saved") {
        setName("");
        toast(`✓ ADDED · ${state.value.name.toUpperCase()}`);
        router.refresh();
      } else {
        setError(nameError(state) ?? refusalText(state));
      }
    });
  }

  return (
    <section
      aria-labelledby="content-topics"
      className="flex max-w-3xl min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h2
            id="content-topics"
            className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue"
          >
            {exam.code} · {subject.code} · TOPICS
          </h2>
          <p className="text-sm">{subject.name}</p>
        </div>
        <Link
          href={paths.admin.cardImport(exam.code, subject.code)}
          className={`${BUTTON} inline-flex items-center bg-ayc-paper`}
        >
          Import cards
        </Link>
      </div>

      {topics.length > 0 ? (
        <ol aria-label={`${subject.code} Topics`} className="flex flex-col">
          {topics.map((topic, index) => (
            <TopicRow
              key={`${topic.id}:${topic.name}`}
              topic={topic}
              first={index === 0}
              last={index === topics.length - 1}
              subject={subject.code}
              actions={actions}
            />
          ))}
        </ol>
      ) : (
        <p className="border border-dashed border-ayc-rule p-3.5 text-sm text-muted-foreground">
          No Topics in {subject.code} yet. Add the first one below.
        </p>
      )}

      <form noValidate onSubmit={add} className="flex flex-wrap items-start gap-2.5">
        <AdminTextField
          label="NEW TOPIC"
          name="name"
          value={name}
          error={error}
          placeholder="e.g. Simple Curves"
          onChange={(event) => setName(event.target.value)}
          className="flex-[1_1_260px]"
        />
        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON} mt-[22px] min-h-10 bg-primary px-3.5 text-primary-foreground`}
        >
          {pending ? "Saving…" : "+ Add topic"}
        </button>
      </form>
      <p className="text-[13px] leading-[1.45]">
        New Topics go last and start empty. Members see every Topic in the Library, and an empty one
        says its content is still being prepared. Renaming keeps its content and Members’ progress.
      </p>
    </section>
  );
}
