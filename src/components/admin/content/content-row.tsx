"use client";

import Link from "next/link";
import { type ReactNode, useRef } from "react";

import { callAdminAction } from "@/components/admin/call-admin-action";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { MoveButtons } from "@/components/admin/move-buttons";
import type { AdminAction } from "@/lib/admin/action";
import { cn } from "@/lib/utils";

const TEXT_BUTTON =
  "min-h-6 cursor-pointer text-[13px] font-semibold underline-offset-2 hover:underline";

interface ContentRowProps<Deleted> {
  id: string;
  /** "card" or "question": every label names it, as "Delete question 2". */
  noun: "card" | "question";
  position: number;
  /** Its text, as typed: the edit link's and the confirmation's name for it. */
  text: string;
  /** How the row shows its text: as typed, or with its maths rendered. */
  children: ReactNode;
  /** Where Edit opens it in the form. */
  href: string;
  first: boolean;
  last: boolean;
  /** Whether it's the one open in the form. */
  current: boolean;
  move: AdminAction<string[]>;
  remove: AdminAction<Deleted>;
  /** What deleting it does for Members, said in the confirmation. */
  deleteWarning: string;
  onDeleted: (deleted: Deleted) => void;
}

/**
 * One row of a deck's cards or a quiz's questions (tickets 07 and 10): its
 * place and text, opening it in the form, with ▲▼ and Delete, which asks
 * first and says what it does for Members.
 */
export function ContentRow<Deleted>({
  id,
  noun,
  position,
  text,
  children,
  href,
  first,
  last,
  current,
  move,
  remove,
  deleteWarning,
  onDeleted,
}: ContentRowProps<Deleted>) {
  const name = `${noun} ${position}`;
  // The delete's answer, which says whether the deck or quiz was hidden with it.
  const answer = useRef<Deleted | null>(null);
  return (
    <li
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ayc-ruled px-2 py-2.5 last:border-b-0",
        current && "bg-ayc-sand",
      )}
    >
      <span className="font-mono text-xs font-bold text-ayc-blue">
        {String(position).padStart(2, "0")}
      </span>
      <Link
        href={href}
        aria-label={`Edit ${name}: ${text}`}
        className="min-w-0 flex-[1_1_180px] text-sm font-semibold wrap-anywhere hover:underline"
      >
        {children}
      </Link>
      <MoveButtons
        id={id}
        labels={{ up: `Move up: ${name}`, down: `Move down: ${name}` }}
        first={first}
        last={last}
        disabledReason={null}
        action={move}
        what={`The ${noun} order`}
        gone={`That ${noun} is gone. Reload the page.`}
      />
      <ConfirmDelete
        label="Delete"
        ariaLabel={`Delete ${name}`}
        buttonClassName={`${TEXT_BUTTON} text-destructive`}
        tag={`DELETE ${noun.toUpperCase()}`}
        title={`Delete ${name}, “${text}”?`}
        description={deleteWarning}
        confirmLabel={`Delete ${noun}`}
        send={async () => {
          const state = await callAdminAction(remove, { input: { id } });
          if (state.status === "saved") answer.current = state.value;
          return state;
        }}
        onDeleted={() => {
          if (answer.current) onDeleted(answer.current);
        }}
      />
    </li>
  );
}
