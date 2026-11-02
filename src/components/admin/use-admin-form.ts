"use client";

import {
  type ChangeEvent,
  type FormEvent,
  startTransition,
  useActionState,
  useRef,
  useState,
} from "react";

import type { AdminAction, AdminActionState } from "@/lib/admin/action";
import { type FormValues, sameValues, valueAt, withValueAt } from "@/lib/admin/form-values";
import type { AdminError } from "@/services/admin.types";

import { callAdminAction } from "./call-admin-action";
import { showSaveFailedToast } from "./save-failed-toast";
import type { SaveStatus } from "./save-state";

// ─────────────────────────────────────────────────────────────────────────────
// The save path every Admin editor shares (CONVENTIONS §3). The form's values
// live in state, so nothing the browser does to a submitted form can lose
// them: a refused or failed save leaves every edit in place. A save sends the
// values with the stamp the record had when the form opened (the conflict
// check) to an adminAction, then reports the save state, each field's
// message, the conflict, or the "Couldn't save" toast.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminFormOptions<Values extends FormValues, Saved> {
  /** The form's Server Action, built with adminAction. */
  action: AdminAction<Saved>;
  /** The values the form opens with. */
  initialValues: Values;
  /** The record's stamp when the form opened, or as its last save left it. */
  savedAt: string;
  /** The form's values as a save left them, from what the seam returned. */
  valuesFrom: (saved: Saved) => Values;
  /** Called after each save, e.g. to pass the new stamp to the screen's other forms. */
  onSaved?: (saved: Saved) => void;
  /**
   * For forms that share one record's stamp: true while any of them is saving,
   * when this one waits, and told when this one starts and finishes a save. A
   * save sent before another's new stamp is back would conflict with it.
   */
  busy?: boolean;
  onSaving?: (saving: boolean) => void;
  /**
   * What a save made just before this form opened, so it opens saying
   * "✓ SAVED": a new record's editor, opened once it was added.
   */
  savedOnOpen?: Saved;
  /** The form's name, for the "Couldn't save" toast. */
  title: string;
  /** The save-state line for a refused input, e.g. "FIX THE LINKS MARKED IN RED". */
  invalidMessage: string;
}

const IDLE = { status: "idle" } as const;
const FAILED_LINE = "COULDN’T SAVE · YOUR EDITS ARE STILL IN THE FORM";

/** Pure: the save-state line for a save that didn't go through. */
function errorLine(state: AdminActionState<unknown>, invalidMessage: string): string {
  if (state.status !== "refused") return FAILED_LINE;
  const { error } = state;
  switch (error.kind) {
    case "invalid":
      return error.formError ?? invalidMessage;
    case "conflict":
      return "NOT SAVED";
    case "forbidden":
      return error.message;
    case "not-found":
      return "NOT SAVED · IT’S NO LONGER THERE. RELOAD THE PAGE";
  }
}

export function useAdminForm<Values extends FormValues, Saved>({
  action,
  initialValues,
  savedAt,
  valuesFrom,
  onSaved,
  busy = false,
  onSaving,
  savedOnOpen,
  title,
  invalidMessage,
}: AdminFormOptions<Values, Saved>) {
  const [values, setValues] = useState(initialValues);
  const [lastSaved, setLastSaved] = useState(initialValues);
  // The fields edited since the last answer: their messages are out of date.
  const [edited, setEdited] = useState<ReadonlySet<string>>(() => new Set());
  const formRef = useRef<HTMLFormElement>(null);

  const [state, dispatch, pending] = useActionState(
    async (
      previous: AdminActionState<Saved>,
      submitted: { input: Values; expected: { savedAt: string } },
    ): Promise<AdminActionState<Saved>> => {
      let next: AdminActionState<Saved>;
      try {
        next = await callAdminAction(action, submitted, previous);
      } finally {
        onSaving?.(false);
      }

      if (next.status === "saved") {
        const saved = valuesFrom(next.value);
        setLastSaved(saved);
        // Edits typed while the save was on its way stay in the form.
        setValues((current) => (sameValues(current, submitted.input) ? saved : current));
        onSaved?.(next.value);
      } else if (next.status === "failed") {
        showSaveFailedToast({ what: title, onRetry: () => formRef.current?.requestSubmit() });
      }
      return next;
    },
    savedOnOpen === undefined ? IDLE : { status: "saved", value: savedOnOpen },
  );

  const dirty = !sameValues(values, lastSaved);
  const answered = edited.size === 0;
  const refusal: AdminError | null = state.status === "refused" ? state.error : null;

  let status: SaveStatus;
  if (pending) status = "saving";
  else if (answered && (state.status === "refused" || state.status === "failed")) status = "error";
  else if (dirty) status = "unsaved";
  else if (answered && state.status === "saved") status = "saved";
  else status = "up-to-date";

  function change(path: string, value: unknown) {
    setValues((current) => withValueAt(current, path, value));
    setEdited((current) => new Set(current).add(path));
  }

  return {
    values,
    status,
    errorMessage: status === "error" ? errorLine(state, invalidMessage) : undefined,
    /** The newer save that refused this one, while the form shows it. */
    conflict: refusal?.kind === "conflict" ? refusal : null,
    pending,
    /** Whether Save can be pressed: not while this form, or one it shares a stamp with, is saving. */
    canSave: !pending && !busy,
    change,
    /**
     * The field's message from the last save, until the field, or a list it's
     * in ("variations" for "variations.1.price"), is edited.
     */
    fieldError(path: string): string | undefined {
      if (refusal?.kind !== "invalid") return undefined;
      const keys = path.split(".");
      if (keys.some((_, end) => edited.has(keys.slice(0, end + 1).join(".")))) return undefined;
      return refusal.fieldErrors[path]?.[0];
    },
    /** A text input's value and change handler, for the field at `path`. */
    text(path: string) {
      const value = valueAt(values, path);
      return {
        name: path,
        value: typeof value === "string" ? value : "",
        onChange: (event: ChangeEvent<HTMLInputElement>) => change(path, event.target.value),
      };
    },
    /** Spread onto the <form>. */
    formProps: {
      ref: formRef,
      noValidate: true,
      onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending || busy) return;
        onSaving?.(true);
        setEdited(new Set());
        const submission = { input: values, expected: { savedAt } };
        startTransition(() => dispatch(submission));
      },
    },
  };
}
