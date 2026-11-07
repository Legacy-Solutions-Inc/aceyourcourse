import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { faqFormValues, newFaqForm } from "@/lib/admin/faq-form";
import type { FaqForm } from "@/services/admin.schema";
import type { StaffActor } from "@/services/admin.types";
import { listFaqs } from "@/services/catalogue";
import type { FaqGroup } from "@/services/catalogue.types";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's FAQs area, run against every arm (spec, Phase 2 → FAQ,
// Deleting, Conflict check; story 73): the groups and the list an Editor
// searches, the editor's add and save, ▲▼ within a group, and delete. Every
// save is live on the FAQ page. Each test boots the data at BOOT with a fake
// clock.
const BOOT = new Date("2026-10-22T03:42:00.000Z");
const MINUTE = 60 * 1000;
const at = (offset: number) => new Date(BOOT.getTime() + offset);

const OWNER: StaffActor = {
  email: "angel@aceyourcourse.ph",
  name: "Angel Rose L. Lepaña",
  role: "owner",
};
const EDITOR: StaffActor = {
  email: "content@aceyourcourse.ph",
  name: "AYC Content Team",
  role: "editor",
};

/** The seed's FAQs by group, in order. */
const SEED: Record<FaqGroup, string[]> = {
  shipping: ["faq-001", "faq-002", "faq-003"],
  paper: ["faq-004", "faq-005", "faq-006"],
  coverage: ["faq-007", "faq-008", "faq-009", "faq-010"],
  buying: ["faq-011", "faq-012", "faq-013", "faq-014", "faq-015", "faq-016"],
  authenticity: ["faq-017", "faq-018"],
};

/** rev-014, on the posters (Live, shown), is quoted by faq-005. */
const POSTERS_REVIEW = "rev-014";
const POSTERS_TEXT =
  "Glossy type yung paper, makapal sya. Malalaki printing ng formulas kaya mababasa mo mga 6ft away hahaha. Quality 10/10.";
/** rev-001 is on CE Formula Flash Cards. */
const CARDS_REVIEW = "rev-001";

const answerOf = (length: number) => "a".repeat(length);

/** A new Buying FAQ, with a 120-character answer and a quote from rev-014. */
const GCASH: FaqForm = {
  ...newFaqForm("buying"),
  question: "Can I pay by GCash?",
  answer: answerOf(120),
  quoteReviewId: POSTERS_REVIEW,
  quoteText: "Quality 10/10.",
};

const NOT_WORD_FOR_WORD = "This text isn’t in the Review word for word.";

describe.each(ADMIN_ARMS)("Admin seam: FAQs ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const list = (query = {}) => seam.listFaqsForAdmin(EDITOR, query);
  const opened = async (id: string) => {
    const faq = await seam.getFaqForAdmin(EDITOR, id);
    if (!faq) throw new Error(`${id} isn't in the catalogue`);
    return faq;
  };
  /** Saves the FAQ with these of its editor's fields changed. */
  const edit = async (id: string, changes: Partial<FaqForm>, actor = EDITOR) => {
    const { faq, stamp } = await opened(id);
    return seam.updateFaq(
      actor,
      id,
      { ...faqFormValues(faq), ...changes },
      { savedAt: stamp.savedAt },
    );
  };
  /** The ids of a group as the admin list gives them, in order. */
  const groupIds = async (group: FaqGroup) => (await list({ group })).rows.map((faq) => faq.id);
  /** The FAQ page's FAQs, as the Website shows them. */
  const websiteFaqs = async () => (await listFaqs()).flatMap((group) => group.items);
  const websiteGroup = async (group: FaqGroup) =>
    (await listFaqs()).find((g) => g.group === group)?.items.map((faq) => faq.id) ?? [];

  describe("listFaqsForAdmin", () => {
    it("gives the 5 groups in page order with their counts, hidden FAQs included", async () => {
      const result = await list();

      expect(result.groups).toEqual([
        { group: "shipping", title: "Shipping", count: 3 },
        { group: "paper", title: "Paper and print", count: 3 },
        { group: "coverage", title: "What’s covered", count: 4 },
        { group: "buying", title: "Buying", count: 6 },
        { group: "authenticity", title: "Authenticity", count: 2 },
      ]);
    });

    it("lists the first group by default, in order, and the group asked for", async () => {
      const first = await list();
      expect(first.query).toEqual({ group: "shipping", q: null });
      expect(first.rows.map((faq) => faq.id)).toEqual(SEED.shipping);

      const buying = await list({ group: "buying" });
      expect(buying.rows.map((faq) => faq.id)).toEqual(SEED.buying);
      // App-only FAQs are listed: the Admin shows every FAQ.
      expect(buying.rows[1]).toMatchObject({ id: "faq-012", requiresMemberApp: true });
    });

    it("falls back to the first group for one that isn't a group", async () => {
      const result = await list({ group: "returns" });

      expect(result.query.group).toBe("shipping");
      expect(result.rows.map((faq) => faq.id)).toEqual(SEED.shipping);
    });

    it("searches questions and answers in every group, case-insensitively, in page order", async () => {
      const result = await list({ group: "paper", q: "  SHOPEE " });

      expect(result.query).toEqual({ group: "paper", q: "SHOPEE" });
      // Shopee is only ever in the answers.
      expect(result.rows.map((faq) => faq.id)).toEqual([
        "faq-001",
        "faq-002",
        "faq-003",
        "faq-011",
        "faq-015",
        "faq-016",
        "faq-017",
        "faq-018",
      ]);
      expect((await list({ q: "notebook" })).rows.map((faq) => faq.id)).toEqual([
        "faq-006",
        "faq-015",
      ]);
      expect((await list({ q: "zzz" })).rows).toEqual([]);
    });

    it("offers the Reviews a quote can come from: those shown on the Website, with their Product", async () => {
      await arm.reset((seed) => {
        const cards = seed.products.find((p) => p.id === "prd-001");
        if (cards) cards.showOnWebsite = false;
      });

      const { reviews } = await list();

      expect(reviews.map((review) => review.id)).not.toContain(CARDS_REVIEW);
      expect(reviews.find((review) => review.id === POSTERS_REVIEW)).toEqual({
        id: POSTERS_REVIEW,
        stars: 5,
        text: POSTERS_TEXT,
        product: { shortName: "Ultimate CE Posters 2.0", examCode: "CE" },
      });
    });

    it("gives every FAQ's deep-link slug, for a new FAQ's address", async () => {
      const { slugs } = await list();

      expect(slugs).toHaveLength(18);
      expect(slugs).toContain("ship");
    });
  });

  describe("getFaqForAdmin", () => {
    it("opens an FAQ with every field and its stamp", async () => {
      expect(await seam.getFaqForAdmin(EDITOR, "faq-005")).toEqual({
        faq: expect.objectContaining({
          id: "faq-005",
          slug: "posters",
          group: "paper",
          order: 2,
          reviewQuote: { reviewId: POSTERS_REVIEW, text: expect.stringContaining("Glossy") },
        }),
        stamp: { savedAt: BOOT.toISOString(), savedBy: null },
      });
    });

    it("gives null for an FAQ that isn't in the catalogue", async () => {
      expect(await seam.getFaqForAdmin(EDITOR, "faq-999")).toBeNull();
    });
  });

  describe("createFaq", () => {
    it("adds an FAQ last in its group with its quote: live on the FAQ page", async () => {
      vi.setSystemTime(at(MINUTE));
      const result = await seam.createFaq(EDITOR, GCASH);

      expect(result).toEqual({
        ok: true,
        value: {
          faq: {
            id: "faq-019",
            slug: "can-i-pay-by-gcash",
            group: "buying",
            order: 7,
            question: "Can I pay by GCash?",
            answer: answerOf(120),
            reviewQuote: { reviewId: POSTERS_REVIEW, text: "Quality 10/10." },
            popularLabel: null,
            requiresMemberApp: false,
            showOnFaqPage: true,
            showCoverageTable: false,
          },
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name },
        },
        tags: ["catalogue:faqs"],
      });
      expect(await groupIds("buying")).toEqual([...SEED.buying, "faq-019"]);
      // The app-only FAQs stay hidden while the Member App is off.
      expect(await websiteGroup("buying")).toEqual(["faq-011", "faq-015", "faq-016", "faq-019"]);
      expect((await websiteFaqs()).find((faq) => faq.id === "faq-019")?.reviewQuote).toEqual({
        reviewId: POSTERS_REVIEW,
        text: "Quality 10/10.",
        stars: 5,
        variation: "MSTC, HPGE, PSAD",
        product: {
          slug: "ultimate-ce-posters-2-0",
          shortName: "Ultimate CE Posters 2.0",
          examCode: "CE",
        },
      });
    });

    it("makes the deep-link slug unique, at most 40 characters, cut at a word", async () => {
      const ship = await seam.createFaq(EDITOR, { ...GCASH, question: "Ship?" });
      expect(ship.ok && ship.value.faq.slug).toBe("ship-2");

      const long = await seam.createFaq(EDITOR, {
        ...GCASH,
        question: "How long does it take for an order to reach Mindanao by the courier?",
      });
      expect(long.ok && long.value.faq.slug).toBe("how-long-does-it-take-for-an-order-to");

      const symbols = await seam.createFaq(EDITOR, { ...GCASH, question: "₱?" });
      expect(symbols.ok && symbols.value.faq.slug).toBe("question");
    });

    it("numbers a new FAQ after the highest id", async () => {
      await arm.reset((seed) => {
        const last = seed.faqs.find((faq) => faq.id === "faq-018");
        if (last) last.id = "faq-099";
      });

      const result = await seam.createFaq(EDITOR, GCASH);
      expect(result.ok && result.value.faq.id).toBe("faq-100");
    });

    it("saves the toggles: hidden, app-only, popular with its chip, and the Subjects table", async () => {
      await arm.reset((seed) => {
        for (const faq of seed.faqs) faq.showCoverageTable = false;
      });
      const result = await seam.createFaq(EDITOR, {
        ...GCASH,
        quoteReviewId: "",
        quoteText: "",
        popular: true,
        popularLabel: "  GCash? ",
        requiresMemberApp: true,
        showOnFaqPage: false,
        showCoverageTable: true,
      });

      expect(result.ok && result.value.faq).toMatchObject({
        reviewQuote: null,
        popularLabel: "GCash?",
        requiresMemberApp: true,
        showOnFaqPage: false,
        showCoverageTable: true,
      });
    });

    it("keeps the question and answer, line breaks included, without the space around them", async () => {
      const result = await seam.createFaq(EDITOR, {
        ...GCASH,
        question: "  Can I pay by GCash?\n",
        answer: " Yes:\r\nthrough Shopee. ",
      });

      expect(result.ok && result.value.faq).toMatchObject({
        question: "Can I pay by GCash?",
        answer: "Yes:\nthrough Shopee.",
      });
    });

    it("appends one Staff Activity record, with nothing before", async () => {
      await seam.createFaq(EDITOR, GCASH);

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "faq",
          entityId: "faq-019",
          action: "create",
          before: null,
          after: expect.objectContaining({ question: "Can I pay by GCash?" }),
        }),
      ]);
    });

    it("refuses an empty question or answer: WRITE A QUESTION AND ANSWER TO SAVE", async () => {
      expect(await seam.createFaq(EDITOR, { ...GCASH, question: "  " })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { question: ["WRITE THE QUESTION"] },
          formError: "WRITE A QUESTION AND ANSWER TO SAVE",
        },
      });
      expect(await seam.createFaq(EDITOR, { ...GCASH, answer: "" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { answer: ["WRITE THE ANSWER"] },
          formError: "WRITE A QUESTION AND ANSWER TO SAVE",
        },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("takes an answer of 400 characters and refuses 401", async () => {
      expect((await seam.createFaq(EDITOR, { ...GCASH, answer: answerOf(400) })).ok).toBe(true);

      expect(await seam.createFaq(EDITOR, { ...GCASH, answer: answerOf(401) })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { answer: ["KEEP THE ANSWER TO 400 CHARACTERS"] } },
      });
    });

    it("refuses a quote with one character changed: not in the Review word for word", async () => {
      const result = await seam.createFaq(EDITOR, { ...GCASH, quoteText: "Quality 10/10!" });

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { quoteText: [NOT_WORD_FOR_WORD] } },
      });
    });

    it("refuses a quote from a Review whose Product is hidden from the Website", async () => {
      await arm.reset((seed) => {
        const posters = seed.products.find((p) => p.id === "prd-005");
        if (posters) posters.showOnWebsite = false;
      });

      expect(await seam.createFaq(EDITOR, GCASH)).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            quoteReviewId: ["ITS PRODUCT ISN’T ON THE WEBSITE · PICK ANOTHER REVIEW"],
          },
        },
      });
    });

    it("refuses a quote from a Review that isn't in the catalogue", async () => {
      expect(await seam.createFaq(EDITOR, { ...GCASH, quoteReviewId: "rev-999" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { quoteReviewId: ["THAT REVIEW ISN’T IN THE CATALOGUE · PICK ANOTHER"] },
        },
      });
    });

    it("refuses a quote with no Review, or a Review with no quote", async () => {
      expect(await seam.createFaq(EDITOR, { ...GCASH, quoteReviewId: "" })).toMatchObject({
        error: { fieldErrors: { quoteReviewId: ["PICK THE REVIEW IT’S FROM"] } },
      });
      expect(await seam.createFaq(EDITOR, { ...GCASH, quoteText: " " })).toMatchObject({
        error: { fieldErrors: { quoteText: ["PASTE OR SELECT THE WORDS TO QUOTE"] } },
      });
    });

    it("refuses Popular with an empty chip label, or one over 40 characters", async () => {
      expect(await seam.createFaq(EDITOR, { ...GCASH, popular: true, popularLabel: " " })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { popularLabel: ["WRITE THE CHIP LABEL"] } },
      });
      expect(
        await seam.createFaq(EDITOR, { ...GCASH, popular: true, popularLabel: "x".repeat(41) }),
      ).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { popularLabel: ["KEEP THE CHIP LABEL TO 40 CHARACTERS"] },
        },
      });
      const forty = await seam.createFaq(EDITOR, {
        ...GCASH,
        popular: true,
        popularLabel: "x".repeat(40),
      });
      expect(forty.ok && forty.value.faq.popularLabel).toBe("x".repeat(40));
    });

    it("drops the chip label when Popular is off", async () => {
      const result = await seam.createFaq(EDITOR, { ...GCASH, popularLabel: "GCash?" });

      expect(result.ok && result.value.faq.popularLabel).toBeNull();
    });

    it("refuses a second FAQ with the Subjects table, naming the one that has it", async () => {
      expect(await seam.createFaq(EDITOR, { ...GCASH, showCoverageTable: true })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            showCoverageTable: [
              "“What subjects does each exam’s reviewer cover?” SHOWS IT · ONLY ONE QUESTION CAN",
            ],
          },
        },
      });
    });

    it("refuses a group that isn't one of the 5", async () => {
      expect(
        await seam.createFaq(EDITOR, { ...GCASH, group: "returns" as FaqGroup }),
      ).toMatchObject({ error: { kind: "invalid", fieldErrors: { group: ["CHOOSE A GROUP"] } } });
    });
  });

  describe("updateFaq", () => {
    it("saves the editor's fields: live on the FAQ page and in its order", async () => {
      vi.setSystemTime(at(MINUTE));
      const result = await edit("faq-002", {
        question: "Do you ship to every province?",
        answer: "Yes, nationwide.",
        popular: true,
        popularLabel: "Shipping time?",
      });

      expect(result).toEqual({
        ok: true,
        value: {
          faq: expect.objectContaining({
            id: "faq-002",
            order: 2,
            question: "Do you ship to every province?",
            popularLabel: "Shipping time?",
          }),
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name },
        },
        tags: ["catalogue:faqs"],
      });
      expect((await websiteFaqs()).find((faq) => faq.id === "faq-002")).toMatchObject({
        question: "Do you ship to every province?",
        popularLabel: "Shipping time?",
      });
    });

    it("never changes the slug, even when the question changes", async () => {
      const result = await edit("faq-001", { question: "Where is the warehouse?" });

      expect(result.ok && result.value.faq.slug).toBe("ship");
    });

    it("hides an FAQ from the FAQ page with Show on FAQ page off", async () => {
      await edit("faq-002", { showOnFaqPage: false });

      expect(await websiteGroup("shipping")).toEqual(["faq-001", "faq-003"]);
      expect(await groupIds("shipping")).toEqual(SEED.shipping);
    });

    it("moves an FAQ to another group: last there, and its old group closes the gap", async () => {
      const result = await edit("faq-004", { group: "coverage" });

      expect(result.ok && result.value.faq).toMatchObject({ group: "coverage", order: 5 });
      expect(await groupIds("coverage")).toEqual([...SEED.coverage, "faq-004"]);
      const paper = (await list({ group: "paper" })).rows;
      expect(paper.map((faq) => [faq.id, faq.order])).toEqual([
        ["faq-005", 1],
        ["faq-006", 2],
      ]);
      expect(await websiteGroup("coverage")).toEqual([...SEED.coverage, "faq-004"]);
    });

    it("keeps a quote whose Review's Product was hidden since, while the quote is unchanged", async () => {
      await arm.reset((seed) => {
        const posters = seed.products.find((p) => p.id === "prd-005");
        if (posters) posters.showOnWebsite = false;
      });

      const result = await edit("faq-005", { answer: "A3 size." });
      expect(result.ok && result.value.faq.reviewQuote?.reviewId).toBe(POSTERS_REVIEW);
    });

    it("refuses a quote changed to words that aren't in the Review", async () => {
      expect(await edit("faq-005", { quoteText: "Glossy type yung paper, makapal siya." })).toEqual(
        {
          ok: false,
          error: { kind: "invalid", fieldErrors: { quoteText: [NOT_WORD_FOR_WORD] } },
        },
      );
    });

    it("removes the quote", async () => {
      const result = await edit("faq-005", { quoteReviewId: "", quoteText: "" });

      expect(result.ok && result.value.faq.reviewQuote).toBeNull();
    });

    it("lets the FAQ with the Subjects table keep it", async () => {
      expect((await edit("faq-007", { answer: "Each reviewer follows its board." })).ok).toBe(true);
    });

    it("refuses a stale save: someone saved after the editor opened", async () => {
      const { faq, stamp } = await opened("faq-002");
      vi.setSystemTime(at(MINUTE));
      await edit("faq-002", { answer: "Yes." }, OWNER);

      const result = await seam.updateFaq(
        EDITOR,
        "faq-002",
        { ...faqFormValues(faq), answer: "Yes, everywhere." },
        { savedAt: stamp.savedAt },
      );

      expect(result).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
      expect((await opened("faq-002")).faq.answer).toBe("Yes.");
    });

    it("isn't made stale by ▲▼", async () => {
      const { faq, stamp } = await opened("faq-002");
      await seam.moveFaq(OWNER, "faq-002", "up");

      const result = await seam.updateFaq(
        EDITOR,
        "faq-002",
        { ...faqFormValues(faq), answer: "Yes." },
        { savedAt: stamp.savedAt },
      );

      expect(result.ok && result.value.faq.order).toBe(1);
    });

    it("refuses an FAQ deleted elsewhere as not found", async () => {
      const { faq, stamp } = await opened("faq-002");
      await seam.deleteFaq(OWNER, "faq-002");

      expect(
        await seam.updateFaq(EDITOR, "faq-002", faqFormValues(faq), { savedAt: stamp.savedAt }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });

    it("refuses the field rules as createFaq does", async () => {
      expect(await edit("faq-002", { question: "", answer: answerOf(401) })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            question: ["WRITE THE QUESTION"],
            answer: ["KEEP THE ANSWER TO 400 CHARACTERS"],
          },
          formError: "WRITE A QUESTION AND ANSWER TO SAVE",
        },
      });
    });

    it("appends one Staff Activity record, with the FAQ before and after", async () => {
      await edit("faq-002", { answer: "Yes." });

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "faq",
          entityId: "faq-002",
          action: "update",
          before: expect.objectContaining({ answer: expect.stringContaining("nationwide") }),
          after: expect.objectContaining({ answer: "Yes." }),
        }),
      ]);
    });
  });

  describe("moveFaq: ▲▼ within a group", () => {
    it("moves the first Shipping question down: live on the FAQ page", async () => {
      const result = await seam.moveFaq(EDITOR, "faq-001", "down");

      expect(result).toEqual({
        ok: true,
        value: ["faq-002", "faq-001", "faq-003"],
        tags: ["catalogue:faqs"],
      });
      expect(await websiteGroup("shipping")).toEqual(["faq-002", "faq-001", "faq-003"]);
    });

    it("moves an FAQ up", async () => {
      await seam.moveFaq(EDITOR, "faq-016", "up");

      expect(await groupIds("buying")).toEqual([
        "faq-011",
        "faq-012",
        "faq-013",
        "faq-014",
        "faq-016",
        "faq-015",
      ]);
    });

    it("refuses ▲ on the first and ▼ on the last, with nothing changed", async () => {
      expect(await seam.moveFaq(EDITOR, "faq-001", "up")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY FIRST IN ITS GROUP" },
      });
      expect(await seam.moveFaq(EDITOR, "faq-003", "down")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY LAST IN ITS GROUP" },
      });
      expect(await groupIds("shipping")).toEqual(SEED.shipping);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an FAQ deleted elsewhere as not found", async () => {
      await seam.deleteFaq(OWNER, "faq-002");

      expect(await seam.moveFaq(EDITOR, "faq-002", "up")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses a way that isn't up or down", async () => {
      expect(await seam.moveFaq(EDITOR, "faq-002", "left" as "up")).toMatchObject({
        error: { kind: "invalid", fieldErrors: { direction: ["SHOULD BE UP OR DOWN"] } },
      });
    });

    it("appends one Staff Activity record, with the group's order before and after", async () => {
      await seam.moveFaq(EDITOR, "faq-001", "down");

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "faq",
          entityId: "faq-001",
          action: "move",
          before: SEED.shipping,
          after: ["faq-002", "faq-001", "faq-003"],
        }),
      ]);
    });
  });

  describe("deleteFaq", () => {
    it("deletes an FAQ from the FAQ page and closes the gap in its group", async () => {
      const result = await seam.deleteFaq(EDITOR, "faq-001");

      expect(result).toEqual({ ok: true, value: { id: "faq-001" }, tags: ["catalogue:faqs"] });
      expect(await seam.getFaqForAdmin(EDITOR, "faq-001")).toBeNull();
      const shipping = (await list({ group: "shipping" })).rows;
      expect(shipping.map((faq) => [faq.id, faq.order])).toEqual([
        ["faq-002", 1],
        ["faq-003", 2],
      ]);
      expect(await websiteGroup("shipping")).toEqual(["faq-002", "faq-003"]);
      expect((await list()).groups[0]).toEqual({ group: "shipping", title: "Shipping", count: 2 });
    });

    it("keeps the FAQ from before in Staff Activity", async () => {
      await seam.deleteFaq(EDITOR, "faq-005");

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "faq",
          entityId: "faq-005",
          action: "delete",
          before: expect.objectContaining({ question: "What are the posters like?" }),
          after: null,
        }),
      ]);
    });

    it("refuses an FAQ already deleted as not found", async () => {
      await seam.deleteFaq(OWNER, "faq-001");

      expect(await seam.deleteFaq(EDITOR, "faq-001")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });
});
