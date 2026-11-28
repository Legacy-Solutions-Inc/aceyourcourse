import Image from "next/image";
import Link from "next/link";

import {
  type CourseCardView,
  type CourseGroup,
  emptyShelfMessage,
  leadsToPlans,
} from "@/lib/member-app/courses-view";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import { cn } from "@/lib/utils";
import { paths } from "@/paths";

import { BetaAccessNote, PlansLink } from "./content-state";

/** A Course's 16:9 cover, or its Subject block when it has none. */
export function CourseCover({
  coverSrc,
  subjectCode,
  className,
}: {
  coverSrc: string | null;
  subjectCode: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex aspect-video w-full items-center justify-center overflow-hidden border-[1.5px] bg-ayc-blue font-mono text-lg font-bold tracking-[0.06em] text-white",
        className,
      )}
    >
      {coverSrc ? (
        <Image src={coverSrc} alt="" fill unoptimized className="object-cover" />
      ) : (
        subjectCode
      )}
    </span>
  );
}

/**
 * A card's way in: "Start course", the orange way to Plans ("See plans",
 * "Renew access", "Unlock for ₱1,499"), or plain text with nowhere to go
 * ("Not on sale right now").
 */
export function CourseAction({
  card,
}: {
  card: Pick<CourseCardView, "action" | "locked" | "note">;
}) {
  const { action, locked, note } = card;
  return (
    <div className="flex flex-col items-start gap-1">
      {action.href === null ? (
        <p className="flex min-h-11 items-center border-[1.5px] border-dashed border-ayc-slate px-4 text-sm font-bold text-ayc-slate">
          {action.label}
        </p>
      ) : locked ? (
        <PlansLink href={action.href}>{action.label}</PlansLink>
      ) : (
        <Link
          href={action.href}
          className="flex min-h-11 items-center border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          {action.label}
        </Link>
      )}
      {note ? (
        <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** One Course on the Courses screen: its cover, tag, title, counts and way in. */
function CourseCard({ card }: { card: CourseCardView }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 border-[1.5px] bg-ayc-paper p-4",
        card.locked ? "border-dashed border-ayc-slate" : "shadow-hard-sm",
      )}
    >
      <CourseCover coverSrc={card.coverSrc} subjectCode={card.subjectCode} />
      <p
        className={cn(
          "font-mono text-[11px] font-bold tracking-[0.06em]",
          card.locked ? "text-destructive" : "text-ayc-blue",
        )}
      >
        {card.locked ? `🔒 ${card.tag}` : card.tag}
      </p>
      <h3 className="text-lg leading-tight font-extrabold">
        <Link href={card.href} className="underline-offset-2 hover:underline">
          {card.title}
        </Link>
      </h3>
      <p className="font-mono text-xs text-muted-foreground">{card.meta}</p>
      {card.progress ? (
        <p className="font-mono text-xs font-bold">
          {card.progress}
          <span className="sr-only"> lessons done</span>
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2.5">
        <CourseAction card={card} />
        {card.free ? (
          <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-ayc-blue">
            {card.free.label} ·{" "}
            <Link
              href={card.free.href}
              className="font-sans text-[13px] tracking-normal underline underline-offset-2"
            >
              Watch free
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}

interface CoursesShelfProps {
  examCode: string;
  /** The cards grouped by Subject, in the Exam's order; none when it has no Courses to show. */
  groups: readonly CourseGroup[];
  unlock: UnlockRoute;
}

/**
 * The Courses screen's body (mockup `courses`; spec, Phase 5 planning
 * decisions → The Courses screen): the selected Exam's Courses as cards,
 * grouped by Subject, each with its state and its way in; or, with none to
 * show, that they're on the way. While the Exam has no Plan on sale, a lock
 * points at the "contact us" note below.
 */
export function CoursesShelf({ examCode, groups, unlock }: CoursesShelfProps) {
  if (groups.length === 0) {
    return (
      <div className="flex max-w-xl flex-col gap-3 border-[1.5px] border-dashed border-ayc-slate p-5">
        <p className="text-[15px] leading-normal">{emptyShelfMessage(examCode)}</p>
        <Link
          href={paths.memberApp.library}
          className="flex min-h-11 items-center self-start border-[1.5px] bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Open the Library
        </Link>
      </div>
    );
  }
  const needsContact =
    unlock.kind === "contact" &&
    groups.some((group) => group.cards.some((card) => leadsToPlans(card.state)));
  return (
    <>
      {groups.map(({ subject, cards }) => (
        <section
          key={subject.code}
          aria-labelledby={`courses-${subject.code}`}
          className="flex flex-col gap-3"
        >
          <h2 id={`courses-${subject.code}`} className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-sm font-bold text-ayc-blue">{subject.code}</span>
            <span className="text-[15px] font-semibold text-muted-foreground">{subject.name}</span>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id}>
                <CourseCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {needsContact && unlock.kind === "contact" ? (
        <p
          id="unlock"
          className="max-w-xl scroll-mt-6 border-[1.5px] border-ayc-blue bg-ayc-paper p-4 text-[15px] leading-normal"
        >
          {examCode} All-Access opens its included Courses.{" "}
          <BetaAccessNote contactEmail={unlock.contactEmail} />
        </p>
      ) : null}
    </>
  );
}
