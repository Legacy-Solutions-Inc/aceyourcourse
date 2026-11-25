import Link from "next/link";

import { cn } from "@/lib/utils";

import { BetaAccessNote } from "./content-state";
import { type PayAction, PlanChooser } from "./plan-chooser";
import type { PlanRowView } from "./plans-view";

/** One Exam pill: an Exam with a Plan on sale, linking to its Plans. */
export interface PlanPill {
  code: string;
  name: string;
  href: string;
  /** Whether it's the Exam the page is open on. */
  current: boolean;
}

export interface PlansProps {
  /** The Exams with a Plan on sale, the Member's Target Exams first. Empty when nothing is on sale. */
  pills: readonly PlanPill[];
  /** The Exam the page is open on and its Plan rows, or null when nothing is on sale. */
  exam: { code: string; rows: readonly PlanRowView[] } | null;
  /** Active Staff open all content already, and are told so. */
  staff: boolean;
  /** Where Members ask AYC for access, while nothing is on sale. */
  contactEmail: string;
  /** Pay, where this server has a payments client; null where buying isn't set up. */
  pay: PayAction | null;
}

/**
 * The Plans page's body (mockup L412–450; BUILD-MAP §3 Plans; stories 134,
 * 151c and 151m): what a Plan is, a pill per Exam with a Plan on sale, and
 * the open Exam's Plans with the order summary. Staff can buy too, and are
 * told they open all content already.
 */
export function Plans({ pills, exam, staff, contactEmail, pay }: PlansProps) {
  return (
    <>
      <p className="text-[15px]">Pay once for a fixed period. Nothing renews automatically.</p>
      {staff ? (
        <p
          role="note"
          className="max-w-xl border-[1.5px] border-ayc-blue bg-ayc-paper px-4 py-3 text-[15px] font-semibold"
        >
          As Staff you already open all content.
        </p>
      ) : null}
      {pills.length > 0 ? (
        <nav aria-label="Exams" className="flex flex-wrap gap-1.5">
          {pills.map((pill) => (
            <Link
              key={pill.code}
              href={pill.href}
              aria-current={pill.current ? "page" : undefined}
              title={pill.name}
              className={cn(
                "flex min-h-10 items-center border-[1.5px] border-ayc-navy px-3.5 font-mono text-[13px] font-bold",
                pill.current ? "bg-primary text-primary-foreground" : "bg-transparent",
              )}
            >
              {pill.code}
              <span className="sr-only"> · {pill.name}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {exam ? (
        <PlanChooser key={exam.code} examCode={exam.code} rows={exam.rows} pay={pay} />
      ) : (
        <p className="max-w-prose text-[15px] leading-normal">
          No plans are on sale right now. <BetaAccessNote contactEmail={contactEmail} />
        </p>
      )}
    </>
  );
}
