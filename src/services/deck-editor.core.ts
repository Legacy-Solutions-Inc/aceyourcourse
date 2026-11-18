import { z } from "zod";

import {
  CARD_IMAGE_TYPES,
  cardImagePath,
  IMAGE_TOO_BIG,
  MAX_CARD_IMAGE_BYTES,
  WRONG_IMAGE_TYPE,
} from "@/lib/cards/card-rules";
import { hasFileSignature } from "@/lib/file-signature";
import {
  type CardForm,
  cardFormSchema,
  cardIdInputSchema,
  cardMoveInputSchema,
  deckFreePreviewInputSchema,
  deckVisibilityInputSchema,
  invalidInput,
  type NewCardForm,
  newCardFormSchema,
  type ReviewMove,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminCard,
  AdminDeck,
  AdminDeckSettings,
  AdminError,
  AdminResult,
  CardImageFile,
  DeletedCard,
  RecordStamp,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import { visibilityAfterRemoval, visibilityRefusal } from "@/services/content.rules";
import type { Card, ContentVisibility, Deck, Topic } from "@/services/content.types";
import { nextStamp } from "@/services/mock/sample-store";
import type { ContentFiles } from "@/services/uploads";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's card editor (Phase 3, ticket 07; spec, Phase 3 → Content
// model; stories 125, 127, 128), shared by both arms: each arm gives a
// DeckEditorStore (how it reads one Topic's deck and its cards, and saves a
// change to them all or nothing), and this module does the rest the same way
// for both. Any Staff User, Editor or Owner, may use it.
//
// Each write, in order:
//   1. checks the actor's Staff Role, and validates its input with zod (a
//      card's text by src/lib/cards/card-fields.ts),
//   2. reads the deck, answering not-found when the Topic, deck or card is
//      gone, and for an edit runs the conflict check against the stamp the
//      form opened with,
//   3. checks and stores a new back image: a finished "card-image" upload
//      that really is a JPEG, PNG or WebP of at most 5 MB, copied under its
//      deck in the private content bucket,
//   4. saves under the content write lock, where the deck is read again and
//      every rule runs on it as it is then (the conflict check again,
//      Visible refused while empty, the last card's delete hiding a Visible
//      deck), with one Staff Activity record per entity it changes and the
//      card's new stamp; a deleted card's Card Marks go with it, and
//   5. once saved, deletes the files nothing uses any more: the upload, and
//      a replaced or deleted card's old image. If nothing was saved, the
//      image it stored and its upload are deleted instead (the form uploads
//      the file again to retry). A failed delete is logged.
// Nothing cached reads cards or decks, so no write returns a cache tag.
// ─────────────────────────────────────────────────────────────────────────────

/** One Topic, where it is, its deck (or none yet), and the deck's cards in order. */
export interface TopicDeck {
  exam: { code: string; name: string };
  subject: { code: string; name: string };
  topic: Topic;
  deck: Deck | null;
  /** The deck's cards, in order. */
  cards: Card[];
  /** Each card's last save, by card id. A card nobody has saved through the editor has none. */
  stamps: Record<string, RecordStamp>;
  /** When the data was made: the stamp of a card nobody has saved. */
  seededAt: string;
}

/** Which deck: a Topic's, a card's, or the deck itself. */
export type DeckKey = { topic: string } | { card: string } | { deck: string };

/** Everything a write changes, worked out on the deck as it is under the lock. */
export interface DeckWrites {
  /** The deck as it now is, when the write made it or changed its settings. */
  deck?: { value: Deck; isNew: boolean };
  /** The cards it adds or changes. */
  cards: Card[];
  /** The cards it deletes, by id: their Card Marks and stamps go with them. */
  removed: string[];
  /** The stamps it sets, by card id. */
  stamps: Record<string, RecordStamp>;
  activity: StaffActivity[];
}

/** A write's answer on the deck as it is: refused, or its value and what it changes (null: nothing). */
export type DeckPlan<T> =
  { ok: false; error: AdminError } | { ok: true; value: T; writes: DeckWrites | null };

/** How an arm reads a Topic's deck and saves a change to it. */
export interface DeckEditorStore {
  /** The deck, with its Topic and cards, or null when the Topic, deck or card isn't there. */
  read(key: DeckKey): Promise<TopicDeck | null>;
  /** The private content bucket. */
  files: ContentFiles;
  /**
   * Holds off every other content write, reads the deck again, and saves the
   * writes `plan` works out on it, all or nothing. Gives plan's answer.
   * Throws when the save fails.
   */
  save<T>(key: DeckKey, plan: (current: TopicDeck | null) => DeckPlan<T>): Promise<DeckPlan<T>>;
}

/** A new back image, stored under its deck, and the upload it was copied from. */
interface StoredImage {
  path: string;
  upload: string;
}

/** A card's record in the save stamps. */
export const cardRecordOf = (cardId: string) => `card:${cardId}`;

// ── Pure helpers ────────────────────────────────────────────────────────────

const UPLOAD_AGAIN = "UPLOAD THE IMAGE AGAIN";
const ALREADY_FIRST = "IT’S ALREADY THE FIRST CARD";
const ALREADY_LAST = "IT’S ALREADY THE LAST CARD";

const NOT_FOUND: { ok: false; error: AdminError } = { ok: false, error: { kind: "not-found" } };
const refused = (error: AdminError): { ok: false; error: AdminError } => ({ ok: false, error });
const formError = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: {},
  formError: message,
});
const imageError = (message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: { image: [message] },
});

/** Pure: a card's stamp: its last save, or the data's, when nobody has saved it. */
const stampOf = (deck: TopicDeck, cardId: string): RecordStamp =>
  deck.stamps[cardId] ?? { savedAt: deck.seededAt, savedBy: null };

const settingsOf = ({ id, visibility, freePreview }: Deck): AdminDeckSettings => ({
  id,
  visibility,
  freePreview,
});

const adminCardOf = (card: Card, stamp: RecordStamp): AdminCard => ({
  id: card.id,
  position: card.position,
  front: card.front,
  back: card.back,
  note: card.note,
  image: card.image,
  stamp,
});

/** Pure: the deck screen's read. */
export function adminDeckOf(deck: TopicDeck): AdminDeck {
  return {
    exam: deck.exam,
    subject: deck.subject,
    topic: { id: deck.topic.id, name: deck.topic.name, position: deck.topic.position },
    deck: deck.deck ? settingsOf(deck.deck) : null,
    cards: deck.cards.map((card) => adminCardOf(card, stampOf(deck, card.id))),
  };
}

/** Pure: the cards whose place changes when the deck takes this order, each with its new place. */
const renumbered = (order: readonly Card[]): Card[] =>
  order.flatMap((card, index) =>
    card.position === index + 1 ? [] : [{ ...card, position: index + 1 }],
  );

/** A card's fields, as Staff Activity keeps them. */
const fieldsOf = ({ front, back, note, image }: Card) => ({ front, back, note, image });

function activity(
  actor: StaffActor,
  now: Date,
  entity: "card" | "deck",
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
): StaffActivity {
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    actor: { email: actor.email, name: actor.name },
    entity,
    entityId,
    action,
    before: structuredClone(before),
    after: structuredClone(after),
  };
}

const NO_WRITES: Omit<DeckWrites, "activity"> = { cards: [], removed: [], stamps: {} };

const uuid = z.string().uuid();

// ── The seam's calls ────────────────────────────────────────────────────────

/** The card editor's calls, on an arm's store. */
export function deckEditorCalls(store: DeckEditorStore) {
  /** Step 1: the role check and the input. */
  function begin<Schema extends z.ZodTypeAny>(
    actor: StaffActor,
    schema: Schema,
    input: unknown,
  ): { ok: true; value: z.output<Schema> } | { ok: false; error: AdminError } {
    const refusal = roleRefusal(actor, "staff");
    if (refusal) return refused(refusal);
    const parsed = schema.safeParse(input);
    return parsed.success ? { ok: true, value: parsed.data } : refused(invalidInput(parsed.error));
  }

  /**
   * Step 3: a new image's upload, checked and copied under its deck: the
   * path it's stored at, or why it can't be. Only the server's own reading of
   * the file counts: its size, and what its first bytes say it is.
   */
  async function storeUpload(
    upload: string,
    deckId: string,
  ): Promise<({ ok: true } & StoredImage) | { ok: false; error: AdminError }> {
    const bytes = await store.files.readUpload(upload, "card-image");
    if (!bytes) return refused(imageError(UPLOAD_AGAIN));
    if (bytes.byteLength > MAX_CARD_IMAGE_BYTES) return refused(imageError(IMAGE_TOO_BIG));
    const type = CARD_IMAGE_TYPES.find((candidate) => hasFileSignature(bytes, candidate));
    if (!type) return refused(imageError(WRONG_IMAGE_TYPE));
    const path = cardImagePath(deckId, crypto.randomUUID(), type);
    await store.files.put(path, bytes, type);
    return { ok: true, path, upload };
  }

  /**
   * Steps 4 and 5: saves under the lock, then deletes the files nothing uses:
   * `stale(value)` once it saved; or, when it didn't, the image it stored and
   * the upload it came from (the form uploads the file again to retry).
   */
  async function saveAndTidy<T>(
    key: DeckKey,
    plan: (current: TopicDeck | null) => DeckPlan<T>,
    stored: StoredImage | null,
    stale: (value: T) => (string | null)[],
  ): Promise<AdminResult<T>> {
    const unsaved = stored ? [stored.path, stored.upload] : [];
    let planned: DeckPlan<T>;
    try {
      planned = await store.save(key, plan);
    } catch (error) {
      if (unsaved.length > 0) await store.files.remove(unsaved);
      throw error;
    }
    if (!planned.ok) {
      if (unsaved.length > 0) await store.files.remove(unsaved);
      return planned;
    }
    const unused = stale(planned.value).filter((path): path is string => path !== null);
    if (unused.length > 0) await store.files.remove(unused);
    return { ok: true, value: planned.value, tags: [] };
  }

  async function getDeckForAdmin(_actor: StaffActor, topicId: string): Promise<AdminDeck | null> {
    if (!uuid.safeParse(topicId).success) return null;
    const deck = await store.read({ topic: topicId });
    return deck ? adminDeckOf(deck) : null;
  }

  async function getCardImageForAdmin(
    _actor: StaffActor,
    cardId: string,
  ): Promise<CardImageFile | null> {
    if (!uuid.safeParse(cardId).success) return null;
    const deck = await store.read({ card: cardId });
    const image = deck?.cards.find((card) => card.id === cardId)?.image;
    return image ? store.files.read(image) : null;
  }

  async function createCard(
    actor: StaffActor,
    input: NewCardForm,
  ): Promise<AdminResult<AdminCard>> {
    const form = begin(actor, newCardFormSchema, input);
    if (!form.ok) return form;
    const { topic, front, back, note, image: upload } = form.value;
    const before = await store.read({ topic });
    if (!before) return NOT_FOUND;

    const newDeckId = before.deck?.id ?? crypto.randomUUID();
    let stored: StoredImage | null = null;
    if (upload) {
      const image = await storeUpload(upload, newDeckId);
      if (!image.ok) return image;
      stored = { path: image.path, upload: image.upload };
    }

    const now = new Date();
    const id = crypto.randomUUID();
    return saveAndTidy(
      { topic },
      (current): DeckPlan<AdminCard> => {
        if (!current) return NOT_FOUND;
        // The Topic's first card gives it a deck: Hidden, and not Free Preview.
        const deck: Deck = current.deck ?? {
          id: newDeckId,
          topicId: current.topic.id,
          visibility: "hidden",
          freePreview: false,
        };
        const last = current.cards.at(-1)?.position ?? 0;
        const card: Card = {
          id,
          deckId: deck.id,
          position: last + 1,
          front,
          back,
          note,
          image: stored?.path ?? null,
        };
        const stamp = nextStamp({ savedAt: current.seededAt, savedBy: null }, actor.name, now);
        const records = [
          ...(current.deck ? [] : [activity(actor, now, "deck", deck.id, "add", null, deck)]),
          activity(actor, now, "card", id, "add", null, {
            deck: deck.id,
            position: card.position,
            ...fieldsOf(card),
          }),
        ];
        return {
          ok: true,
          value: adminCardOf(card, stamp),
          writes: {
            ...(current.deck ? {} : { deck: { value: deck, isNew: true } }),
            cards: [card],
            removed: [],
            stamps: { [id]: stamp },
            activity: records,
          },
        };
      },
      stored,
      () => [upload],
    );
  }

  async function updateCard(
    actor: StaffActor,
    input: CardForm,
    expected?: { savedAt: string },
  ): Promise<AdminResult<AdminCard>> {
    const form = begin(actor, cardFormSchema, input);
    if (!form.ok) return form;
    const { id, front, back, note, image: wanted } = form.value;
    const before = await store.read({ card: id });
    const old = before?.cards.find((card) => card.id === id);
    if (!before || !old) return NOT_FOUND;
    const opened = stampOf(before, id);
    if (expected && expected.savedAt !== opened.savedAt) {
      return refused({ kind: "conflict", ...opened });
    }

    // The image: none, the card's own (kept), or a new upload, stored now.
    let stored: StoredImage | null = null;
    if (wanted !== null && wanted !== old.image) {
      const image = await storeUpload(wanted, old.deckId);
      if (!image.ok) return image;
      stored = { path: image.path, upload: image.upload };
    }
    const image = wanted === old.image ? old.image : (stored?.path ?? null);

    const now = new Date();
    return saveAndTidy(
      { card: id },
      (current): DeckPlan<AdminCard> => {
        const card = current?.cards.find((candidate) => candidate.id === id);
        if (!current || !card) return NOT_FOUND;
        // Again under the lock: a save since the read is a conflict too.
        const stamp = stampOf(current, id);
        if (stamp.savedAt !== opened.savedAt) return refused({ kind: "conflict", ...stamp });
        const edited: Card = { ...card, front, back, note, image };
        const next = nextStamp(stamp, actor.name, now);
        return {
          ok: true,
          value: adminCardOf(edited, next),
          writes: {
            cards: [edited],
            removed: [],
            stamps: { [id]: next },
            activity: [activity(actor, now, "card", id, "edit", fieldsOf(card), fieldsOf(edited))],
          },
        };
      },
      stored,
      // The upload, and the old image once it's been replaced or removed.
      () => [stored?.upload ?? null, old.image !== image ? old.image : null],
    );
  }

  async function moveCard(
    actor: StaffActor,
    id: string,
    direction: ReviewMove,
  ): Promise<AdminResult<string[]>> {
    // Like ▲▼ everywhere, it always saves: there's no form to go stale.
    const form = begin(actor, cardMoveInputSchema, { id, direction });
    if (!form.ok) return form;
    const now = new Date();
    return saveAndTidy(
      { card: id },
      (current): DeckPlan<string[]> => {
        const order = current?.cards ?? [];
        const index = order.findIndex((card) => card.id === id);
        const card = order[index];
        if (!current || !card) return NOT_FOUND;
        const other = form.value.direction === "up" ? index - 1 : index + 1;
        const swapped = order[other];
        if (!swapped) return refused(formError(other < 0 ? ALREADY_FIRST : ALREADY_LAST));
        const moved = order.map((c, i) => (i === index ? swapped : i === other ? card : c));
        const before = order.map((c) => c.id);
        const after = moved.map((c) => c.id);
        return {
          ok: true,
          value: after,
          writes: {
            ...NO_WRITES,
            cards: renumbered(moved),
            activity: [activity(actor, now, "card", id, "move", before, after)],
          },
        };
      },
      null,
      () => [],
    );
  }

  async function deleteCard(actor: StaffActor, id: string): Promise<AdminResult<DeletedCard>> {
    const form = begin(actor, cardIdInputSchema, { id });
    if (!form.ok) return form;
    const now = new Date();
    return saveAndTidy(
      { card: id },
      (current): DeckPlan<DeletedCard> => {
        const card = current?.cards.find((candidate) => candidate.id === id);
        if (!current?.deck || !card) return NOT_FOUND;
        const rest = current.cards.filter((candidate) => candidate.id !== id);
        // The last card of a Visible deck takes the deck off the Member App with it.
        const after = visibilityAfterRemoval(current.deck.visibility, rest.length);
        const deck = { ...current.deck, visibility: after.visibility };
        return {
          ok: true,
          value: { card: structuredClone(card), deckHidden: after.hidden },
          writes: {
            ...(after.hidden ? { deck: { value: deck, isNew: false } } : {}),
            cards: renumbered(rest),
            removed: [id],
            stamps: {},
            activity: [
              // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
              activity(actor, now, "card", id, "delete", card, null),
              ...(after.hidden
                ? [
                    activity(
                      actor,
                      now,
                      "deck",
                      deck.id,
                      "hide",
                      { visibility: "visible" },
                      { visibility: "hidden" },
                    ),
                  ]
                : []),
            ],
          },
        };
      },
      null,
      ({ card }) => [card.image],
    );
  }

  /** A deck's single toggle: it always saves, with no conflict check, and records a change. */
  async function setDeckSetting(
    actor: StaffActor,
    deckId: string,
    change: (deck: Deck, cards: number) => { error: string } | { deck: Deck; action: string },
  ): Promise<AdminResult<AdminDeckSettings>> {
    const now = new Date();
    return saveAndTidy(
      { deck: deckId },
      (current): DeckPlan<AdminDeckSettings> => {
        if (!current?.deck) return NOT_FOUND;
        const changed = change(current.deck, current.cards.length);
        if ("error" in changed) return refused(formError(changed.error));
        const { deck, action } = changed;
        if (
          deck.visibility === current.deck.visibility &&
          deck.freePreview === current.deck.freePreview
        ) {
          return { ok: true, value: settingsOf(deck), writes: null };
        }
        const field = action === "free-preview" ? "freePreview" : "visibility";
        return {
          ok: true,
          value: settingsOf(deck),
          writes: {
            ...NO_WRITES,
            deck: { value: deck, isNew: false },
            activity: [
              activity(
                actor,
                now,
                "deck",
                deck.id,
                action,
                { [field]: current.deck[field] },
                { [field]: deck[field] },
              ),
            ],
          },
        };
      },
      null,
      () => [],
    );
  }

  async function setDeckVisibility(
    actor: StaffActor,
    deckId: string,
    visible: boolean,
  ): Promise<AdminResult<AdminDeckSettings>> {
    const form = begin(actor, deckVisibilityInputSchema, { deck: deckId, visible });
    if (!form.ok) return form;
    const visibility: ContentVisibility = form.value.visible ? "visible" : "hidden";
    return setDeckSetting(actor, form.value.deck, (deck, cards) => {
      const refusal = visibilityRefusal(visibility, cards, "card");
      if (refusal) return { error: refusal };
      return { deck: { ...deck, visibility }, action: visibility === "visible" ? "show" : "hide" };
    });
  }

  async function setDeckFreePreview(
    actor: StaffActor,
    deckId: string,
    freePreview: boolean,
  ): Promise<AdminResult<AdminDeckSettings>> {
    const form = begin(actor, deckFreePreviewInputSchema, { deck: deckId, freePreview });
    if (!form.ok) return form;
    return setDeckSetting(actor, form.value.deck, (deck) => ({
      deck: { ...deck, freePreview: form.value.freePreview },
      action: "free-preview",
    }));
  }

  return {
    getDeckForAdmin,
    getCardImageForAdmin,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    setDeckVisibility,
    setDeckFreePreview,
  };
}
