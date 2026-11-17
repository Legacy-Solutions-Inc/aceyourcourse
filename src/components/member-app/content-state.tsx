import Link from "next/link";

import { type AccessDecision, passEndDate } from "@/lib/member-app/access";
import { cn } from "@/lib/utils";
import type { ContentKind } from "@/services/content.types";

/** What opening an item can show here: the gate and the Active Device have their own screens. */
export type ShownDecision = Extract<
  AccessDecision,
  | { outcome: "allowed" }
  | { outcome: "expired" }
  | { outcome: "locked" }
  | { outcome: "unavailable" }
>;

interface ContentStateProps {
  decision: ShownDecision;
  kind: ContentKind;
  examCode: string;
  /** Where Members ask AYC for access during the beta. */
  contactEmail: string;
  /** Where Back goes: the item's Subject in the Library, or the Library. */
  back: { href: string; label: string };
}

const OPENS_SOON: Record<ContentKind, string> = {
  deck: "These flashcards open here soon.",
  quiz: "This quiz opens here soon.",
  "reviewer-pdf": "This Reviewer PDF opens here soon.",
};

/** How Members get access before Plans exist (Phase 4): "During the beta, access comes from AYC…". */
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

/** What each decision shows: its tag, heading and text. */
function stateOf({ decision, kind, examCode, contactEmail }: ContentStateProps): {
  tag: string;
  tone: "plain" | "locked";
  heading: string;
  body: React.ReactNode;
} {
  switch (decision.outcome) {
    case "allowed":
      return {
        tag: decision.via === "free-preview" ? "OPENING SOON · FREE PREVIEW" : "OPENING SOON",
        tone: "plain",
        heading: "Opening soon",
        body: `${OPENS_SOON[kind]} It’s part of the beta, still being built.`,
      };
    case "locked":
      return {
        tag: "🔒 LOCKED",
        tone: "locked",
        heading: `Unlock with ${examCode} All-Access`,
        body: (
          <>
            {examCode} All-Access opens every deck, quiz and Reviewer PDF for {examCode}.{" "}
            <BetaAccessNote contactEmail={contactEmail} />
          </>
        ),
      };
    case "expired":
      return {
        tag: "🔒 ACCESS ENDED",
        tone: "locked",
        heading: `Your ${examCode} All-Access ended on ${passEndDate(decision.passEndedAt)}`,
        body: (
          <>
            Your access ended. Your progress is kept. <BetaAccessNote contactEmail={contactEmail} />
          </>
        ),
      };
    case "unavailable":
      return {
        tag: "NO LONGER AVAILABLE",
        tone: "plain",
        heading: "No longer available",
        body: "This is no longer available. Your progress is kept.",
      };
  }
}

/**
 * Opening a deck, quiz or Reviewer PDF (spec, Phase 3 → Access decision
 * seam; mockups `expired` and `emptyTopic`): what the access decision
 * answered. Allowed shows "Opening soon" until the study screens replace it
 * (tickets 08, 11 and 14); locked shows the unlock prompt; expired says the
 * pass ended and progress is kept; unavailable says it's no longer available.
 */
export function ContentState(props: ContentStateProps) {
  const { tag, tone, heading, body } = stateOf(props);
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
      <Link
        href={props.back.href}
        className="mt-1 flex min-h-12 items-center self-start border-[1.5px] bg-primary px-4.5 text-[15px] font-bold text-primary-foreground"
      >
        {props.back.label}
      </Link>
    </section>
  );
}
