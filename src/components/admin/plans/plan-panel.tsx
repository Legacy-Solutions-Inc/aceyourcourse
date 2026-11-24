"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { plansHref } from "@/lib/admin/plan-view";
import type { AdminPlan, AdminPlans } from "@/services/admin.types";

import { EditPlan, NewPlan, type PlanEditorActions } from "./plan-editor";

interface PlanPanelProps {
  /** The selected Plan's id, "new", or null. */
  selected: string | null;
  /** The selected Plan, or null when there's no such Plan. */
  opened: AdminPlan | null;
  exams: AdminPlans["exams"];
  /** The Exam chip picked, or null for ALL. */
  examChip: string | null;
  actions: PlanEditorActions;
}

/**
 * The right-hand panel (mockup 608–645): the selected Plan's editor, a new
 * Plan's, or a prompt to pick one. A new Plan starts on the chip's Exam, or
 * the first one; once added, it opens in its own editor at its own address,
 * still saying "✓ SAVED".
 */
export function PlanPanel({ selected, opened, exams, examChip, actions }: PlanPanelProps) {
  const router = useRouter();
  const [added, setAdded] = useState<AdminPlan | null>(null);
  // "✓ SAVED" is for the editor the new Plan opens in; another selection forgets it.
  if (added && selected !== "new" && selected !== added.id) setAdded(null);

  const firstExam = exams.find(({ code }) => code === examChip)?.code ?? exams[0]?.code;

  let body: React.ReactNode;
  if (selected === "new" && firstExam) {
    body = (
      <NewPlan
        exams={exams}
        examCode={firstExam}
        actions={actions}
        onAdded={(plan) => {
          setAdded(plan);
          router.replace(plansHref({ exam: examChip, plan: plan.id }), { scroll: false });
        }}
      />
    );
  } else if (opened) {
    body = (
      <EditPlan
        key={opened.id}
        opened={opened}
        exams={exams}
        examChip={examChip}
        actions={actions}
        savedOnOpen={added?.id === opened.id ? added : undefined}
      />
    );
  } else if (selected && selected !== "new") {
    body = (
      <>
        <p className="font-bold">That plan isn’t here any more.</p>
        <p className="text-sm text-muted-foreground">
          Someone may have deleted it. Pick another from the list.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <p className="font-bold">Select a plan</p>
        <p className="text-sm text-muted-foreground">
          {exams.length > 0
            ? "Pick one from the list to edit it, or add a new one with + New plan."
            : "Add an Exam in Pages & promo first: every Plan is for one Exam."}
        </p>
      </>
    );
  }

  return (
    <aside
      aria-label="Plan editor"
      className="flex min-w-0 flex-col gap-3 border-[1.5px] bg-ayc-paper p-4"
    >
      {body}
    </aside>
  );
}
