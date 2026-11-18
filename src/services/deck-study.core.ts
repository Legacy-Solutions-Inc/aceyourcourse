import { manilaDate } from "@/lib/manila-time";
import {
  accessDecision,
  type AllowedVia,
  type MemberAccess,
  type RefusedDecision,
} from "@/lib/member-app/access";
import type { Card, CardMark, DeckPosition } from "@/services/content.types";
import {
  cardMarkInputSchema,
  deckPositionInputSchema,
  isRecordId,
  memberUserIdSchema,
} from "@/services/member.schema";
import type {
  CardMarkInput,
  ContentItem,
  DeckOpening,
  DeckPositionInput,
  StudyCard,
  StudyResult,
} from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// Studying a deck (spec, Phase 3 → Progress storage, Resume and the Access
// decision seam; ticket 08): the Member seam's study calls, written once over
// a small store port that each arm implements (member.mock.ts over the sample
// store, member.db.ts over Postgres), so both arms apply the same rules.
//
// Every call decides the deck with the access decision first, from the
// content as it is now and the Member's side the server gathered for this
// request (src/lib/member-app/access-check.ts). A refused deck's cards are
// never read, its images are never signed, and nothing is written. Card images come from the private bucket as signed URLs
// that stop working after about 10 minutes (spec, Phase 3 → Card back images).
// ─────────────────────────────────────────────────────────────────────────────

/** How long a card image's signed URL works: about 10 minutes. */
export const CARD_IMAGE_URL_SECONDS = 10 * 60;

/** What each arm gives the study calls. Every read and write is the given Member's own. */
export interface DeckStudyStore {
  /** A deck as the access decision reads it, with where it sits, or null when there's no deck with this id. */
  readDeckItem(deckId: string): Promise<ContentItem | null>;
  /** A deck's cards in order: only ever read once the access decision allows the deck. */
  readCards(deckId: string): Promise<Card[]>;
  /** The id of the deck a card is in, or null when there's no such card. */
  deckOfCard(cardId: string): Promise<string | null>;
  /** The Member's marks on a deck's cards. */
  readMarks(userId: string, deckId: string): Promise<CardMark[]>;
  /** The card the Member left this deck at, or null. */
  readPosition(userId: string, deckId: string): Promise<string | null>;
  /**
   * Saves the mark, replacing the Member's earlier one on the card, and the
   * Study Day, once per day, together. False, saving nothing, when the card
   * has gone meanwhile. Throws for a User with no Member record.
   */
  saveMark(mark: CardMark, day: string): Promise<boolean>;
  /**
   * Saves the position, replacing the Member's earlier one in the deck, or
   * clears it (null). False, saving nothing, when the card has left the deck
   * meanwhile. Throws for a User with no Member record.
   */
  savePosition(userId: string, deckId: string, position: DeckPosition | null): Promise<boolean>;
  /** The Member's Study Days, oldest first. */
  readStudyDays(userId: string): Promise<string[]>;
  /** Signed URLs for these card images, by path, working for `seconds`. A file that's gone has none. */
  signImages(paths: readonly string[], seconds: number): Promise<Record<string, string>>;
}

/** The access decision on a deck, refused or allowed. */
type Decided = { allowed: false; decision: RefusedDecision } | { allowed: true; via: AllowedVia };

function decide(item: ContentItem, access: MemberAccess): Decided {
  const decision = accessDecision({ ...access, content: item });
  return decision.outcome === "allowed"
    ? { allowed: true, via: decision.via }
    : { allowed: false, decision };
}

const NOT_FOUND = { ok: false, refusal: { reason: "not-found" } } as const;
const refused = (decision: RefusedDecision) =>
  ({ ok: false, refusal: { reason: "refused", decision } }) as const;

/** The study calls over one arm's store (the Member seam's contract, in member.ts). */
export function deckStudyCalls(store: DeckStudyStore) {
  async function openDeck(
    userId: string,
    deckId: string,
    access: MemberAccess,
  ): Promise<DeckOpening> {
    const member = memberUserIdSchema.parse(userId);
    // The id is the browser's: one that isn't an id is no deck.
    const item = isRecordId(deckId) ? await store.readDeckItem(deckId) : null;
    if (!item) return { status: "not-found" };

    const decided = decide(item, access);
    const marks = await store.readMarks(member, item.id);
    if (!decided.allowed) {
      return { status: "refused", item, decision: decided.decision, marked: marks.length };
    }

    const cards = await store.readCards(item.id);
    const imagePaths = cards.flatMap((card) => (card.image ? [card.image] : []));
    const urls = imagePaths.length
      ? await store.signImages(imagePaths, CARD_IMAGE_URL_SECONDS)
      : {};
    const resumeAt = await store.readPosition(member, item.id);
    return {
      status: "allowed",
      item,
      via: decided.via,
      deck: {
        cards: cards.map((card): StudyCard => ({
          id: card.id,
          position: card.position,
          front: card.front,
          back: card.back,
          note: card.note,
          imageUrl: card.image ? (urls[card.image] ?? null) : null,
        })),
        marks: Object.fromEntries(marks.map((mark) => [mark.cardId, mark.verdict])),
        // A position on a card that's no longer in the deck opens at the first card.
        resumeAt: cards.some((card) => card.id === resumeAt) ? resumeAt : null,
        imagesExpireAt: imagePaths.length
          ? new Date(access.now.getTime() + CARD_IMAGE_URL_SECONDS * 1000).toISOString()
          : null,
      },
    };
  }

  /** A deck decided for a write: its item when allowed, or why nothing may be written. */
  async function deckForWrite(
    deckId: string | null,
    access: MemberAccess,
  ): Promise<{ item: ContentItem } | { refusal: StudyResult<never> }> {
    const item = deckId !== null && isRecordId(deckId) ? await store.readDeckItem(deckId) : null;
    if (!item) return { refusal: NOT_FOUND };
    const decided = decide(item, access);
    return decided.allowed ? { item } : { refusal: refused(decided.decision) };
  }

  async function markCard(
    userId: string,
    input: CardMarkInput,
    access: MemberAccess,
  ): Promise<StudyResult<CardMark>> {
    const member = memberUserIdSchema.parse(userId);
    const { cardId, verdict } = cardMarkInputSchema.parse(input);
    const deck = await deckForWrite(
      isRecordId(cardId) ? await store.deckOfCard(cardId) : null,
      access,
    );
    if ("refusal" in deck) return deck.refusal;

    const mark: CardMark = { userId: member, cardId, verdict, markedAt: access.now.toISOString() };
    // Marking is studying: the day it's marked in Manila is a Study Day.
    if (!(await store.saveMark(mark, manilaDate(access.now)))) return NOT_FOUND;
    return { ok: true, value: mark };
  }

  async function saveDeckPosition(
    userId: string,
    input: DeckPositionInput,
    access: MemberAccess,
  ): Promise<StudyResult<DeckPosition | null>> {
    const member = memberUserIdSchema.parse(userId);
    const { deckId, cardId } = deckPositionInputSchema.parse(input);
    const deck = await deckForWrite(deckId, access);
    if ("refusal" in deck) return deck.refusal;
    const { id } = deck.item;
    if (cardId !== null && !(isRecordId(cardId) && (await store.deckOfCard(cardId)) === id)) {
      return NOT_FOUND;
    }

    const position: DeckPosition | null =
      cardId === null
        ? null
        : { userId: member, deckId: id, cardId, savedAt: access.now.toISOString() };
    if (!(await store.savePosition(member, id, position))) return NOT_FOUND;
    return { ok: true, value: position };
  }

  async function listStudyDays(userId: string): Promise<string[]> {
    return store.readStudyDays(memberUserIdSchema.parse(userId));
  }

  return { openDeck, markCard, saveDeckPosition, listStudyDays };
}
