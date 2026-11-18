import {
  accessDecision,
  type AllowedVia,
  type MemberAccess,
  type RefusedDecision,
} from "@/lib/member-app/access";
import type { ContentItem } from "@/services/member.types";

/** The access decision on a deck or quiz, refused or allowed: what the study calls branch on. */
export type Decided =
  { allowed: false; decision: RefusedDecision } | { allowed: true; via: AllowedVia };

/**
 * The access decision (src/lib/member-app/access.ts) on one deck or quiz as
 * it is now, for the Member's side the server gathered for this request. The
 * study calls (deck-study.core.ts, quiz-study.core.ts) ask it before they
 * read a card or a question, or write anything.
 */
export function decide(item: ContentItem, access: MemberAccess): Decided {
  const decision = accessDecision({ ...access, content: item });
  return decision.outcome === "allowed"
    ? { allowed: true, via: decision.via }
    : { allowed: false, decision };
}
