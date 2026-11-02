import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newReviewForm, reviewFormValues } from "@/lib/admin/review-form";
import type { NewReviewForm, ReviewForm } from "@/services/admin.schema";
import type { AdminReviewRow, StaffActor } from "@/services/admin.types";
import { listFaqs, listHomeReviews, listReviews } from "@/services/catalogue";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's Reviews area, run against every arm (spec, Phase 2 →
// Reviews, Deleting, Conflict check; stories 70–72): the list an Editor
// filters, the editor's add and save, the HOME pin and the Home order's ▲▼,
// and delete, which takes the FAQ quotes from the Review with it. Every save
// is live on the Website. Each test boots the data at BOOT with a fake clock.
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

/** The seed's Home order: its nine pinned Reviews, first to last. */
const HOME_ORDER = [
  "rev-013",
  "rev-006",
  "rev-001",
  "rev-009",
  "rev-016",
  "rev-014",
  "rev-011",
  "rev-007",
  "rev-004",
];
const ALL_REVIEWS = Array.from({ length: 16 }, (_, i) => `rev-${String(i + 1).padStart(3, "0")}`);

/** rev-014, on the posters, is quoted by "What are the posters like?". */
const QUOTED = "rev-014";
const QUOTE = "Glossy type yung paper, makapal sya.";
const POSTERS_FAQ = "What are the posters like?";
const POSTERS_SLUG = "ultimate-ce-posters-2-0";
const CARDS_SLUG = "ce-formula-flash-cards";

/** A 5★ Review of CE Formula Flash Cards from Lazada, with 3 helpful votes. */
const LAZADA_REVIEW: NewReviewForm = {
  ...newReviewForm("prd-001"),
  stars: 5,
  text: "Sulit! Dumating agad.\nAng linaw ng formulas.",
  marketplace: "lazada",
  helpful: "3",
};

const ids = (rows: AdminReviewRow[]) => rows.map((row) => row.review.id);

describe.each(ADMIN_ARMS)("Admin seam: Reviews ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const list = (query = {}) => seam.listReviewsForAdmin(EDITOR, query);
  const opened = async (id: string) => {
    const review = await seam.getReviewForAdmin(EDITOR, id);
    if (!review) throw new Error(`${id} isn't in the catalogue`);
    return review;
  };
  /** Saves the Review with these of its editor's fields changed. */
  const edit = async (id: string, changes: Partial<ReviewForm>, actor = EDITOR) => {
    const { review, stamp } = await opened(id);
    return seam.updateReview(
      actor,
      id,
      { ...reviewFormValues(review), ...changes },
      { savedAt: stamp.savedAt },
    );
  };
  const homeIds = async () => (await listHomeReviews()).map((review) => review.id);
  const websiteReview = async (id: string) =>
    (await listReviews()).items.find((review) => review.id === id);
  const postersFaq = async () =>
    (await listFaqs()).flatMap((group) => group.items).find((faq) => faq.question === POSTERS_FAQ);

  describe("listReviewsForAdmin", () => {
    it("lists every Review in the catalogue's order, with its Product, and the counters", async () => {
      const result = await list();

      expect(ids(result.rows)).toEqual(ALL_REVIEWS);
      expect(result.total).toBe(16);
      expect(result.query).toEqual({ q: null, exam: null, stars: null, pinned: false });
      expect(result.examCodes).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
      expect(result.homeOrder).toEqual(HOME_ORDER);
      expect(result.pinnedOnHome).toBe(9);
      expect(result.rows[13]).toEqual({
        review: {
          id: QUOTED,
          productId: "prd-005",
          stars: 5,
          text: expect.stringContaining(QUOTE),
          variation: "MSTC, HPGE, PSAD",
          helpful: 0,
          marketplace: "shopee",
          homePin: 6,
        },
        product: { shortName: "Ultimate CE Posters 2.0", examCode: "CE" },
      });
    });

    it("gives the Live Products for the editor, with their variations as a buyer sees them", async () => {
      const { products } = await list();

      expect(products.map((product) => product.id)).toEqual([
        "prd-001",
        "prd-002",
        "prd-003",
        "prd-004",
        "prd-005",
        "prd-006",
        "prd-007",
        "prd-008",
      ]);
      expect(products[4]).toEqual({
        id: "prd-005",
        slug: POSTERS_SLUG,
        examCode: "CE",
        shortName: "Ultimate CE Posters 2.0",
        variations: ["MSTC, HPGE, PSAD", "MSTC ONLY", "HPGE ONLY", "PSAD ONLY"],
      });
    });

    it("searches the text, case-insensitively, with the search trimmed", async () => {
      const result = await list({ q: "  GLOSSY " });

      expect(ids(result.rows)).toEqual([QUOTED]);
      expect(result.query.q).toBe("GLOSSY");
    });

    it("filters by Exam, in any case, and ignores an Exam that isn't in the catalogue", async () => {
      const ce = await list({ exam: "ce" });
      expect(ids(ce.rows)).toEqual([
        "rev-001",
        "rev-002",
        "rev-003",
        "rev-004",
        "rev-005",
        "rev-013",
        "rev-014",
        "rev-015",
      ]);
      expect(ce.query.exam).toBe("CE");

      const unknown = await list({ exam: "LAW" });
      expect(unknown.rows).toHaveLength(16);
      expect(unknown.query.exam).toBeNull();
    });

    it("filters by stars: 5★, 4★, and 3★ and below", async () => {
      expect(ids((await list({ stars: "5" })).rows)).toEqual(
        ALL_REVIEWS.filter((id) => id !== "rev-016"),
      );
      expect((await list({ stars: "4" })).rows).toEqual([]);
      expect(ids((await list({ stars: "3-or-less" })).rows)).toEqual(["rev-016"]);
    });

    it("lists only the pinned Reviews with “Pinned on Home only”, in the Home order", async () => {
      const result = await list({ pinned: true });

      expect(ids(result.rows)).toEqual(HOME_ORDER);
      expect(result.query.pinned).toBe(true);
    });

    it("combines the filters", async () => {
      expect(ids((await list({ q: "glossy", exam: "CE", stars: "5" })).rows)).toEqual([QUOTED]);
      expect((await list({ q: "glossy", exam: "ME" })).rows).toEqual([]);
      expect(ids((await list({ exam: "MT", pinned: true })).rows)).toEqual(["rev-016"]);
      const none = await list({ q: "glossy", stars: "3-or-less" });
      expect(none.rows).toEqual([]);
      expect(none.total).toBe(16);
    });

    it("lists a hidden Product's Reviews too", async () => {
      await arm.reset((seed) => {
        const cards = seed.products.find((p) => p.id === "prd-001");
        if (cards) cards.showOnWebsite = false;
      });

      expect(ids((await list({ exam: "CE" })).rows)).toContain("rev-001");
      expect(await websiteReview("rev-001")).toBeUndefined();
    });

    it("counts only the pins Home can show: a hidden Product's stay in the order but not on Home", async () => {
      await arm.reset((seed) => {
        const cards = seed.products.find((p) => p.id === "prd-001");
        if (cards) cards.showOnWebsite = false;
      });

      const result = await list();
      // rev-001 and rev-004 are on the hidden flash cards.
      expect(result.homeOrder).toEqual(HOME_ORDER);
      expect(result.pinnedOnHome).toBe(7);
      expect(await homeIds()).toEqual(
        HOME_ORDER.filter((id) => id !== "rev-001" && id !== "rev-004"),
      );
    });
  });

  describe("getReviewForAdmin", () => {
    it("opens a Review with every field and its stamp", async () => {
      expect(await seam.getReviewForAdmin(EDITOR, "rev-016")).toEqual({
        review: expect.objectContaining({ id: "rev-016", stars: 3, homePin: 5 }),
        stamp: { savedAt: BOOT.toISOString(), savedBy: null },
      });
    });

    it("gives null for a Review that isn't in the catalogue", async () => {
      expect(await seam.getReviewForAdmin(EDITOR, "rev-999")).toBeNull();
    });
  });

  describe("createReview", () => {
    it("adds a Review: live on its Product page, its Exam page and /reviews", async () => {
      vi.setSystemTime(at(MINUTE));
      const result = await seam.createReview(EDITOR, LAZADA_REVIEW);

      expect(result).toEqual({
        ok: true,
        value: {
          review: {
            id: "rev-017",
            productId: "prd-001",
            stars: 5,
            text: LAZADA_REVIEW.text,
            variation: null,
            helpful: 3,
            marketplace: "lazada",
            homePin: null,
          },
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name },
        },
        tags: ["catalogue:reviews"],
      });
      const onProductPage = await listReviews({ productSlug: CARDS_SLUG });
      expect(onProductPage.items.map((review) => review.id)).toContain("rev-017");
      expect((await listReviews({ examCode: "CE" })).items.map((r) => r.id)).toContain("rev-017");
      expect(await websiteReview("rev-017")).toMatchObject({
        marketplace: "lazada",
        product: { slug: CARDS_SLUG, shortName: "CE Formula Flash Cards", examCode: "CE" },
      });
      expect(await homeIds()).toEqual(HOME_ORDER);
    });

    it("numbers a new Review after the highest id, as the seed does", async () => {
      await arm.reset((seed) => {
        const last = seed.reviews.find((review) => review.id === "rev-016");
        if (last) last.id = "rev-099";
      });

      const result = await seam.createReview(EDITOR, LAZADA_REVIEW);
      expect(result.ok && result.value.review.id).toBe("rev-100");
    });

    it("adds a pinned Review at the end of the Home order", async () => {
      const result = await seam.createReview(EDITOR, { ...LAZADA_REVIEW, pinned: true });

      expect(result.ok && result.value.review.homePin).toBe(10);
      expect((await list()).homeOrder).toEqual([...HOME_ORDER, "rev-017"]);
      // Home shows the first 9.
      expect(await homeIds()).toEqual(HOME_ORDER);
    });

    it("keeps the text word for word, with its line breaks, without the space around it", async () => {
      const result = await seam.createReview(EDITOR, {
        ...LAZADA_REVIEW,
        text: "  Quality: Good\r\n\r\nSulit  talaga 💯\n",
      });

      expect(result.ok && result.value.review.text).toBe("Quality: Good\n\nSulit  talaga 💯");
    });

    it("saves one of the Product's variations, and blank helpful votes as 0", async () => {
      const result = await seam.createReview(EDITOR, {
        ...newReviewForm("prd-005"),
        text: "Ganda ng posters",
        variation: "MSTC ONLY",
        helpful: "",
      });

      expect(result.ok && result.value.review).toMatchObject({
        productId: "prd-005",
        variation: "MSTC ONLY",
        helpful: 0,
        marketplace: "shopee",
      });
    });

    it("appends one Staff Activity record, with nothing before", async () => {
      await seam.createReview(OWNER, LAZADA_REVIEW);

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "review",
          entityId: "rev-017",
          action: "create",
          before: null,
          after: expect.objectContaining({ id: "rev-017", marketplace: "lazada" }),
        }),
      ]);
    });

    it("refuses a Review with no text: PASTE THE REVIEW TEXT TO SAVE", async () => {
      const result = await seam.createReview(EDITOR, { ...LAZADA_REVIEW, text: " \n " });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { text: ["PASTE THE REVIEW TEXT"] },
          formError: "PASTE THE REVIEW TEXT TO SAVE",
        },
      });
      expect((await list()).total).toBe(16);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it.each([0, 6, 2.5, Number.NaN])("refuses %s stars", async (stars) => {
      expect(await seam.createReview(EDITOR, { ...LAZADA_REVIEW, stars })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { stars: ["CHOOSE 1 TO 5 STARS"] } },
      });
    });

    it.each(["-1", "2.5", "many"])("refuses %s helpful votes", async (helpful) => {
      expect(await seam.createReview(EDITOR, { ...LAZADA_REVIEW, helpful })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { helpful: ["ENTER A WHOLE NUMBER, 0 OR MORE"] } },
      });
    });

    it("refuses a Coming Soon Product, which has no Reviews", async () => {
      expect(await seam.createReview(EDITOR, { ...LAZADA_REVIEW, productId: "prd-009" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { productId: ["COMING SOON PRODUCTS CAN’T HAVE REVIEWS"] },
        },
      });
    });

    it("refuses a Product that isn't in the catalogue, or none", async () => {
      const unknown = await seam.createReview(EDITOR, { ...LAZADA_REVIEW, productId: "prd-999" });
      expect(unknown).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { productId: ["CHOOSE A PRODUCT"] } },
      });
      const none = await seam.createReview(EDITOR, { ...LAZADA_REVIEW, productId: " " });
      expect(none).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { productId: ["CHOOSE A PRODUCT"] } },
      });
    });

    it("refuses a variation the Product doesn't have", async () => {
      const result = await seam.createReview(EDITOR, { ...LAZADA_REVIEW, variation: "MSTC ONLY" });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { variation: ["NOT A VARIATION OF CE FORMULA FLASH CARDS"] },
        },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a Marketplace that isn't Shopee, Lazada or TikTok Shop", async () => {
      const result = await seam.createReview(EDITOR, {
        ...LAZADA_REVIEW,
        marketplace: "amazon" as ReviewForm["marketplace"],
      });

      expect(result).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { marketplace: ["CHOOSE A STORE"] } },
      });
    });
  });

  describe("updateReview", () => {
    it("saves the editor's fields: live on its Product page and /reviews", async () => {
      vi.setSystemTime(at(5 * MINUTE));
      const result = await edit("rev-015", {
        stars: 4,
        text: "Legit seller.\nFast delivery.",
        variation: "PSAD ONLY",
        marketplace: "tiktok",
        helpful: "12",
      });

      expect(result).toEqual({
        ok: true,
        value: {
          review: {
            id: "rev-015",
            productId: "prd-005",
            stars: 4,
            text: "Legit seller.\nFast delivery.",
            variation: "PSAD ONLY",
            helpful: 12,
            marketplace: "tiktok",
            homePin: null,
          },
          stamp: { savedAt: at(5 * MINUTE).toISOString(), savedBy: EDITOR.name },
        },
        tags: ["catalogue:reviews"],
      });
      const onPage = await listReviews({ productSlug: POSTERS_SLUG, stars: "4" });
      expect(onPage.items.map((review) => review.id)).toEqual(["rev-015"]);
    });

    it("keeps its place in the Home order", async () => {
      await edit("rev-001", { helpful: "40" });

      expect(await homeIds()).toEqual(HOME_ORDER);
      expect((await opened("rev-001")).review.homePin).toBe(3);
    });

    it("moves a Review to another Product, live on that Product's page", async () => {
      await edit("rev-002", { productId: "prd-008" });

      const onBundle = await listReviews({ productSlug: "ce-review-bundle-3-in-1" });
      expect(onBundle.items.map((review) => review.id)).toEqual(["rev-002"]);
      expect((await listReviews({ productSlug: CARDS_SLUG })).items.map((r) => r.id)).not.toContain(
        "rev-002",
      );
    });

    it("keeps a variation copied from the store that isn't one of the Product's", async () => {
      // rev-001 was copied from Shopee as "MSTC, HPGE, PSAD,160 gsm".
      const result = await edit("rev-001", { stars: 4 });

      expect(result.ok && result.value.review.variation).toBe("MSTC, HPGE, PSAD,160 gsm");
    });

    it("refuses that variation on another Product", async () => {
      const result = await edit("rev-001", { productId: "prd-008" });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { variation: ["NOT A VARIATION OF CE REVIEW BUNDLE 3-IN-1"] },
        },
      });
    });

    it("clears the variation to Not specified", async () => {
      const result = await edit("rev-001", { variation: "" });

      expect(result.ok && result.value.review.variation).toBeNull();
    });

    it("refuses an edit that removes the words an FAQ quotes, naming the FAQ, with nothing changed", async () => {
      const before = await opened(QUOTED);
      const result = await edit(QUOTED, { text: "Glossy paper. Quality 10/10." });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError:
            "The FAQ “What are the posters like?” quotes this Review. Edit that quote first.",
        },
      });
      expect(await opened(QUOTED)).toEqual(before);
      expect((await postersFaq())?.reviewQuote?.reviewId).toBe(QUOTED);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("saves an edit that keeps the quoted words, and the FAQ keeps its quote", async () => {
      const { review } = await opened(QUOTED);
      const result = await edit(QUOTED, { text: `${review.text}\nWould buy again.`, stars: 4 });

      expect(result.ok).toBe(true);
      expect((await postersFaq())?.reviewQuote).toMatchObject({ reviewId: QUOTED, stars: 4 });
    });

    it("refuses Coming Soon Products and the field rules as createReview does", async () => {
      expect(await edit("rev-002", { productId: "prd-009" })).toMatchObject({
        ok: false,
        error: { fieldErrors: { productId: ["COMING SOON PRODUCTS CAN’T HAVE REVIEWS"] } },
      });
      expect(await edit("rev-002", { text: "", stars: 6, helpful: "-1" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            text: ["PASTE THE REVIEW TEXT"],
            stars: ["CHOOSE 1 TO 5 STARS"],
            helpful: ["ENTER A WHOLE NUMBER, 0 OR MORE"],
          },
          formError: "PASTE THE REVIEW TEXT TO SAVE",
        },
      });
    });

    it("refuses a stale save: someone saved after the editor opened", async () => {
      const { review, stamp } = await opened("rev-002");
      vi.setSystemTime(at(2 * MINUTE));
      await edit("rev-002", { helpful: "9" }, OWNER);

      const stale = await seam.updateReview(
        EDITOR,
        "rev-002",
        { ...reviewFormValues(review), stars: 1 },
        { savedAt: stamp.savedAt },
      );

      expect(stale).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(2 * MINUTE).toISOString() },
      });
      expect((await opened("rev-002")).review).toMatchObject({ stars: 5, helpful: 9 });
    });

    it("isn't made stale by the HOME switch, a single toggle", async () => {
      const { review, stamp } = await opened("rev-002");
      await seam.setReviewPinned(OWNER, "rev-002", true);

      const result = await seam.updateReview(
        EDITOR,
        "rev-002",
        { ...reviewFormValues(review), stars: 4 },
        { savedAt: stamp.savedAt },
      );
      expect(result.ok && result.value.review).toMatchObject({ stars: 4, homePin: 10 });
    });

    it("refuses a Review deleted elsewhere as not found", async () => {
      const { review, stamp } = await opened("rev-002");
      await arm.deleteReviewElsewhere("rev-002");

      expect(
        await seam.updateReview(EDITOR, "rev-002", reviewFormValues(review), {
          savedAt: stamp.savedAt,
        }),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });

    it("appends one Staff Activity record, with the Review before and after", async () => {
      const { review: before } = await opened("rev-002");
      await edit("rev-002", { stars: 2 });

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "review",
          entityId: "rev-002",
          action: "update",
          before,
          after: { ...before, stars: 2 },
        }),
      ]);
    });
  });

  describe("setReviewPinned: the HOME switch", () => {
    it("pins a Review at the end of the Home order; Home still shows the first 9", async () => {
      const result = await seam.setReviewPinned(EDITOR, "rev-002", true);

      expect(result).toEqual({
        ok: true,
        value: {
          review: expect.objectContaining({ id: "rev-002", homePin: 10 }),
          stamp: { savedAt: BOOT.toISOString(), savedBy: null },
        },
        tags: ["catalogue:reviews"],
      });
      const { homeOrder } = await list();
      expect(homeOrder).toEqual([...HOME_ORDER, "rev-002"]);
      expect(homeOrder).toHaveLength(10);
      expect(await homeIds()).toEqual(HOME_ORDER);
    });

    it("unpins a Review: it leaves the Home order and Home", async () => {
      await seam.setReviewPinned(EDITOR, "rev-001", false);

      const without = HOME_ORDER.filter((id) => id !== "rev-001");
      expect((await list()).homeOrder).toEqual(without);
      expect(await homeIds()).toEqual(without);
      expect((await opened("rev-001")).review.homePin).toBeNull();
    });

    it("pins after the last pin, even when the order has gaps", async () => {
      await seam.setReviewPinned(EDITOR, "rev-004", false);
      await seam.setReviewPinned(EDITOR, "rev-002", true);
      await seam.setReviewPinned(EDITOR, "rev-003", true);

      expect((await list()).homeOrder).toEqual([
        ...HOME_ORDER.filter((id) => id !== "rev-004"),
        "rev-002",
        "rev-003",
      ]);
    });

    it("leaves a pinned Review in its place when it's pinned again", async () => {
      await seam.setReviewPinned(EDITOR, "rev-006", true);

      expect((await list()).homeOrder).toEqual(HOME_ORDER);
    });

    it("always saves, and doesn't change the stamp the editor checks", async () => {
      await seam.setReviewPinned(EDITOR, "rev-002", true);
      await seam.setReviewPinned(OWNER, "rev-002", false);

      expect((await opened("rev-002")).stamp).toEqual({
        savedAt: BOOT.toISOString(),
        savedBy: null,
      });
    });

    it("appends one Staff Activity record, with the pin before and after", async () => {
      await seam.setReviewPinned(EDITOR, "rev-002", true);

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "review",
          entityId: "rev-002",
          action: "set-home-pin",
          before: { homePin: null },
          after: { homePin: 10 },
        }),
      ]);
    });

    it("refuses a Review deleted elsewhere as not found", async () => {
      await arm.deleteReviewElsewhere("rev-002");

      expect(await seam.setReviewPinned(EDITOR, "rev-002", true)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a pin that isn't on or off", async () => {
      expect(
        await seam.setReviewPinned(EDITOR, "rev-002", "yes" as unknown as boolean),
      ).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { pinned: ["SHOULD BE ON OR OFF"] } },
      });
    });
  });

  describe("moveReviewPin: ▲▼ in the Home order", () => {
    it("moves a Review one place up: live on Home", async () => {
      const result = await seam.moveReviewPin(EDITOR, "rev-006", "up");
      const moved = ["rev-006", "rev-013", ...HOME_ORDER.slice(2)];

      expect(result).toEqual({ ok: true, value: moved, tags: ["catalogue:reviews"] });
      expect(await homeIds()).toEqual(moved);
      expect(ids((await list({ pinned: true })).rows)).toEqual(moved);
    });

    it("moves a Review one place down", async () => {
      const result = await seam.moveReviewPin(EDITOR, "rev-013", "down");

      expect(result.ok && result.value).toEqual(["rev-006", "rev-013", ...HOME_ORDER.slice(2)]);
    });

    it("moves the 10th pinned Review onto Home by moving it up", async () => {
      await seam.setReviewPinned(EDITOR, "rev-002", true);
      await seam.moveReviewPin(EDITOR, "rev-002", "up");

      expect(await homeIds()).toEqual([...HOME_ORDER.slice(0, 8), "rev-002"]);
    });

    it("moves past a gap left by an unpinned Review", async () => {
      await seam.setReviewPinned(EDITOR, "rev-006", false);
      const result = await seam.moveReviewPin(EDITOR, "rev-001", "up");

      expect(result.ok && result.value).toEqual(["rev-001", "rev-013", ...HOME_ORDER.slice(3)]);
    });

    it("refuses moving the first one up and the last one down, with nothing changed", async () => {
      expect(await seam.moveReviewPin(EDITOR, "rev-013", "up")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY FIRST ON HOME" },
      });
      expect(await seam.moveReviewPin(EDITOR, "rev-004", "down")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "IT’S ALREADY LAST ON HOME" },
      });
      expect((await list()).homeOrder).toEqual(HOME_ORDER);
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses moving a Review that isn't pinned", async () => {
      expect(await seam.moveReviewPin(EDITOR, "rev-002", "up")).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "PIN IT ON HOME FIRST" },
      });
    });

    it("refuses a Review deleted elsewhere as not found", async () => {
      await arm.deleteReviewElsewhere("rev-006");

      expect(await seam.moveReviewPin(EDITOR, "rev-006", "up")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses a way that isn't up or down", async () => {
      expect(await seam.moveReviewPin(EDITOR, "rev-006", "left" as unknown as "up")).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { direction: ["SHOULD BE UP OR DOWN"] } },
      });
    });

    it("appends one Staff Activity record, with the Home order before and after", async () => {
      await seam.moveReviewPin(EDITOR, "rev-006", "up");

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "review",
          entityId: "rev-006",
          action: "move-home-pin",
          before: HOME_ORDER,
          after: ["rev-006", "rev-013", ...HOME_ORDER.slice(2)],
        }),
      ]);
    });
  });

  describe("previewReviewDelete and deleteReview", () => {
    it("counts the FAQ quotes taken from a Review", async () => {
      expect(await seam.previewReviewDelete(EDITOR, QUOTED)).toEqual({ faqQuotes: 1 });
      expect(await seam.previewReviewDelete(EDITOR, "rev-001")).toEqual({ faqQuotes: 0 });
      expect(await seam.previewReviewDelete(EDITOR, "rev-999")).toBeNull();
    });

    it("deletes a Review from the Website and Home, and removes its FAQ quotes", async () => {
      const result = await seam.deleteReview(EDITOR, QUOTED);

      expect(result).toEqual({
        ok: true,
        value: { id: QUOTED, faqQuotes: 1 },
        tags: ["catalogue:reviews", "catalogue:faqs"],
      });
      expect(await seam.getReviewForAdmin(EDITOR, QUOTED)).toBeNull();
      expect(await websiteReview(QUOTED)).toBeUndefined();
      expect(await homeIds()).toEqual(HOME_ORDER.filter((id) => id !== QUOTED));
      // The FAQ stays, without its quote.
      expect(await postersFaq()).toMatchObject({ question: POSTERS_FAQ, reviewQuote: null });
    });

    it("deletes a Review no FAQ quotes", async () => {
      expect(await seam.deleteReview(OWNER, "rev-002")).toMatchObject({
        ok: true,
        value: { id: "rev-002", faqQuotes: 0 },
      });
      expect((await list()).total).toBe(15);
    });

    it("keeps the values from before in Staff Activity: the Review and the FAQs quoting it", async () => {
      const { review } = await opened(QUOTED);
      await seam.deleteReview(EDITOR, QUOTED);

      const [record] = await arm.staffActivity();
      expect(record).toMatchObject({
        entity: "review",
        entityId: QUOTED,
        action: "delete",
        before: {
          review,
          faqQuotes: [
            expect.objectContaining({
              question: POSTERS_FAQ,
              reviewQuote: expect.objectContaining({ reviewId: QUOTED }),
            }),
          ],
        },
        after: null,
      });
    });

    it("refuses a Review deleted elsewhere as not found", async () => {
      await arm.deleteReviewElsewhere("rev-002");

      expect(await seam.deleteReview(EDITOR, "rev-002")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });
});
