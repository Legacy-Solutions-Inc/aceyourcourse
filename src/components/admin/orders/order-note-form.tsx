"use client";

import { useState } from "react";

import { ConflictNotice } from "@/components/admin/conflict-notice";
import { EditorSaveRow } from "@/components/admin/editor-save-row";
import { TextField } from "@/components/admin/products/product-fields";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminAction } from "@/lib/admin/action";
import type { AdminOrderNote } from "@/services/admin.types";

interface OrderNoteFormProps {
  note: AdminOrderNote;
  action: AdminAction<AdminOrderNote>;
}

/**
 * INTERNAL NOTE on an Order's detail page (mockup 772–773; story 148): only
 * Staff see it. "Save note" sends it with the stamp it opened with, so a note
 * someone else saved since is never overwritten (the conflict check).
 */
export function OrderNoteForm({ note, action }: OrderNoteFormProps) {
  // The note's stamp as this form's last save left it.
  const [savedAt, setSavedAt] = useState(note.stamp.savedAt);
  const form = useAdminForm<{ reference: string; note: string }, AdminOrderNote>({
    action,
    initialValues: { reference: note.reference, note: note.text },
    savedAt,
    valuesFrom: (saved) => ({ reference: saved.reference, note: saved.text }),
    onSaved: (saved) => setSavedAt(saved.stamp.savedAt),
    title: `the note on ${note.reference}`,
    invalidMessage: "FIX THE NOTE MARKED IN RED",
  });

  return (
    <form {...form.formProps} aria-label="Internal note" className="flex flex-col gap-2.5">
      {form.conflict ? <ConflictNotice {...form.conflict} what="this note" /> : null}
      <TextField
        label="INTERNAL NOTE"
        multiline
        value={form.values.note}
        onChange={(value) => form.change("note", value)}
        error={form.fieldError("note")}
        placeholder="e.g. Member emailed 25 Nov about this. Told them to wait for Maya."
      />
      <EditorSaveRow
        saveLabel="Save note"
        savedMessage="✓ NOTE SAVED · ONLY ADMINS SEE IT"
        form={form}
      />
    </form>
  );
}
