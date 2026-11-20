import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_CARD_IMAGE_BYTES } from "@/lib/cards/card-rules";
import type { AdminCard, StaffActor } from "@/services/admin.types";
import type { CardMark } from "@/services/content.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";

import { sampleActor } from "../../test/admin-inputs";
import { ADMIN_ARMS } from "../../test/admin-arms";
import { imageBytes, textBytes } from "../../test/image-bytes";

// ─────────────────────────────────────────────────────────────────────────────
// The card editor through the Admin seam (Phase 3, ticket 07; spec, Phase 3 →
// Content model; stories 125, 127, 128): any Staff User adds, edits, moves and
// deletes a Topic's cards one at a time, and makes its deck Visible or Hidden
// and Free Preview. Every rule is the seam's: a card's text (card-fields.ts),
// its back image (a finished "card-image" upload, a JPEG, PNG or WebP of at
// most 5 MB), the conflict check on an edit, Visible refused while the deck is
// empty, the last card's delete hiding a Visible deck, and a deleted card's
// Card Marks going with it. Each change appends Staff Activity.
// ─────────────────────────────────────────────────────────────────────────────

const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");

/** A Visible, Free Preview deck with no cards yet, in CE's MSTC. */
const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
/** A Hidden deck with no cards yet. */
const ALGEBRA = sampleTopicId("CE", "MSTC", "Algebra");
const ALGEBRA_DECK = sampleContentId(ALGEBRA, "deck");
const SIMPLE_CURVES_DECK = sampleContentId(SIMPLE_CURVES, "deck");
/** A Topic with no deck. */
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const FORMULA = "$D = \\frac{1145.916}{R}$";

const MEMBER_A = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const MEMBER_B = "9b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

describe.each(ADMIN_ARMS)("the card editor ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    await arm.reset();
  });

  async function deckOf(topic: string) {
    const deck = await seam.getDeckForAdmin(EDITOR, topic);
    if (!deck) throw new Error(`${topic} isn't in the sample data`);
    return deck;
  }

  /** Adds a card to a Topic, which must save. */
  async function addCard(
    topic: string,
    front: string,
    fields: { back?: string; note?: string; image?: string | null } = {},
    actor: StaffActor = EDITOR,
  ): Promise<AdminCard> {
    const result = await seam.createCard(actor, {
      topic,
      front,
      back: fields.back ?? FORMULA,
      note: fields.note ?? "",
      image: fields.image ?? null,
    });
    if (!result.ok) throw new Error(`The card wasn't added: ${JSON.stringify(result.error)}`);
    return result.value;
  }

  const fronts = async (topic: string) => (await deckOf(topic)).cards.map((card) => card.front);

  /** Runs `write`, and gives its result and the Staff Activity it appended. */
  async function appendedBy<T>(write: () => Promise<T>) {
    const before = await arm.staffActivity();
    const result = await write();
    return { result, appended: (await arm.staffActivity()).slice(before.length) };
  }

  describe("reading a Topic's deck", () => {
    it("gives the Topic, where it is, its deck's settings and its cards in order", async () => {
      await addCard(ALGEBRA, "Quadratic formula");
      await addCard(ALGEBRA, "Slope");

      expect(await seam.getDeckForAdmin(EDITOR, ALGEBRA)).toEqual({
        exam: { code: "CE", name: expect.any(String) },
        subject: { code: "MSTC", name: expect.any(String) },
        topic: { id: ALGEBRA, name: "Algebra", position: 4 },
        deck: { id: ALGEBRA_DECK, visibility: "hidden", freePreview: false },
        cards: [
          expect.objectContaining({ position: 1, front: "Quadratic formula", back: FORMULA }),
          expect.objectContaining({ position: 2, front: "Slope" }),
        ],
      });
    });

    it("gives a Topic with no deck yet, with no cards", async () => {
      expect(await seam.getDeckForAdmin(EDITOR, SURVEYING)).toMatchObject({
        topic: { id: SURVEYING, name: "Surveying" },
        deck: null,
        cards: [],
      });
    });

    it.each([
      ["a Topic that isn't there", UNKNOWN],
      ["an address that isn't a Topic's", "not-a-topic"],
    ])("gives null for %s", async (_, topic) => {
      expect(await seam.getDeckForAdmin(EDITOR, topic)).toBeNull();
    });
  });

  describe("adding a card", () => {
    it("adds a card with maths last in the deck, as saved, and records it", async () => {
      await addCard(ALGEBRA, "First");
      const { result, appended } = await appendedBy(() =>
        seam.createCard(EDITOR, {
          topic: ALGEBRA,
          front: "  Degree of curve  ",
          back: `${FORMULA}\n`,
          note: "   ",
          image: null,
        }),
      );

      expect(result).toEqual({
        ok: true,
        value: {
          id: expect.any(String),
          position: 2,
          front: "Degree of curve",
          back: FORMULA,
          note: null,
          image: null,
          stamp: { savedAt: expect.any(String), savedBy: EDITOR.name },
        },
        tags: [],
      });
      expect(await fronts(ALGEBRA)).toEqual(["First", "Degree of curve"]);
      expect(appended).toEqual([
        expect.objectContaining({
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "card",
          entityId: result.ok ? result.value.id : "",
          action: "add",
          before: null,
          after: expect.objectContaining({ deck: ALGEBRA_DECK, front: "Degree of curve" }),
        }),
      ]);
    });

    it("accepts a literal \\$ in any field", async () => {
      const card = await addCard(ALGEBRA, "Price", { back: "\\$5 per $m^2$", note: "In \\$" });
      expect(card).toMatchObject({ back: "\\$5 per $m^2$", note: "In \\$" });
    });

    it("gives a Topic with no deck a Hidden one, not Free Preview, for its first card", async () => {
      const { appended } = await appendedBy(() => addCard(SURVEYING, "Bearing"));
      const deck = await deckOf(SURVEYING);

      expect(deck.deck).toEqual({
        id: expect.any(String),
        visibility: "hidden",
        freePreview: false,
      });
      expect(deck.cards.map((card) => card.front)).toEqual(["Bearing"]);
      expect(appended.map(({ entity, action }) => `${entity} ${action}`)).toEqual([
        "deck add",
        "card add",
      ]);
    });

    it("lets an Owner add cards too", async () => {
      expect(await addCard(ALGEBRA, "Owner's card", {}, OWNER)).toMatchObject({
        stamp: { savedBy: OWNER.name },
      });
    });

    it.each([
      ["an empty front", { front: "  " }, { front: ["ADD A FRONT TO SAVE"] }],
      ["an empty back", { back: "" }, { back: ["ADD A BACK TO SAVE"] }],
      [
        "a front over 500 characters",
        { front: "a".repeat(501) },
        { front: ["KEEP IT TO 500 CHARACTERS"] },
      ],
      [
        "a back over 2,000 characters",
        { back: "a".repeat(2001) },
        { back: ["KEEP IT TO 2,000 CHARACTERS"] },
      ],
      [
        "a note over 1,000 characters",
        { note: "a".repeat(1001) },
        { note: ["KEEP IT TO 1,000 CHARACTERS"] },
      ],
      [
        "a formula that won't render",
        { back: "Half is $\\frac{1}{$" },
        {
          back: [
            "The back has a formula that won’t render, “\\frac{1}{”: Unexpected end of input in a macro argument, expected '}'",
          ],
        },
      ],
      [
        "a $ never closed",
        { note: "Costs $5" },
        { note: ["The note has a $ with no closing $ (write a dollar sign as \\$)"] },
      ],
    ])("refuses %s, saving nothing", async (_, fields, fieldErrors) => {
      const { result, appended } = await appendedBy(() =>
        seam.createCard(EDITOR, {
          topic: ALGEBRA,
          front: "Front",
          back: "Back",
          note: "",
          image: null,
          ...fields,
        }),
      );

      expect(result).toEqual({ ok: false, error: { kind: "invalid", fieldErrors } });
      expect(await arm.cards()).toEqual([]);
      expect(appended).toEqual([]);
    });

    it("answers not-found for a Topic that's gone", async () => {
      expect(
        await seam.createCard(EDITOR, { topic: UNKNOWN, front: "F", back: "B", image: null }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });
  });

  it("changes nothing, and keeps no image, when a save breaks halfway", async () => {
    const card = await addCard(ALGEBRA, "Kept");
    const upload = await arm.uploadCardImage(imageBytes("image/png"));
    const put = vi.spyOn(arm.contentFiles, "put");
    const mend = await arm.breakStaffActivity();
    try {
      await expect(
        seam.createCard(EDITOR, { topic: ALGEBRA, front: "Lost", back: "B", image: upload }),
      ).rejects.toThrow();
      await expect(seam.deleteCard(EDITOR, card.id)).rejects.toThrow();
    } finally {
      await mend();
    }

    expect((await arm.cards()).map((c) => c.front)).toEqual(["Kept"]);
    // Neither the copy stored under the deck nor its upload is kept: the form uploads again to retry.
    const [stored] = put.mock.calls.map(([path]) => path);
    put.mockRestore();
    expect(stored).toMatch(new RegExp(`^decks/${ALGEBRA_DECK}/`));
    expect(await arm.storedFile(stored ?? "")).toBeNull();
    expect(await arm.contentFiles.readUpload(upload, "card-image")).toBeNull();
  });

  it("keeps no image from a save the lock refuses, such as an edit to a card deleted meanwhile", async () => {
    const card = await addCard(ALGEBRA, "Going");
    const upload = await arm.uploadCardImage(imageBytes("image/png"));
    // The card goes while the edit is between storing its image and saving.
    const original = arm.contentFiles.put.bind(arm.contentFiles);
    const put = vi.spyOn(arm.contentFiles, "put").mockImplementationOnce(async (...args) => {
      await original(...args);
      await seam.deleteCard(OWNER, card.id);
    });

    const result = await seam.updateCard(
      EDITOR,
      { id: card.id, front: "Going", back: FORMULA, image: upload },
      card.stamp,
    );
    const [stored] = put.mock.calls.map(([path]) => path);
    put.mockRestore();

    expect(result).toEqual({ ok: false, error: { kind: "not-found" } });
    expect(await arm.storedFile(stored ?? "")).toBeNull();
    expect(await arm.contentFiles.readUpload(upload, "card-image")).toBeNull();
  });

  describe("a card's back image", () => {
    it("stores an uploaded image under the deck, privately, and deletes the upload", async () => {
      const bytes = imageBytes("image/png");
      const upload = await arm.uploadCardImage(bytes);
      const card = await addCard(ALGEBRA, "Beam", { image: upload });

      expect(card.image).toMatch(new RegExp(`^decks/${ALGEBRA_DECK}/[0-9a-f-]{36}\\.png$`));
      expect(await arm.storedFile(card.image ?? "")).toEqual(bytes);
      expect(await arm.contentFiles.readUpload(upload, "card-image")).toBeNull();
      expect(await seam.getCardImageForAdmin(EDITOR, card.id)).toEqual({
        contentType: "image/png",
        bytes,
      });
    });

    it("gives no image for a card without one, or a card that isn't there", async () => {
      const card = await addCard(ALGEBRA, "Plain");
      expect(await seam.getCardImageForAdmin(EDITOR, card.id)).toBeNull();
      expect(await seam.getCardImageForAdmin(EDITOR, UNKNOWN)).toBeNull();
      expect(await seam.getCardImageForAdmin(EDITOR, "not-a-card")).toBeNull();
    });

    it.each([
      [
        "an upload whose file never arrived",
        () => arm.uploadCardImage(imageBytes("image/png"), { send: false }),
        "UPLOAD THE IMAGE AGAIN",
      ],
      ["a path that isn't an upload", async () => "decks/x/y.png", "UPLOAD THE IMAGE AGAIN"],
      [
        "a file that isn't really an image",
        () => arm.uploadCardImage(textBytes(), { contentType: "image/png" }),
        "USE A JPEG, PNG OR WEBP IMAGE",
      ],
      [
        "an image over 5 MB",
        () => arm.uploadCardImage(imageBytes("image/png", MAX_CARD_IMAGE_BYTES + 1)),
        "KEEP THE IMAGE TO 5 MB",
      ],
    ])("refuses %s on save, keeping nothing", async (_, upload, message) => {
      const image = await upload();
      const { result, appended } = await appendedBy(() =>
        seam.createCard(EDITOR, { topic: ALGEBRA, front: "F", back: "B", image }),
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { image: [message] } },
      });
      expect(await arm.cards()).toEqual([]);
      expect(appended).toEqual([]);
    });
  });

  describe("editing a card", () => {
    it("saves the fields with the stamp the form opened with, and records before and after", async () => {
      const card = await addCard(ALGEBRA, "Slope", { back: "rise", note: "tip" });
      const { result, appended } = await appendedBy(() =>
        seam.updateCard(
          EDITOR,
          {
            id: card.id,
            front: "Slope",
            back: "$m = \\frac{y_2-y_1}{x_2-x_1}$",
            note: "",
            image: null,
          },
          card.stamp,
        ),
      );

      expect(result).toMatchObject({
        ok: true,
        value: { id: card.id, position: 1, back: "$m = \\frac{y_2-y_1}{x_2-x_1}$", note: null },
      });
      expect(result.ok && result.value.stamp.savedAt).not.toBe(card.stamp.savedAt);
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "card",
          entityId: card.id,
          action: "edit",
          before: { front: "Slope", back: "rise", note: "tip", image: null },
          after: {
            front: "Slope",
            back: "$m = \\frac{y_2-y_1}{x_2-x_1}$",
            note: null,
            image: null,
          },
        }),
      ]);
    });

    it("refuses a stale edit with who saved first, changing nothing", async () => {
      const card = await addCard(ALGEBRA, "Slope");
      const first = await seam.updateCard(
        OWNER,
        { id: card.id, front: "Slope (owner)", back: FORMULA, image: null },
        card.stamp,
      );
      expect(first.ok).toBe(true);

      const { result, appended } = await appendedBy(() =>
        seam.updateCard(
          EDITOR,
          { id: card.id, front: "Slope (editor)", back: FORMULA, image: null },
          card.stamp,
        ),
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: expect.any(String) },
      });
      expect(await fronts(ALGEBRA)).toEqual(["Slope (owner)"]);
      expect(appended).toEqual([]);
    });

    it("refuses an empty back on an edit, as on a new card", async () => {
      const card = await addCard(ALGEBRA, "Slope");
      expect(
        await seam.updateCard(
          EDITOR,
          { id: card.id, front: "Slope", back: " ", image: null },
          card.stamp,
        ),
      ).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { back: ["ADD A BACK TO SAVE"] } },
      });
    });

    it("keeps, replaces and removes the image, deleting each file it stops using", async () => {
      const first = imageBytes("image/png");
      const card = await addCard(ALGEBRA, "Beam", { image: await arm.uploadCardImage(first) });
      const kept = await seam.updateCard(
        EDITOR,
        { id: card.id, front: "Beam!", back: FORMULA, image: card.image },
        card.stamp,
      );
      if (!kept.ok) throw new Error(JSON.stringify(kept.error));
      expect(kept.value.image).toBe(card.image);

      const second = imageBytes("image/jpeg");
      const replaced = await seam.updateCard(
        EDITOR,
        {
          id: card.id,
          front: "Beam!",
          back: FORMULA,
          image: await arm.uploadCardImage(second, { contentType: "image/jpeg" }),
        },
        kept.value.stamp,
      );
      if (!replaced.ok) throw new Error(JSON.stringify(replaced.error));
      expect(replaced.value.image).toMatch(/\.jpg$/);
      expect(await arm.storedFile(replaced.value.image ?? "")).toEqual(second);
      expect(await arm.storedFile(card.image ?? "")).toBeNull();

      const removed = await seam.updateCard(
        EDITOR,
        { id: card.id, front: "Beam!", back: FORMULA, image: null },
        replaced.value.stamp,
      );
      expect(removed).toMatchObject({ ok: true, value: { image: null } });
      expect(await arm.storedFile(replaced.value.image ?? "")).toBeNull();
    });

    it("refuses another card's image as this card's", async () => {
      const other = await addCard(ALGEBRA, "Other", {
        image: await arm.uploadCardImage(imageBytes("image/png")),
      });
      const card = await addCard(ALGEBRA, "Card");

      expect(
        await seam.updateCard(
          EDITOR,
          { id: card.id, front: "Card", back: FORMULA, image: other.image },
          card.stamp,
        ),
      ).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { image: ["UPLOAD THE IMAGE AGAIN"] } },
      });
    });

    it("answers not-found for a card that's gone", async () => {
      expect(
        await seam.updateCard(EDITOR, { id: UNKNOWN, front: "F", back: "B", image: null }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });
  });

  describe("moving a card", () => {
    it("swaps it with its neighbour, gives the new order, and records it", async () => {
      const a = await addCard(ALGEBRA, "A");
      const b = await addCard(ALGEBRA, "B");
      const c = await addCard(ALGEBRA, "C");

      const { result, appended } = await appendedBy(() => seam.moveCard(EDITOR, c.id, "up"));

      expect(result).toEqual({ ok: true, value: [a.id, c.id, b.id], tags: [] });
      expect(await fronts(ALGEBRA)).toEqual(["A", "C", "B"]);
      expect((await deckOf(ALGEBRA)).cards.map((card) => card.position)).toEqual([1, 2, 3]);
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "card",
          entityId: c.id,
          action: "move",
          before: [a.id, b.id, c.id],
          after: [a.id, c.id, b.id],
        }),
      ]);
    });

    it("refuses moving the first card up or the last down", async () => {
      const a = await addCard(ALGEBRA, "A");
      const b = await addCard(ALGEBRA, "B");

      expect(await seam.moveCard(EDITOR, a.id, "up")).toMatchObject({
        ok: false,
        error: { kind: "invalid", formError: "IT’S ALREADY THE FIRST CARD" },
      });
      expect(await seam.moveCard(EDITOR, b.id, "down")).toMatchObject({
        ok: false,
        error: { kind: "invalid", formError: "IT’S ALREADY THE LAST CARD" },
      });
      expect(await fronts(ALGEBRA)).toEqual(["A", "B"]);
    });

    it("answers not-found for a card that's gone", async () => {
      expect(await seam.moveCard(EDITOR, UNKNOWN, "up")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("deleting a card", () => {
    const mark = (userId: string, cardId: string): CardMark => ({
      userId,
      cardId,
      verdict: "got",
      markedAt: "2026-11-18T01:00:00.000Z",
    });

    it("removes it and its Card Marks, keeps the other cards' marks, and closes the gap", async () => {
      const a = await addCard(ALGEBRA, "A");
      const b = await addCard(ALGEBRA, "B");
      const c = await addCard(ALGEBRA, "C");
      await arm.putCardMark(mark(MEMBER_A, b.id));
      await arm.putCardMark(mark(MEMBER_B, b.id));
      await arm.putCardMark(mark(MEMBER_A, a.id));
      await arm.putCardMark(mark(MEMBER_B, c.id));

      const { result, appended } = await appendedBy(() => seam.deleteCard(EDITOR, b.id));

      expect(result).toEqual({
        ok: true,
        value: { card: expect.objectContaining({ id: b.id, front: "B" }), deckHidden: false },
        tags: [],
      });
      expect((await deckOf(ALGEBRA)).cards.map(({ front, position }) => [front, position])).toEqual(
        [
          ["A", 1],
          ["C", 2],
        ],
      );
      const kept = (await arm.cardMarks()).map(({ userId, cardId }) => `${userId} ${cardId}`);
      expect(kept.sort()).toEqual([`${MEMBER_A} ${a.id}`, `${MEMBER_B} ${c.id}`].sort());
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "card",
          entityId: b.id,
          action: "delete",
          before: expect.objectContaining({ front: "B" }),
          after: null,
        }),
      ]);
    });

    it("deletes its image file", async () => {
      const card = await addCard(ALGEBRA, "Beam", {
        image: await arm.uploadCardImage(imageBytes("image/png")),
      });
      await seam.deleteCard(EDITOR, card.id);

      expect(await arm.storedFile(card.image ?? "")).toBeNull();
    });

    it("makes a Visible deck Hidden when its last card goes, and says so", async () => {
      const card = await addCard(SIMPLE_CURVES, "Only card");

      const { result, appended } = await appendedBy(() => seam.deleteCard(EDITOR, card.id));

      expect(result).toMatchObject({ ok: true, value: { deckHidden: true } });
      expect((await deckOf(SIMPLE_CURVES)).deck).toEqual({
        id: SIMPLE_CURVES_DECK,
        visibility: "hidden",
        freePreview: true,
      });
      expect(appended.map(({ entity, action }) => `${entity} ${action}`)).toEqual([
        "card delete",
        "deck hide",
      ]);
    });

    it("leaves a Hidden deck as it was when its last card goes", async () => {
      const card = await addCard(ALGEBRA, "Only card");

      expect(await seam.deleteCard(EDITOR, card.id)).toMatchObject({
        ok: true,
        value: { deckHidden: false },
      });
      expect((await deckOf(ALGEBRA)).deck?.visibility).toBe("hidden");
    });

    it("answers not-found for a card that's gone", async () => {
      expect(await seam.deleteCard(EDITOR, UNKNOWN)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("the deck's settings", () => {
    it("refuses making an empty deck Visible, keeping it Hidden", async () => {
      const { result, appended } = await appendedBy(() =>
        seam.setDeckVisibility(EDITOR, ALGEBRA_DECK, true),
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "ADD A CARD FIRST" },
      });
      expect((await deckOf(ALGEBRA)).deck?.visibility).toBe("hidden");
      expect(appended).toEqual([]);
    });

    it("makes a deck with cards Visible, then Hidden again, recording each", async () => {
      await addCard(ALGEBRA, "A");

      const shown = await appendedBy(() => seam.setDeckVisibility(EDITOR, ALGEBRA_DECK, true));
      expect(shown.result).toEqual({
        ok: true,
        value: { id: ALGEBRA_DECK, visibility: "visible", freePreview: false },
        tags: [],
      });
      expect(shown.appended).toEqual([
        expect.objectContaining({
          entity: "deck",
          entityId: ALGEBRA_DECK,
          action: "show",
          before: { visibility: "hidden" },
          after: { visibility: "visible" },
        }),
      ]);

      const hidden = await seam.setDeckVisibility(EDITOR, ALGEBRA_DECK, false);
      expect(hidden).toMatchObject({ ok: true, value: { visibility: "hidden" } });
    });

    it("changes nothing, and records nothing, when it's already so", async () => {
      const { result, appended } = await appendedBy(() =>
        seam.setDeckVisibility(EDITOR, ALGEBRA_DECK, false),
      );
      expect(result).toMatchObject({ ok: true, value: { visibility: "hidden" } });
      expect(appended).toEqual([]);
    });

    it("flags a deck Free Preview, and takes it off, recording each", async () => {
      const { result, appended } = await appendedBy(() =>
        seam.setDeckFreePreview(EDITOR, ALGEBRA_DECK, true),
      );

      expect(result).toEqual({
        ok: true,
        value: { id: ALGEBRA_DECK, visibility: "hidden", freePreview: true },
        tags: [],
      });
      expect(appended).toEqual([
        expect.objectContaining({
          entity: "deck",
          entityId: ALGEBRA_DECK,
          action: "free-preview",
          before: { freePreview: false },
          after: { freePreview: true },
        }),
      ]);
      expect(await seam.setDeckFreePreview(OWNER, ALGEBRA_DECK, false)).toMatchObject({
        ok: true,
        value: { freePreview: false },
      });
    });

    it("answers not-found for a deck that isn't there", async () => {
      expect(await seam.setDeckVisibility(EDITOR, UNKNOWN, false)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.setDeckFreePreview(EDITOR, UNKNOWN, true)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });
});
