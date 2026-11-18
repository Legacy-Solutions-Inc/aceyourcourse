import type { z } from "zod";

import type { AllowedVia, RefusedDecision } from "@/lib/member-app/access";
import type { ExamDateSetBy } from "@/lib/member-app/exam-date";
import type { CardMarkVerdict, ContentKind } from "@/services/content.types";
import type { cardMarkInputSchema, deckPositionInputSchema } from "@/services/member.schema";

// The Member seam's types (spec, Phase 3 → Phase 3 seams). A Member is a
// person with a Member App account (CONTEXT.md), keyed by their User.

/** The signed-in User, as sign-in verified them: the Member seam's caller. */
export interface MemberUser {
  /** The Supabase User's id. */
  userId: string;
  /** Their verified email. */
  email: string;
  /** Their Google profile name, when sign-in gave one. */
  name: string | null;
}

/** A Member's record, made the first time they pass the Member App gate. */
export interface Member {
  /** The Supabase User's id: a Member is keyed by their User. */
  userId: string;
  /** Their email when they joined, lowercased. */
  email: string;
  /** Their Google profile name when they joined, or null when sign-in gave none. */
  name: string | null;
  /** ISO time they first passed the gate. */
  joinedAt: string;
}

/** The Terms of Use and Privacy Policy versions in one agreement, such as "2.0". */
export interface AgreedVersions {
  termsVersion: string;
  privacyVersion: string;
}

/**
 * One time a Member agreed to the Terms of Use and the Privacy Policy, with
 * the versions they agreed to (spec, Phase 3 → Consent). Agreements are kept
 * as history: a new one is added each time, and none is ever changed.
 */
export interface ConsentRecord extends AgreedVersions {
  /** The Member's User id. */
  userId: string;
  /** ISO time they agreed. */
  agreedAt: string;
}

/** An Exam a Member can pick as a Target Exam: one that's on the Website. */
export interface PickableExam {
  /** Uppercase code, such as "CE". */
  code: string;
  /** Board acronym, such as "CELE". */
  board: string;
  name: string;
  /** The Exam's Official Exam Date (YYYY-MM-DD), which a new Target Exam follows. Null when Staff set none. */
  officialExamDate: string | null;
}

/**
 * One of a Member's Target Exams (CONTEXT.md): an Exam plus the Member's Exam
 * Date for it (spec, Phase 3 → Target Exams).
 */
export interface TargetExam {
  examCode: string;
  board: string;
  name: string;
  /**
   * The Exam Date (YYYY-MM-DD): the Member's own once they have set one, and
   * the Exam's Official Exam Date until then. Null when neither is set.
   */
  examDate: string | null;
  /** Whose date `examDate` is. Null when there is none. */
  dateSetBy: ExamDateSetBy | null;
  /** Whether this is the Member's selected Target Exam: exactly one is. */
  selected: boolean;
  /** ISO time the Member first added it. */
  addedAt: string;
}

/** What the onboarding and add forms send. */
export interface NewTargetExam {
  examCode: string;
  /** YYYY-MM-DD, or blank or null to follow the Exam's Official Exam Date. */
  examDate: string | null;
}

/** A Target Exam just added, or restored when the Member had removed it earlier. */
export interface AddedTargetExam {
  targetExam: TargetExam;
  /** It was removed earlier, and came back with its own date. */
  restored: boolean;
}

/** Why a Target Exam change was refused. */
export type TargetExamRefusal =
  /** No such Exam, or one that isn't on the Website. */
  | "not-an-exam"
  /** Already one of the Member's Target Exams. */
  | "already-yours"
  /** The Exam has no Official Exam Date, so the Member must give a date. */
  | "date-required"
  /** Not a date on the calendar. */
  | "invalid-date"
  /** Before today in Asia/Manila. */
  | "date-in-past"
  /** Not one of this Member's Target Exams. */
  | "not-yours"
  /** The Member's last Target Exam can't be removed. */
  | "last-one";

export type TargetExamResult<T> = { ok: true; value: T } | { ok: false; error: TargetExamRefusal };

// The Active Device (spec, Phase 3 → Active Device; ADR 0011). The token
// itself never reaches the seam: callers hash it first
// (src/lib/member-app/device-token.ts), and no read gives the hash back.

/** A Member's Active Device, as people see it: its label and when it was claimed. */
export interface ActiveDevice {
  /** "{Browser} on {OS}" from the User-Agent, such as "Chrome on Android", or "Unknown browser". */
  deviceLabel: string;
  /** ISO time the device was claimed. */
  claimedAt: string;
}

/** What a claim sends: the new token's hash, never the token, and the device's label. */
export interface DeviceClaim {
  /** The token's SHA-256, as 64 lowercase hex characters. */
  tokenHash: string;
  deviceLabel: string;
}

/** One claim in a Member's switch log: every claim, the first one too. */
export interface DeviceSwitch {
  /** The Member's User id. */
  userId: string;
  deviceLabel: string;
  /** ISO time of the claim. */
  switchedAt: string;
}

// The Library and opening a content item (spec, Phase 3 → Content model and
// Access decision seam). These are the content as it is, the same for every
// Member: what each Member may open is the access decision's answer
// (src/lib/member-app/access.ts), never part of these reads.

/** A deck, quiz or Reviewer PDF as the Library lists it: only Visible or Published ones. */
export interface LibraryItem {
  kind: ContentKind;
  id: string;
  freePreview: boolean;
}

/** One Topic in the Library, with the content Members can see, in deck, quiz, Reviewer PDF order. */
export interface LibraryTopic {
  id: string;
  name: string;
  /** Its place in its Subject's order, from 1. */
  position: number;
  /** Empty while nothing in it is Visible or Published: its content is still being prepared. */
  items: LibraryItem[];
}

/** One of an Exam's Subjects in the Library, with its Topics in order. */
export interface LibrarySubject {
  code: string;
  name: string;
  topics: LibraryTopic[];
}

/**
 * One deck, quiz or Reviewer PDF, as opening it needs: where it sits, and
 * what the access decision reads from it. A Hidden or unpublished one reads
 * too, so the Member is told it's no longer available.
 */
export interface ContentItem {
  kind: ContentKind;
  id: string;
  examCode: string;
  subjectCode: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  /** A Visible deck or quiz, or a Published Reviewer PDF. */
  available: boolean;
  freePreview: boolean;
}

// Studying a deck (spec, Phase 3 → Progress storage and Resume; ticket 08).
// The seam decides each deck with the access decision before it reads a
// card, and a refused deck's cards never leave it.

/** A card as the flashcard player shows it. */
export interface StudyCard {
  id: string;
  /** Its place in the deck's order, from 1. */
  position: number;
  /** The front, back and note, in the formula notation. */
  front: string;
  back: string;
  note: string | null;
  /** Its back image's signed URL, which stops working after about 10 minutes, or null. */
  imageUrl: string | null;
}

/** A deck the access decision opened, with the Member's own progress on it. */
export interface StudyDeck {
  /** In the deck's order. Empty while the deck has no cards: it's still being prepared. */
  cards: StudyCard[];
  /** The Member's latest mark on each card they have marked, by card id. */
  marks: Record<string, CardMarkVerdict>;
  /** The card they were on when they left the deck, or null to start at the first. */
  resumeAt: string | null;
  /** When the image URLs stop working (ISO), or null when no card has an image. */
  imagesExpireAt: string | null;
}

/** What opening a deck finds. */
export type DeckOpening =
  /** No such deck: a wrong address, or one that was deleted. */
  | { status: "not-found" }
  /** The access decision refused: no card is read. `marked` counts the Member's own Card Marks on it, kept. */
  | { status: "refused"; item: ContentItem; decision: RefusedDecision; marked: number }
  | { status: "allowed"; item: ContentItem; via: AllowedVia; deck: StudyDeck };

/** Why a study write was refused. A refused write changes nothing. */
export type StudyRefusal =
  /** No such card or deck, or a card that isn't in the deck. */
  | { reason: "not-found" }
  /** The access decision refused the card's deck. */
  | { reason: "refused"; decision: RefusedDecision };

export type StudyResult<T> = { ok: true; value: T } | { ok: false; refusal: StudyRefusal };

/** "Got it" or "Review again" on one card. */
export type CardMarkInput = z.input<typeof cardMarkInputSchema>;

/** Where the Member is in a deck: the card they're on, or null once they've finished it. */
export type DeckPositionInput = z.input<typeof deckPositionInputSchema>;
