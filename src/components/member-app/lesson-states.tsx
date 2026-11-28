import Link from "next/link";

import { PassPlayer } from "@/components/video/pass-player";
import { passEndDate, type ShownRefusal } from "@/lib/member-app/access";
import { courseCard } from "@/lib/member-app/courses-view";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import { cn } from "@/lib/utils";
import type { LessonPlayer, MemberCourse } from "@/services/member.types";

import { ContactNote, PlansLink } from "./content-state";

interface LessonRefusalProps {
  /** What the access decision refused: the gate and the Active Device have their own screens. */
  decision: ShownRefusal;
  course: MemberCourse;
  /** How the Member gets the Course's Exam's All-Access: its Plans, or by asking AYC. */
  unlock: UnlockRoute;
  /** Where Back goes: the Course's page, or the Courses screen. */
  back: { href: string; label: string };
}

/** What each refusal shows: its tag, heading, text and way to unlock, if any. */
function refusalOf({ decision, course, unlock }: LessonRefusalProps): {
  tag: string;
  locked: boolean;
  heading: string;
  body: React.ReactNode;
  action: { href: string; label: string } | null;
} {
  const exam = course.examCode;
  const plansTo = (label: string) =>
    unlock.kind === "plans" ? { href: unlock.href, label } : null;
  if (decision.outcome === "unavailable") {
    return {
      tag: "NO LONGER AVAILABLE",
      locked: false,
      heading: "No longer available",
      body: "This is no longer available. Your progress is kept.",
      action: null,
    };
  }
  if (decision.outcome === "expired") {
    return {
      tag: "🔒 ACCESS ENDED",
      locked: true,
      heading: `Your ${exam} All-Access ended on ${passEndDate(decision.passEndedAt)}`,
      body: (
        <>
          Your access ended. Your progress is kept.
          <ContactNote unlock={unlock} />
        </>
      ),
      action: plansTo("Renew access"),
    };
  }
  const card = courseCard({ ...course, decision }, unlock);
  switch (card.state) {
    case "unlock":
      return {
        tag: "🔒 LOCKED",
        locked: true,
        heading: `Unlock the ${course.title}`,
        body: "It’s a one-time purchase, yours to keep. It never expires.",
        action: card.action.href ? { href: card.action.href, label: card.action.label } : null,
      };
    case "not-on-sale":
      return {
        tag: "🔒 LOCKED",
        locked: true,
        heading: `The ${course.title} isn’t on sale right now`,
        body: `It’s sold on its own, so ${exam} All-Access doesn’t include it. Check back later.`,
        action: null,
      };
    // A refusal is never an open state, and "expired" returned above: these
    // read as the Exam's All-Access lock.
    case "see-plans":
    case "renew":
    case "owned":
    case "in-plan":
    case "staff":
      return {
        tag: "🔒 LOCKED",
        locked: true,
        heading: `Unlock with ${exam} All-Access`,
        body: (
          <>
            {exam} All-Access opens the {course.title} and every deck, quiz and Reviewer PDF for{" "}
            {exam}.<ContactNote unlock={unlock} />
          </>
        ),
        action: plansTo("See plans"),
      };
  }
}

/**
 * A Course or Lesson the access decision refused (spec, Phase 5 planning
 * decisions → Access and playback, Hiding, unpublishing and deleting), in
 * place of the player: an included Course's lock leads to the Exam's Plans
 * ("See plans", "Renew access", progress kept); a separately sold Course's
 * to "Unlock for ₱1,499", or says it isn't on sale; a Hidden Course or an
 * Unpublished Lesson is no longer available. No playback pass was asked for.
 */
export function LessonRefusal(props: LessonRefusalProps) {
  const { tag, locked, heading, body, action } = refusalOf(props);
  return (
    <section
      aria-labelledby="lesson-refusal"
      className={cn(
        "flex max-w-xl flex-col gap-2.5 border-[1.5px] bg-ayc-paper p-5",
        locked ? "shadow-hard-lg" : "border-dashed border-ayc-slate",
      )}
    >
      <p
        className={cn(
          "font-mono text-xs font-bold tracking-[0.06em]",
          locked ? "text-destructive" : "text-ayc-blue",
        )}
      >
        {tag}
      </p>
      <h2
        id="lesson-refusal"
        className="text-[clamp(20px,2.4vw,26px)] leading-[1.15] font-extrabold"
      >
        {heading}
      </h2>
      <p className="text-[15px] leading-normal">{body}</p>
      <div className="mt-1 flex flex-wrap gap-2.5">
        {action ? <PlansLink href={action.href}>{action.label}</PlansLink> : null}
        <Link
          href={props.back.href}
          className="flex min-h-12 items-center border-[1.5px] px-4.5 text-[15px] font-bold"
        >
          {props.back.label}
        </Link>
      </div>
    </section>
  );
}

/**
 * The Lesson's video: VdoCipher's DRM player with the playback pass, or the
 * sample player with the video fake's, the Member's watermark drifting
 * across either; or, with no video service (no key), "This video isn't
 * available yet" in its place, the rest of the screen working.
 */
export function LessonVideo({ player, title }: { player: LessonPlayer; title: string }) {
  if (player.kind === "pass") {
    return (
      <PassPlayer
        pass={player.pass}
        seconds={player.seconds}
        watermark={player.watermark}
        title={title}
      />
    );
  }
  return (
    <div className="flex aspect-video w-full max-w-xl flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed border-ayc-slate bg-ayc-paper p-6 text-center">
      <p className="text-[17px] font-bold">
        {player.kind === "not-connected"
          ? "This video isn’t available yet"
          : "The video didn’t load"}
      </p>
      <p className="text-sm text-muted-foreground">
        {player.kind === "not-connected"
          ? "The notes and the other lessons are here meanwhile."
          : "Reload the page to try again."}
      </p>
    </div>
  );
}
