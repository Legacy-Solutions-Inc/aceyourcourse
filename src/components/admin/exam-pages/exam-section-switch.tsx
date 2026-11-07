"use client";

import { useOptimistic } from "react";

import { AdminSwitch } from "@/components/admin/admin-switch";
import { useInstantSave } from "@/components/admin/use-instant-save";
import type { AdminAction } from "@/lib/admin/action";
import type { AdminExamPage } from "@/services/admin.types";
import type { ExamPageSection } from "@/services/catalogue.types";

interface ExamSectionSwitchProps {
  examCode: string;
  section: ExamPageSection;
  /** Whether the section shows, as the server last read it. */
  on: boolean;
  /** The section's name, for the "Couldn't save" toast. */
  title: string;
  action: AdminAction<AdminExamPage>;
  "aria-label": string;
}

/**
 * A section's show-or-hide switch (mockup 99): it flips at once and saves
 * with no conflict check (useInstantSave). A failed save switches back and
 * shows the "Couldn't save" toast.
 */
export function ExamSectionSwitch({
  examCode,
  section,
  on,
  title,
  action,
  ...names
}: ExamSectionSwitchProps) {
  const [shown, show] = useOptimistic(on);
  const { save, pending } = useInstantSave(action, {
    what: title,
    kept: "The switch is back as it was.",
    refused: (error) =>
      error.kind === "not-found"
        ? "That Exam is no longer in the catalogue, so nothing was changed."
        : "The section wasn’t changed. Reload the page and try again.",
  });

  return (
    <AdminSwitch
      checked={shown}
      onCheckedChange={(next) => save({ code: examCode, section, on: next }, () => show(next))}
      aria-busy={pending || undefined}
      {...names}
    />
  );
}
