import type { ReactNode } from "react";

import { SaveState, type SaveStatus } from "./save-state";

interface EditorSaveRowProps {
  /** Save's label, e.g. "Save review" or "Add review". */
  saveLabel: string;
  /** The save-state line after a save, e.g. "✓ SAVED · LIVE ON THE SITE". */
  savedMessage: string;
  /** The editor's form state, from useAdminForm. */
  form: { status: SaveStatus; errorMessage?: string; canSave: boolean };
  /** Shown at the end of the row: Delete. */
  extra?: ReactNode;
}

/** An editor's Save, its save-state line, and Delete (mockup 223–227, 274, 308). */
export function EditorSaveRow({ saveLabel, savedMessage, form, extra }: EditorSaveRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t-[1.5px] pt-3.5">
      <button
        type="submit"
        disabled={!form.canSave}
        className="min-h-10.5 cursor-pointer border-[1.5px] bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-wait"
      >
        {saveLabel}
      </button>
      <div className="min-w-0 flex-1">
        <SaveState
          status={form.status}
          savedMessage={savedMessage}
          errorMessage={form.errorMessage}
        />
      </div>
      {extra}
    </div>
  );
}
