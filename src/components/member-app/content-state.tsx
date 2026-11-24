import Link from "next/link";

import { passEndDate, type ShownRefusal } from "@/lib/member-app/access";
import type { UnlockRoute } from "@/lib/member-app/unlock";
import { cn } from "@/lib/utils";

interface ContentStateProps {
  /** What the access decision refused: the gate and the Active Device have their own screens. */
  decision: ShownRefusal;
  examCode: string;
  /** How the Member gets the Exam's All-Access: its Plans, or by asking AYC. */
  unlock: UnlockRoute;
  /** Where Back goes: the item's Subject in the Library, or the Library. */
  back: { href: string; label: string };
  /** The sentence on what's kept when access ends or the item goes: "Your progress is kept." unless given. */
  keptNote?: string;
}

/**
 * How Members get access to an Exam with no Plan on sale (Phase 4, ticket
 * 02; the "contact us" note): "During the beta, access comes from AYC…".
 */
export function BetaAccessNote({ contactEmail }: { contactEmail: string }) {
  return (
    <>
      During the beta, access comes from AYC. Ask us at{" "}
      <a
        href={`mailto:${contactEmail}`}
        className="font-bold text-ayc-blue underline underline-offset-2"
      >
        {contactEmail}
      </a>
      .
    </>
  );
}

/** The "contact us" note after a sentence, for an Exam with no Plan on sale; nothing while one is on sale. */
export function ContactNote({ unlock }: { unlock: UnlockRoute }) {
  return unlock.kind === "contact" ? (
    <>
      {" "}
      <BetaAccessNote contactEmail={unlock.contactEmail} />
    </>
  ) : null;
}

/** The orange link to an Exam's Plans: "See plans" on a lock, "Renew access" once access ended. */
export function PlansLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center self-start border-[1.5px] border-ayc-navy bg-ayc-orange px-4.5 text-[15px] font-extrabold text-ayc-navy shadow-hard-sm"
    >
      {children}
    </Link>
  );
}

/** What each decision shows: its tag, heading and text. */
function stateOf({
  decision,
  examCode,
  unlock,
  keptNote = "Your progress is kept.",
}: ContentStateProps): {
  tag: string;
  tone: "plain" | "locked";
  heading: string;
  body: React.ReactNode;
  /** The way to the Exam's Plans, when it has one on sale and the Member is locked out. */
  plans: { href: string; label: string } | null;
} {
  const contact = <ContactNote unlock={unlock} />;
  const plansTo = (label: string) =>
    unlock.kind === "plans" ? { href: unlock.href, label } : null;
  switch (decision.outcome) {
    case "locked":
      return {
        tag: "🔒 LOCKED",
        tone: "locked",
        heading: `Unlock with ${examCode} All-Access`,
        body: (
          <>
            {examCode} All-Access opens every deck, quiz and Reviewer PDF for {examCode}.{contact}
          </>
        ),
        plans: plansTo("See plans"),
      };
    case "expired":
      return {
        tag: "🔒 ACCESS ENDED",
        tone: "locked",
        heading: `Your ${examCode} All-Access ended on ${passEndDate(decision.passEndedAt)}`,
        body: (
          <>
            Your access ended. {keptNote}
            {contact}
          </>
        ),
        plans: plansTo("Renew access"),
      };
    case "unavailable":
      return {
        tag: "NO LONGER AVAILABLE",
        tone: "plain",
        heading: "No longer available",
        body: `This is no longer available. ${keptNote}`,
        plans: null,
      };
  }
}

/**
 * A deck, quiz or Reviewer PDF the access decision refused (spec, Phase 3 →
 * Access decision seam; mockup `expired`), in place of its study screen:
 * locked shows the unlock prompt; expired says the pass ended and progress is
 * kept; unavailable says it's no longer available. Locked and expired lead
 * to the Exam's Plans ("See plans", "Renew access") while it has a Plan on
 * sale, and keep the "contact us" note otherwise (ticket 02).
 */
export function ContentState(props: ContentStateProps) {
  const { tag, tone, heading, body, plans } = stateOf(props);
  return (
    <section
      aria-labelledby="content-state"
      className={cn(
        "flex max-w-xl flex-col gap-2.5 border-[1.5px] bg-ayc-paper p-5",
        tone === "locked" ? "shadow-hard-lg" : "border-dashed border-ayc-slate",
      )}
    >
      <p
        className={cn(
          "font-mono text-xs font-bold tracking-[0.06em]",
          tone === "locked" ? "text-destructive" : "text-ayc-blue",
        )}
      >
        {tag}
      </p>
      <h2
        id="content-state"
        className="text-[clamp(20px,2.4vw,26px)] leading-[1.15] font-extrabold"
      >
        {heading}
      </h2>
      <p className="text-[15px] leading-normal">{body}</p>
      <div className="mt-1 flex flex-wrap gap-2.5">
        {plans ? <PlansLink href={plans.href}>{plans.label}</PlansLink> : null}
        <Link
          href={props.back.href}
          className="flex min-h-12 items-center self-start border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
        >
          {props.back.label}
        </Link>
      </div>
    </section>
  );
}
