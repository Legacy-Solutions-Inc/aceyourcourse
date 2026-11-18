import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import type { AdminCard } from "@/services/admin.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";

import { sampleActor } from "../../test/admin-inputs";
import { loadCardImage } from "../../test/card-images";
import { imageBytes } from "../../test/image-bytes";
import { MEMBER_ARMS } from "../../test/member-arms";

// Studying a deck through the Member seam (spec, Phase 3 → Progress storage,
// Resume and the Access decision seam; stories 95–97, 104 and 106), run
// against every arm: opening a deck through the access decision, Card Marks
// (the latest wins), Study Days in Asia/Manila, and where a Member left each
// deck. The sample CE MSTC decks: Simple Curves' is Visible and Free
// Preview, Spiral Curves' Visible, Algebra's Hidden; they start with no
// cards, so each test has an Editor write the ones it needs. It's 17 Nov
// 2026, 11:42 in Manila. The tester's CE pass ends 90 days after; the lapsed
// tester's ended 3 days before; the stranger has none.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const EDITOR = sampleActor("editor");

const topic = (name: string) => sampleTopicId("CE", "MSTC", name);
const SIMPLE_CURVES = topic("Simple Curves");
const SPIRAL_CURVES = topic("Spiral Curves");
const ALGEBRA = topic("Algebra");
const deckOf = (topicId: string) => sampleContentId(topicId, "deck");
const FREE_DECK = deckOf(SIMPLE_CURVES);
const PASS_DECK = deckOf(SPIRAL_CURVES);
const HIDDEN_DECK = deckOf(ALGEBRA);
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const MEMBERS = {
  tester: { email: "tester@example.com", name: "Bea Tester" },
  lapsed: { email: "lapsed@example.com", name: "Lou Lapsed" },
  stranger: { email: "stranger@example.com", name: "Sam Stranger" },
} as const;
type Who = keyof typeof MEMBERS;
const userOf = (who: Who) => sampleUserId(MEMBERS[who].email);

describe.each(MEMBER_ARMS)("Member seam studying ($name)", (arm) => {
  const { seam } = arm;

  /** The Member's side of the access decision now, as the server gathers it: their own passes. */
  async function accessOf(who: Who, overrides: Partial<MemberAccess> = {}): Promise<MemberAccess> {
    return {
      gate: "open",
      device: "active",
      activeStaff: false,
      passes: (await seam.listAccessPasses(userOf(who))).map(({ examCode, endsAt }) => ({
        examCode,
        endsAt,
      })),
      now: new Date(),
      ...overrides,
    };
  }

  /** An Editor writes cards in a Topic's deck, in order. */
  async function writeCards(topicId: string, ...fronts: string[]): Promise<AdminCard[]> {
    const cards: AdminCard[] = [];
    for (const front of fronts) {
      const added = await arm.admin.createCard(EDITOR, {
        topic: topicId,
        front,
        back: `$${front.length}x$`,
        note: front === "Degree of curve" ? "Arc basis" : "",
      });
      if (!added.ok) throw new Error(`Not added: ${JSON.stringify(added)}`);
      cards.push(added.value);
    }
    return cards;
  }

  const open = async (who: Who, deckId: string, overrides: Partial<MemberAccess> = {}) =>
    seam.openDeck(userOf(who), deckId, await accessOf(who, overrides));
  const markOf = async (who: Who, cardId: string, verdict: "got" | "again") =>
    seam.markCard(userOf(who), { cardId, verdict }, await accessOf(who));
  /** The Member's marks and position on a deck, as opening it gives them. */
  async function progressOf(who: Who, deckId: string) {
    const opening = await open(who, deckId);
    if (opening.status !== "allowed") throw new Error(`Not opened: ${opening.status}`);
    return { marks: opening.deck.marks, resumeAt: opening.deck.resumeAt };
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    for (const who of Object.keys(MEMBERS) as Who[]) {
      await seam.getOrCreateMember({ userId: userOf(who), ...MEMBERS[who] });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("openDeck", () => {
    it("opens a deck the Member's pass allows: its cards in order, and their own progress", async () => {
      const [first, second] = await writeCards(SPIRAL_CURVES, "Degree of curve", "Spiral angle");

      expect(await open("tester", PASS_DECK)).toEqual({
        status: "allowed",
        via: "pass",
        item: expect.objectContaining({
          kind: "deck",
          id: PASS_DECK,
          subjectCode: "MSTC",
          topicName: "Spiral Curves",
        }),
        deck: {
          cards: [
            {
              id: first?.id,
              position: 1,
              front: "Degree of curve",
              back: "$15x$",
              note: "Arc basis",
              imageUrl: null,
            },
            {
              id: second?.id,
              position: 2,
              front: "Spiral angle",
              back: "$12x$",
              note: null,
              imageUrl: null,
            },
          ],
          marks: {},
          resumeAt: null,
          imagesExpireAt: null,
        },
      });
    });

    it("follows the deck's order as an Editor changes it", async () => {
      const [first, second] = await writeCards(SPIRAL_CURVES, "First", "Second");
      await arm.admin.moveCard(EDITOR, second?.id ?? "", "up");

      const opening = await open("tester", PASS_DECK);
      expect(opening.status === "allowed" && opening.deck.cards.map((c) => c.id)).toEqual([
        second?.id,
        first?.id,
      ]);
    });

    it("opens a Free Preview deck for a Member with no pass", async () => {
      await writeCards(SIMPLE_CURVES, "Tangent distance");
      expect(await open("stranger", FREE_DECK)).toMatchObject({
        status: "allowed",
        via: "free-preview",
        deck: { cards: [{ front: "Tangent distance" }] },
      });
    });

    it("opens a deck for active Staff without a pass", async () => {
      await writeCards(SPIRAL_CURVES, "Spiral angle");
      expect(await open("stranger", PASS_DECK, { activeStaff: true })).toMatchObject({
        status: "allowed",
        via: "staff",
      });
    });

    it("gives a Visible deck with no cards yet as empty: it's still being prepared", async () => {
      expect(await open("stranger", FREE_DECK)).toMatchObject({
        status: "allowed",
        deck: { cards: [], marks: {}, resumeAt: null },
      });
    });

    it("never reads a locked deck's cards, saying it's locked", async () => {
      await writeCards(SPIRAL_CURVES, "A secret formula");

      const opening = await open("stranger", PASS_DECK);
      expect(opening).toEqual({
        status: "refused",
        item: expect.objectContaining({ id: PASS_DECK, topicName: "Spiral Curves" }),
        decision: { outcome: "locked" },
        marked: 0,
      });
      expect(JSON.stringify(opening)).not.toContain("A secret formula");
    });

    it("says an ended pass expired, keeping the Member's marks", async () => {
      // The lapsed tester marked cards while the deck was Free Preview, then Staff ended that.
      const [first, second] = await writeCards(SIMPLE_CURVES, "First", "Second");
      await markOf("lapsed", first?.id ?? "", "got");
      await markOf("lapsed", second?.id ?? "", "again");
      await arm.admin.setDeckFreePreview(EDITOR, FREE_DECK, false);

      expect(await open("lapsed", FREE_DECK)).toEqual({
        status: "refused",
        item: expect.objectContaining({ id: FREE_DECK }),
        decision: {
          outcome: "expired",
          passEndedAt: new Date(BOOT.getTime() - 3 * DAY).toISOString(),
        },
        marked: 2,
      });
      // Free Preview again: the marks are all there.
      await arm.admin.setDeckFreePreview(EDITOR, FREE_DECK, true);
      expect((await progressOf("lapsed", FREE_DECK)).marks).toEqual({
        [first?.id ?? ""]: "got",
        [second?.id ?? ""]: "again",
      });
    });

    it("says a deck hidden while a Member is on it is no longer available, keeping their marks", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");
      await markOf("tester", card?.id ?? "", "got");
      await arm.admin.setDeckVisibility(EDITOR, PASS_DECK, false);

      expect(await open("tester", PASS_DECK)).toMatchObject({
        status: "refused",
        decision: { outcome: "unavailable" },
        marked: 1,
      });
    });

    it("never opens a Hidden deck, even for Staff", async () => {
      await writeCards(ALGEBRA, "Quadratic formula");

      for (const opening of [
        await open("tester", HIDDEN_DECK),
        await open("tester", HIDDEN_DECK, { activeStaff: true }),
      ]) {
        expect(opening).toMatchObject({ status: "refused", decision: { outcome: "unavailable" } });
        expect(JSON.stringify(opening)).not.toContain("Quadratic formula");
      }
    });

    it.each([
      ["a replaced device", { device: "replaced" }, "device-replaced"],
      ["a request with no device token", { device: "no-token" }, "no-token"],
      ["a Member the gate no longer lets in", { gate: "not-open-yet" }, "not-open-yet"],
    ] as const)("refuses %s, reading no card", async (_case, overrides, outcome) => {
      await writeCards(SIMPLE_CURVES, "Tangent distance");

      const opening = await open("tester", FREE_DECK, overrides);
      expect(opening).toMatchObject({ status: "refused", decision: { outcome } });
      expect(JSON.stringify(opening)).not.toContain("Tangent distance");
    });

    it.each([
      ["an unknown id", UNKNOWN],
      ["a quiz's id", sampleContentId(SIMPLE_CURVES, "quiz")],
      ["an id that isn't one", "simple-curves"],
    ])("finds nothing for %s", async (_case, id) => {
      expect(await open("tester", id)).toEqual({ status: "not-found" });
    });
  });

  describe("card images", () => {
    it("hands out each image as a signed URL that works for about 10 minutes", async () => {
      const bytes = imageBytes("image/png");
      const image = await arm.uploadCardImage(bytes);
      const added = await arm.admin.createCard(EDITOR, {
        topic: SPIRAL_CURVES,
        front: "Spiral",
        back: "$L_s$",
        image,
      });
      await writeCards(SPIRAL_CURVES, "No image");
      if (!added.ok) throw new Error("Not added");

      const opening = await open("tester", PASS_DECK);
      if (opening.status !== "allowed") throw new Error("Not opened");
      const [withImage, without] = opening.deck.cards;
      expect(without?.imageUrl).toBeNull();
      expect(opening.deck.imagesExpireAt).toBe(
        new Date(BOOT.getTime() + 10 * MINUTE).toISOString(),
      );
      expect(await loadCardImage(withImage?.imageUrl ?? "")).toEqual(bytes);
    });

    it("signs no image for a locked or Hidden deck", async () => {
      for (const topicId of [SPIRAL_CURVES, ALGEBRA]) {
        const image = await arm.uploadCardImage(imageBytes("image/png"));
        await arm.admin.createCard(EDITOR, { topic: topicId, front: "S", back: "$s$", image });
      }

      for (const opening of [
        await open("stranger", PASS_DECK),
        await open("tester", HIDDEN_DECK),
      ]) {
        expect(opening.status).toBe("refused");
        expect(JSON.stringify(opening)).not.toMatch(/imageUrl|card-images|\/sign\//);
      }
    });

    it("signs the images again each time the deck is opened, for 10 minutes from then", async () => {
      const image = await arm.uploadCardImage(imageBytes("image/png"));
      await arm.admin.createCard(EDITOR, { topic: SPIRAL_CURVES, front: "S", back: "$s$", image });

      const expiries = [];
      for (const minutes of [5, 12]) {
        vi.setSystemTime(new Date(BOOT.getTime() + minutes * MINUTE));
        const opening = await open("tester", PASS_DECK);
        if (opening.status !== "allowed") throw new Error("Not opened");
        expect(opening.deck.cards[0]?.imageUrl).toEqual(expect.any(String));
        expiries.push(opening.deck.imagesExpireAt);
      }
      expect(expiries).toEqual([
        new Date(BOOT.getTime() + 15 * MINUTE).toISOString(),
        new Date(BOOT.getTime() + 22 * MINUTE).toISOString(),
      ]);
    });
  });

  describe("markCard", () => {
    it("saves the Member's mark, timed now", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");

      expect(await markOf("tester", card?.id ?? "", "got")).toEqual({
        ok: true,
        value: {
          userId: userOf("tester"),
          cardId: card?.id,
          verdict: "got",
          markedAt: BOOT.toISOString(),
        },
      });
      expect((await progressOf("tester", PASS_DECK)).marks).toEqual({ [card?.id ?? ""]: "got" });
    });

    it("keeps only the latest mark on a card marked again", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");
      await markOf("tester", card?.id ?? "", "got");
      vi.setSystemTime(new Date(BOOT.getTime() + MINUTE));
      await markOf("tester", card?.id ?? "", "again");

      expect((await progressOf("tester", PASS_DECK)).marks).toEqual({ [card?.id ?? ""]: "again" });
      expect(await arm.cardMarks()).toEqual([
        {
          userId: userOf("tester"),
          cardId: card?.id,
          verdict: "again",
          markedAt: new Date(BOOT.getTime() + MINUTE).toISOString(),
        },
      ]);
    });

    it("keeps marks made on Free Preview when an Access Pass starts", async () => {
      const [card] = await writeCards(SIMPLE_CURVES, "Tangent distance");
      await markOf("stranger", card?.id ?? "", "again");

      await arm.putAccessPass({
        userId: userOf("stranger"),
        examCode: "CE",
        endsAt: new Date(BOOT.getTime() + 30 * DAY).toISOString(),
      });
      await arm.admin.setDeckFreePreview(EDITOR, FREE_DECK, false);

      expect(await open("stranger", FREE_DECK)).toMatchObject({
        status: "allowed",
        via: "pass",
        deck: { marks: { [card?.id ?? ""]: "again" } },
      });
    });

    it("never shows one Member's marks or position to another", async () => {
      const [first, second] = await writeCards(SIMPLE_CURVES, "First", "Second");
      await markOf("tester", first?.id ?? "", "got");
      await seam.saveDeckPosition(
        userOf("tester"),
        { deckId: FREE_DECK, cardId: second?.id ?? "" },
        await accessOf("tester"),
      );

      expect(await progressOf("stranger", FREE_DECK)).toEqual({ marks: {}, resumeAt: null });
      expect(await seam.listStudyDays(userOf("stranger"))).toEqual([]);
    });

    it.each([
      ["a replaced device", { device: "replaced" }, { outcome: "device-replaced" }],
      ["no device token", { device: "no-token" }, { outcome: "no-token" }],
    ] as const)("refuses a mark from %s, changing nothing", async (_case, overrides, decision) => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");

      expect(
        await seam.markCard(
          userOf("tester"),
          { cardId: card?.id ?? "", verdict: "got" },
          await accessOf("tester", overrides),
        ),
      ).toEqual({ ok: false, refusal: { reason: "refused", decision } });
      expect(await arm.cardMarks()).toEqual([]);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual([]);
    });

    it("refuses a mark on a locked deck's card, changing nothing", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");

      expect(await markOf("stranger", card?.id ?? "", "got")).toEqual({
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "locked" } },
      });
      expect(await arm.cardMarks()).toEqual([]);
    });

    it("refuses a mark once the deck is hidden, keeping the marks made before", async () => {
      const [first, second] = await writeCards(SPIRAL_CURVES, "First", "Second");
      await markOf("tester", first?.id ?? "", "got");
      await arm.admin.setDeckVisibility(EDITOR, PASS_DECK, false);

      expect(await markOf("tester", second?.id ?? "", "got")).toEqual({
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "unavailable" } },
      });
      expect((await arm.cardMarks()).map((m) => m.cardId)).toEqual([first?.id]);
    });

    it.each([
      ["an unknown card", UNKNOWN],
      ["an id that isn't one", "card-1"],
    ])("finds nothing to mark for %s", async (_case, cardId) => {
      expect(await markOf("tester", cardId, "got")).toEqual({
        ok: false,
        refusal: { reason: "not-found" },
      });
    });

    it("refuses a verdict that isn't Got it or Review again", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");
      await expect(
        seam.markCard(
          userOf("tester"),
          { cardId: card?.id ?? "", verdict: "maybe" as "got" },
          await accessOf("tester"),
        ),
      ).rejects.toThrow();
      expect(await arm.cardMarks()).toEqual([]);
    });
  });

  describe("Study Days", () => {
    it("records the Manila date of a Member's marks once per day", async () => {
      const [first, second] = await writeCards(SPIRAL_CURVES, "First", "Second");
      await markOf("tester", first?.id ?? "", "got");
      await markOf("tester", second?.id ?? "", "again");

      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17"]);
    });

    it("records a new day for a mark just after Manila midnight, not before", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");
      // 23:59:59 on 17 Nov in Manila (UTC+8), then midnight.
      vi.setSystemTime(new Date("2026-11-17T15:59:59.000Z"));
      await markOf("tester", card?.id ?? "", "got");
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17"]);

      vi.setSystemTime(new Date("2026-11-17T16:00:00.000Z"));
      await markOf("tester", card?.id ?? "", "again");
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17", "2026-11-18"]);
    });

    it("refuses a User id that isn't one", async () => {
      await expect(seam.listStudyDays("tester")).rejects.toThrow();
    });
  });

  describe("saveDeckPosition", () => {
    const savePosition = async (who: Who, deckId: string, cardId: string | null) =>
      seam.saveDeckPosition(userOf(who), { deckId, cardId }, await accessOf(who));

    it("saves the card a Member is on, which the deck then opens at", async () => {
      const [, second, third] = await writeCards(SPIRAL_CURVES, "First", "Second", "Third");

      expect(await savePosition("tester", PASS_DECK, second?.id ?? "")).toEqual({
        ok: true,
        value: {
          userId: userOf("tester"),
          deckId: PASS_DECK,
          cardId: second?.id,
          savedAt: BOOT.toISOString(),
        },
      });
      await savePosition("tester", PASS_DECK, third?.id ?? "");
      expect((await progressOf("tester", PASS_DECK)).resumeAt).toBe(third?.id);
    });

    it("clears the position once the Member finishes the deck", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "First", "Second");
      await savePosition("tester", PASS_DECK, card?.id ?? "");

      expect(await savePosition("tester", PASS_DECK, null)).toEqual({ ok: true, value: null });
      expect((await progressOf("tester", PASS_DECK)).resumeAt).toBeNull();
    });

    it("opens at the first card once the card the Member left at is deleted", async () => {
      const [, second] = await writeCards(SPIRAL_CURVES, "First", "Second");
      await savePosition("tester", PASS_DECK, second?.id ?? "");
      await arm.admin.deleteCard(EDITOR, second?.id ?? "");

      expect((await progressOf("tester", PASS_DECK)).resumeAt).toBeNull();
    });

    it("finds nothing for a card that isn't in the deck", async () => {
      const [other] = await writeCards(SIMPLE_CURVES, "Elsewhere");
      await writeCards(SPIRAL_CURVES, "Here");

      expect(await savePosition("tester", PASS_DECK, other?.id ?? "")).toEqual({
        ok: false,
        refusal: { reason: "not-found" },
      });
      expect(await savePosition("tester", UNKNOWN, null)).toEqual({
        ok: false,
        refusal: { reason: "not-found" },
      });
    });

    it("refuses a locked deck and a replaced device, changing nothing", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, "Spiral angle");

      expect(await savePosition("stranger", PASS_DECK, card?.id ?? "")).toEqual({
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "locked" } },
      });
      expect(
        await seam.saveDeckPosition(
          userOf("tester"),
          { deckId: PASS_DECK, cardId: card?.id ?? "" },
          await accessOf("tester", { device: "replaced" }),
        ),
      ).toMatchObject({ ok: false, refusal: { decision: { outcome: "device-replaced" } } });
      expect((await progressOf("tester", PASS_DECK)).resumeAt).toBeNull();
    });
  });
});
