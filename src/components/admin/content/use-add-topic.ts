"use client";

import { type FormEvent, useState, useTransition } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import type { AdminError, AdminTopic } from "@/services/admin.types";

// Adding a Topic to a Subject (Phase 3, ticket 05; spec, Phase 3 planning
// decisions → Topics editor), as the Topics list's "+ Add topic" and a
// Reviewer PDF's "+ New topic" (ticket 13) both do: the name typed, sent to
// the Topics editor's addTopic, and the name field's message, or what else
// the refusal says, shown in the field. The server enforces every rule (a
// name unique within its Subject, ignoring case).

/** What a refused or failed Topic save says, apart from the name field's own message and a conflict. */
export function refusalText(state: AdminActionState<unknown>): string {
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

/** The name field's own message, from a refused Topic save. */
export const nameError = (state: AdminActionState<unknown>) =>
  state.status === "refused" && state.error.kind === "invalid"
    ? state.error.fieldErrors.name?.[0]
    : undefined;

/**
 * A new Topic's name field and its submit: adds a Topic named as typed to the
 * Subject, then empties the field and calls `onAdded` with it.
 */
export function useAddTopic(
  action: AdminAction<AdminTopic>,
  subject: { exam: string; subject: string },
  onAdded: (topic: AdminTopic) => void,
) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(undefined);
    startTransition(async () => {
      const state = await callAdminAction(action, { input: { ...subject, name } });
      if (state.status === "saved") {
        setName("");
        onAdded(state.value);
      } else {
        setError(nameError(state) ?? refusalText(state));
      }
    });
  }

  return { name, setName, error, pending, submit };
}
