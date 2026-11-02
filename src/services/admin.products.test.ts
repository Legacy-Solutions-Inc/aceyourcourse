import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { newProductForm, productFormValues } from "@/lib/admin/product-form";
import type { NewProductForm, ProductForm } from "@/services/admin.schema";
import type { AdminProductRow, StaffActor } from "@/services/admin.types";
import {
  getProductBySlug,
  listBestSellers,
  listExams,
  listFaqs,
  listHomeReviews,
  listProducts,
  listReviews,
} from "@/services/catalogue";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's Products area, run against every arm: the Products list an
// Editor filters (spec, Phase 2 → Products: the list; stories 63, 66), and its
// inline "Show on website" and "Available in app" toggles, which always save
// and go live on the Website (Live on save; Conflict check). Each test boots the
// data at BOOT with a fake clock.
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

// The seed's Live Products by units sold (764, 404, 273, 240, 172, 96, 18, 16),
// then its Coming Soon Products by title.
const LIVE_BY_SOLD = [
  "prd-001",
  "prd-002",
  "prd-003",
  "prd-004",
  "prd-005",
  "prd-006",
  "prd-007",
  "prd-008",
];
const COMING_SOON_BY_TITLE = [
  "prd-009", // Civil Engineering Solving Notebook
  "prd-012", // Electrical Engineering Notebook
  "prd-013", // Electrical Engineering Posters
  "prd-010", // Mechanical Engineering Notebook
  "prd-011", // Mechanical Engineering Posters
  "prd-014", // Medical Technology Essentials Flash Cards
  "prd-015", // Medical Technology Essentials Posters
];

const POSTERS = "ultimate-ce-posters-2-0";

const ids = (rows: AdminProductRow[]) => rows.map((row) => row.id);

describe.each(ADMIN_ARMS)("Admin seam: Products ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const list = (query = {}) => seam.listProductsForAdmin(EDITOR, query);
  const rowOf = async (id: string) => (await list()).rows.find((row) => row.id === id);

  describe("listProductsForAdmin: the rows", () => {
    it("lists every Product: Live ones by units sold, then Coming Soon by title", async () => {
      const result = await list();

      expect(ids(result.rows)).toEqual([...LIVE_BY_SOLD, ...COMING_SOON_BY_TITLE]);
      expect(result.total).toBe(15);
      expect(result.query).toEqual({ q: null, exam: null, missing: false });
      expect(result.examCodes).toEqual(["CE", "ME", "EE", "MT", "CPA"]);
    });

    it("breaks a tie in units sold by title", async () => {
      // CPA Flash Cards ("Certified Public Accountant…") ties ME Formula Flash Cards.
      await arm.reset((seed) => {
        const cpa = seed.products.find((p) => p.id === "prd-003");
        if (cpa?.shopee) cpa.shopee.unitsSold = 404;
      });

      expect(ids((await list()).rows).slice(0, 3)).toEqual(["prd-001", "prd-003", "prd-002"]);
    });

    it("lists a Product hidden from the Website too, with its flags", async () => {
      await arm.reset((seed) => {
        const cards = seed.products.find((p) => p.id === "prd-001");
        if (cards) cards.showOnWebsite = false;
      });

      expect(await rowOf("prd-001")).toMatchObject({ showOnWebsite: false, availableInApp: true });
    });

    it("gives a Live Product's row: price range, units sold, cover, store links and stamp", async () => {
      expect(await rowOf("prd-005")).toEqual({
        id: "prd-005",
        slug: POSTERS,
        title: "Ultimate Civil Engineering Posters",
        shortName: "Ultimate CE Posters 2.0",
        examCode: "CE",
        format: "posters",
        state: "live",
        priceFrom: 40000,
        priceTo: 125000,
        unitsSold: 172,
        cover: { src: `/products/${POSTERS}/1.webp`, alt: expect.any(String) },
        // Only a Shopee Listing: Lazada and TikTok Shop open the shop pages.
        storeLinks: { shopee: "product", lazada: "shop", tiktok: "shop" },
        showOnWebsite: true,
        availableInApp: false,
        stamp: { savedAt: BOOT.toISOString(), savedBy: null },
      });
    });

    it("gives a Coming Soon Product no price, no units sold and no store links", async () => {
      expect(await rowOf("prd-009")).toMatchObject({
        state: "coming-soon",
        priceFrom: null,
        priceTo: null,
        unitsSold: null,
        cover: null,
        storeLinks: { shopee: "none", lazada: "none", tiktok: "none" },
      });
    });

    it("shows a Marketplace whose shop link is cleared in Settings as none", async () => {
      await arm.reset((seed) => {
        seed.settings.shopLinks.lazada = null;
      });

      expect((await rowOf("prd-005"))?.storeLinks).toEqual({
        shopee: "product",
        lazada: "none",
        tiktok: "shop",
      });
    });

    it("lets an Editor and an Owner list the same rows", async () => {
      expect(await seam.listProductsForAdmin(OWNER, {})).toEqual(await list());
    });
  });

  describe("listProductsForAdmin: the filters", () => {
    it("searches the title and the short name, case-insensitively, ignoring spaces around it", async () => {
      const posters = ["prd-005", "prd-013", "prd-011", "prd-015"];
      expect(ids((await list({ q: "poster" })).rows)).toEqual(posters);
      expect(ids((await list({ q: "  POSTER " })).rows)).toEqual(posters);
      expect((await list({ q: "  POSTER " })).query.q).toBe("POSTER");
    });

    it("matches the title alone, and the short name alone", async () => {
      // Only the titles say "Medical Technology"; only the short names say "MedTech".
      const medtech = ["prd-006", "prd-007", "prd-014", "prd-015"];
      expect(ids((await list({ q: "medical technology" })).rows)).toEqual(medtech);
      expect(ids((await list({ q: "medtech" })).rows)).toEqual(medtech);
    });

    it("treats a blank search as no search", async () => {
      const result = await list({ q: "   " });
      expect(result.rows).toHaveLength(15);
      expect(result.query.q).toBeNull();
    });

    it("filters by Exam, in any case", async () => {
      const ce = ["prd-001", "prd-005", "prd-008", "prd-009"];
      expect(ids((await list({ exam: "CE" })).rows)).toEqual(ce);
      expect(ids((await list({ exam: "ce" })).rows)).toEqual(ce);
      expect((await list({ exam: "ce" })).query.exam).toBe("CE");
    });

    it("ignores an unknown Exam, so the list shows every Exam", async () => {
      const result = await list({ exam: "xx" });
      expect(result.rows).toHaveLength(15);
      expect(result.query.exam).toBeNull();
    });

    it("Missing product links: Live Products with a Marketplace on its shop page, never Coming Soon", async () => {
      const result = await list({ missing: true });
      expect(ids(result.rows)).toEqual(LIVE_BY_SOLD);
      expect(result.query.missing).toBe(true);
    });

    it("Missing product links leaves out a Product with a Listing on every Marketplace", async () => {
      await arm.reset((seed) => {
        const cards = seed.products.find((p) => p.id === "prd-001");
        if (cards) {
          cards.listings.lazada = "https://www.lazada.com.ph/products/ce-formula-flash-cards";
          cards.listings.tiktok = "https://www.tiktok.com/view/product/1729";
        }
      });

      expect((await rowOf("prd-001"))?.storeLinks).toEqual({
        shopee: "product",
        lazada: "product",
        tiktok: "product",
      });
      expect(ids((await list({ missing: true })).rows)).not.toContain("prd-001");
    });

    it("doesn't count a Marketplace whose shop link is cleared as missing", async () => {
      // Every Live Product has its Shopee Listing; with no Lazada or TikTok shop
      // link, their buttons are hidden, not opening a shop page.
      await arm.reset((seed) => {
        seed.settings.shopLinks.lazada = null;
        seed.settings.shopLinks.tiktok = null;
      });

      expect((await list({ missing: true })).rows).toEqual([]);
    });

    it("combines the Exam, Missing product links and the search", async () => {
      expect(ids((await list({ exam: "CE", missing: true })).rows)).toEqual([
        "prd-001",
        "prd-005",
        "prd-008",
      ]);
      expect(ids((await list({ exam: "CE", missing: true, q: "poster" })).rows)).toEqual([
        "prd-005",
      ]);
      expect(ids((await list({ exam: "ME", q: "poster" })).rows)).toEqual(["prd-011"]);
    });

    it("finds no match with every Product still counted", async () => {
      const result = await list({ exam: "CPA", q: "poster" });
      expect(result.rows).toEqual([]);
      expect(result.total).toBe(15);
    });

    it("counts an empty catalogue as empty", async () => {
      await arm.reset((seed) => {
        seed.products = [];
        seed.reviews = [];
        for (const faq of seed.faqs) faq.reviewQuote = null;
      });

      expect(await list()).toMatchObject({ rows: [], total: 0 });
    });
  });

  describe("setProductFlags", () => {
    it("hides a Product from the Website: its page, Products, its Exam, Home and its Reviews", async () => {
      clockAt(at(MINUTE));
      const result = await seam.setProductFlags(EDITOR, "prd-001", { showOnWebsite: false });

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: "prd-001",
          showOnWebsite: false,
          availableInApp: true,
          // A single toggle has a stamp of its own, so it never makes an open editor stale.
          stamp: { savedAt: BOOT.toISOString(), savedBy: null },
        }),
        tags: ["catalogue:products"],
      });
      expect(await getProductBySlug("ce-formula-flash-cards")).toBeNull();
      expect((await listProducts()).items.map((p) => p.id)).not.toContain("prd-001");
      expect((await listProducts({ examCode: "CE" })).items.map((p) => p.id)).not.toContain(
        "prd-001",
      );
      expect((await listBestSellers(4)).map((p) => p.id)).not.toContain("prd-001");
      expect((await listHomeReviews()).every((r) => r.productId !== "prd-001")).toBe(true);
      // The Admin still lists it, dimmed.
      expect(await rowOf("prd-001")).toMatchObject({ showOnWebsite: false });
    });

    it("shows a hidden Product again", async () => {
      await seam.setProductFlags(EDITOR, "prd-001", { showOnWebsite: false });
      await seam.setProductFlags(EDITOR, "prd-001", { showOnWebsite: true });

      expect(await getProductBySlug("ce-formula-flash-cards")).toMatchObject({ id: "prd-001" });
      expect((await listBestSellers(1)).map((p) => p.id)).toEqual(["prd-001"]);
    });

    it("hiding an Exam's only Product takes the Exam off the Website's Exam list", async () => {
      await seam.setProductFlags(EDITOR, "prd-003", { showOnWebsite: false });

      expect((await listExams()).map((e) => e.code)).not.toContain("CPA");
    });

    it("makes a Product available in the app, leaving Show on website as it was", async () => {
      const result = await seam.setProductFlags(OWNER, "prd-005", { availableInApp: true });

      expect(result.ok && result.value).toMatchObject({
        availableInApp: true,
        showOnWebsite: true,
      });
      expect(await getProductBySlug(POSTERS)).toMatchObject({ availableInApp: true });
    });

    it("appends one Staff Activity record per toggle, with the flags before and after", async () => {
      clockAt(at(MINUTE));
      await seam.setProductFlags(EDITOR, "prd-005", { availableInApp: true });

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "product",
          entityId: "prd-005",
          action: "set-flags",
          before: { showOnWebsite: true, availableInApp: false },
          after: { showOnWebsite: true, availableInApp: true },
        },
      ]);
    });

    it("always saves: a second toggle, from someone else, saves without a conflict check", async () => {
      clockAt(at(MINUTE));
      await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false });
      const second = await seam.setProductFlags(OWNER, "prd-005", { showOnWebsite: true });

      expect(second.ok && second.value.showOnWebsite).toBe(true);
      expect(await arm.staffActivity()).toHaveLength(2);
    });

    it("leaves the Product's stamp, the one its editor checks, as it was", async () => {
      await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false });

      expect((await rowOf("prd-005"))?.stamp).toEqual({
        savedAt: BOOT.toISOString(),
        savedBy: null,
      });
    });

    it("refuses an unknown Product as not found, changing nothing", async () => {
      const result = await seam.setProductFlags(EDITOR, "prd-999", { showOnWebsite: false });

      expect(result).toEqual({ ok: false, error: { kind: "not-found" } });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a Product deleted elsewhere since the list was read as not found", async () => {
      expect(await rowOf("prd-005")).toBeDefined();
      await arm.deleteProductElsewhere("prd-005");

      const result = await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false });

      expect(result).toEqual({ ok: false, error: { kind: "not-found" } });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a toggle with no flag, or a flag that isn't true or false", async () => {
      expect(await seam.setProductFlags(EDITOR, "prd-005", {})).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: "NOTHING TO SAVE" },
      });
      const notBoolean = await seam.setProductFlags(EDITOR, "prd-005", {
        showOnWebsite: "no" as never,
      });
      expect(notBoolean).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { showOnWebsite: [expect.any(String)] } },
      });
      expect(await arm.staffActivity()).toEqual([]);
      expect(await getProductBySlug(POSTERS)).toMatchObject({ showOnWebsite: true });
    });
  });
});

// The Product editor (spec, Phase 2 stories 64–69; Phase 2 → Products, Deleting,
// Conflict check, Live on save, Staff Activity): every field, with every rule
// refused by its field's message, and each save live on the Website.
describe.each(ADMIN_ARMS)("Admin seam: the Product editor ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const BOOT_STAMP = { savedAt: BOOT.toISOString() };

  /** The Product's form as its editor opens it, with these fields changed. */
  async function formOf(id: string, changes: Partial<ProductForm> = {}): Promise<ProductForm> {
    const opened = await seam.getProductForAdmin(EDITOR, id);
    if (!opened) throw new Error(`No Product ${id}`);
    return { ...productFormValues(opened.product), ...changes };
  }

  const save = async (id: string, changes: Partial<ProductForm>, actor = EDITOR) =>
    seam.updateProduct(actor, id, await formOf(id, changes), BOOT_STAMP);

  /** "MT Notebook", a new Coming Soon Product for MT. */
  const MT_NOTEBOOK: NewProductForm = {
    ...newProductForm("MT"),
    title: "MT Notebook",
    shortName: "MT Notebook",
    format: "notebook",
    size: "A5 · 100 gsm",
    subjectCodes: ["HEMA", "ISBB"],
    comingSoon: true,
  };

  const fieldErrorsOf = (result: Awaited<ReturnType<typeof save>>) =>
    !result.ok && result.error.kind === "invalid" ? result.error : null;

  describe("listExamsForAdmin and getProductForAdmin", () => {
    it("lists the Exams with their Subjects, for the Exam select and the Subject chips", async () => {
      const exams = await seam.listExamsForAdmin(EDITOR);

      expect(exams.map((exam) => `${exam.code} · ${exam.board}`)).toEqual([
        "CE · CELE",
        "ME · MELE",
        "EE · REE",
        "MT · MTLE",
        "CPA · CPALE",
      ]);
      expect(exams[0]?.subjects.map((subject) => subject.code)).toEqual(["MSTC", "HPGE", "PSAD"]);
    });

    it("opens a Product with every field, its stamp and its number of Reviews", async () => {
      expect(await seam.getProductForAdmin(EDITOR, "prd-005")).toEqual({
        product: expect.objectContaining({
          id: "prd-005",
          slug: POSTERS,
          shortName: "Ultimate CE Posters 2.0",
          priceFrom: 40000,
          photos: expect.any(Array),
        }),
        stamp: { savedAt: BOOT.toISOString(), savedBy: null },
        reviewCount: 3,
      });
    });

    it("gives null for a Product that isn't in the catalogue", async () => {
      expect(await seam.getProductForAdmin(EDITOR, "prd-999")).toBeNull();
    });
  });

  describe("updateProduct: saves", () => {
    it("saves a new price: live on its page, Products, its Exam and Home's best sellers", async () => {
      clockAt(at(MINUTE));
      const result = await save("prd-001", { priceFrom: "₱1,250" });

      expect(result).toEqual({
        ok: true,
        value: {
          product: expect.objectContaining({ id: "prd-001", priceFrom: 125000 }),
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name },
          reviewCount: 5,
        },
        tags: ["catalogue:products"],
      });
      expect(await getProductBySlug("ce-formula-flash-cards")).toMatchObject({ priceFrom: 125000 });
      const byId = (products: { id: string; priceFrom: number | null }[]) =>
        products.find((p) => p.id === "prd-001")?.priceFrom;
      expect(byId((await listProducts()).items)).toBe(125000);
      expect(byId((await listProducts({ examCode: "CE" })).items)).toBe(125000);
      expect(byId(await listBestSellers(4))).toBe(125000);
    });

    it("saves every field the editor has", async () => {
      const result = await save("prd-005", {
        title: "Ultimate CE Posters",
        shortName: "CE Posters 3.0",
        edition: "3.0",
        format: "bundle",
        size: "A2 · 250 gsm",
        subjectCodes: ["PSAD", "MSTC"],
        deal: false,
        priceTo: "1,300",
        whatsInside: "Three big posters.",
        madeFor: "CE students\n\n  Retakers  ",
        listings: {
          shopee: "https://shopee.ph/posters-i.1.2",
          lazada: "lazada.com.ph/products/posters-i1.html",
          tiktok: "",
        },
        seoTitle: "CE Posters · CELE",
        seoDescription: "Posters for the CE board exam.",
      });

      expect(result.ok && result.value.product).toMatchObject({
        id: "prd-005",
        slug: POSTERS,
        title: "Ultimate CE Posters",
        shortName: "CE Posters 3.0",
        edition: "3.0",
        format: "bundle",
        size: "A2 · 250 gsm",
        subjectCodes: ["PSAD", "MSTC"],
        deal: false,
        priceTo: 130000,
        whatsInside: "Three big posters.",
        madeFor: ["CE students", "Retakers"],
        listings: {
          shopee: "https://shopee.ph/posters-i.1.2",
          lazada: "https://lazada.com.ph/products/posters-i1.html",
        },
        seoTitle: "CE Posters · CELE",
        seoDescription: "Posters for the CE board exam.",
      });
      expect(await getProductBySlug(POSTERS)).toMatchObject({ shortName: "CE Posters 3.0" });
    });

    it("saves blank text as none, so the Website uses its generated text", async () => {
      await save("prd-005", { whatsInside: " ", madeFor: "", seoTitle: "", seoDescription: "  " });

      expect(await getProductBySlug(POSTERS)).toMatchObject({
        whatsInside: null,
        madeFor: null,
        seoTitle: null,
        seoDescription: null,
      });
    });

    it("saves the variations in order: one added, another removed", async () => {
      const form = await formOf("prd-005");
      const [all, , hpge, psad] = form.variations;
      if (!all || !hpge || !psad) throw new Error("The posters have 4 variations");
      const result = await seam.updateProduct(
        EDITOR,
        "prd-005",
        { ...form, variations: [all, hpge, psad, { name: "MSTC ONLY", price: "400" }] },
        BOOT_STAMP,
      );

      expect(result.ok && result.value.product.variations).toEqual([
        { name: "CE POSTERS 2.0: MSTC, HPGE, PSAD", price: 125000 },
        { name: "CE POSTERS 2.0: HPGE ONLY", price: 47000 },
        { name: "CE POSTERS 2.0: PSAD ONLY", price: 70000 },
        { name: "MSTC ONLY", price: 40000 },
      ]);
      expect((await getProductBySlug(POSTERS))?.variations.map((v) => v.name)).toEqual([
        "CE POSTERS 2.0: MSTC, HPGE, PSAD",
        "CE POSTERS 2.0: HPGE ONLY",
        "CE POSTERS 2.0: PSAD ONLY",
        "MSTC ONLY",
      ]);
    });

    it("leaves the page address, the photos and the two single toggles as they were", async () => {
      await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false, availableInApp: true });
      const before = await seam.getProductForAdmin(EDITOR, "prd-005");
      const result = await save("prd-005", { title: "Renamed Posters" });

      expect(result.ok && result.value.product).toMatchObject({
        slug: POSTERS,
        photos: before?.product.photos,
        showOnWebsite: false,
        availableInApp: true,
      });
    });

    it("isn't made stale by a single toggle: a toggle doesn't change the Product's stamp", async () => {
      await seam.setProductFlags(OWNER, "prd-005", { showOnWebsite: false });

      expect((await save("prd-005", { title: "Renamed Posters" })).ok).toBe(true);
    });

    it("appends one Staff Activity record, with the Product before and after", async () => {
      const before = (await seam.getProductForAdmin(EDITOR, "prd-001"))?.product;
      clockAt(at(MINUTE));
      await save("prd-001", { priceFrom: "1,250" });

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "product",
          entityId: "prd-001",
          action: "update",
          before,
          after: { ...before, priceFrom: 125000 },
        },
      ]);
    });

    it("lets an Owner save too", async () => {
      expect((await save("prd-001", { priceFrom: "1,250" }, OWNER)).ok).toBe(true);
    });
  });

  describe("updateProduct: the Shopee figures", () => {
    it("dates changed figures today in Manila, and re-ranks Home's best sellers", async () => {
      // 01:00 on 23 October in Manila is still the 22nd in UTC.
      clockAt(new Date("2026-10-22T17:00:00.000Z"));
      const result = await save("prd-005", {
        shopee: { rating: "4.9", ratingCount: "120", unitsSold: "800" },
      });

      expect(result.ok && result.value.product.shopee).toEqual({
        rating: 4.9,
        ratingCount: 120,
        unitsSold: 800,
        asOf: "2026-10-23",
      });
      expect((await listBestSellers(2)).map((p) => p.id)).toEqual(["prd-005", "prd-001"]);
    });

    it("keeps the “as of” date when the figures didn't change", async () => {
      clockAt(new Date("2026-11-30T03:00:00.000Z"));
      const result = await save("prd-005", { priceFrom: "410" });

      expect(result.ok && result.value.product.shopee?.asOf).toBe("2026-10-29");
    });

    it("refuses some of the figures without the others", async () => {
      const result = await save("prd-005", {
        shopee: { rating: "4.9", ratingCount: "", unitsSold: " " },
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        "shopee.ratingCount": ["Fill in all three Shopee figures, or none."],
        "shopee.unitsSold": ["Fill in all three Shopee figures, or none."],
      });
    });

    it("saves none of the figures as none", async () => {
      const result = await save("prd-005", {
        shopee: { rating: "", ratingCount: "", unitsSold: "" },
      });

      expect(result.ok && result.value.product.shopee).toBeNull();
    });

    it.each([
      ["5.1", "a rating above 5"],
      ["-1", "a rating below 0"],
      ["4.85", "two decimals"],
      ["great", "text"],
    ])("refuses a rating of %s (%s)", async (rating) => {
      const result = await save("prd-005", {
        shopee: { rating, ratingCount: "52", unitsSold: "172" },
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        "shopee.rating": ["ENTER A RATING FROM 0 TO 5, WITH ONE DECIMAL AT MOST"],
      });
    });

    it("refuses a count that isn't a whole number", async () => {
      const result = await save("prd-005", {
        shopee: { rating: "4.9", ratingCount: "52.5", unitsSold: "-3" },
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        "shopee.ratingCount": ["ENTER A WHOLE NUMBER, 0 OR MORE"],
        "shopee.unitsSold": ["ENTER A WHOLE NUMBER, 0 OR MORE"],
      });
    });
  });

  describe("updateProduct: refusals, with nothing changed", () => {
    async function expectNothingChanged() {
      expect(await arm.staffActivity()).toEqual([]);
      expect(await seam.getProductForAdmin(EDITOR, "prd-001")).toMatchObject({
        product: { title: "Civil Engineering Formula Flash Cards", priceFrom: 120000 },
        stamp: { savedBy: null },
      });
    }

    it("refuses a Live Product with no name or no price: ADD A NAME AND PRICE TO SAVE", async () => {
      for (const changes of [{ title: "  " }, { priceFrom: "" }]) {
        const result = await save("prd-001", changes);
        expect(fieldErrorsOf(result)?.formError).toBe("ADD A NAME AND PRICE TO SAVE");
      }
      expect(fieldErrorsOf(await save("prd-001", { title: "", priceFrom: "" }))).toEqual({
        kind: "invalid",
        fieldErrors: { title: ["ADD A NAME"], priceFrom: ["ADD A PRICE"] },
        formError: "ADD A NAME AND PRICE TO SAVE",
      });
      await expectNothingChanged();
    });

    it.each([
      ["abc", "ENTER A PRICE IN PESOS, LIKE 1,250"],
      ["-5", "A PRICE CAN’T BE BELOW ₱0"],
      ["12.345", "USE AT MOST 2 DECIMALS, LIKE 1,250.50"],
      ["0", "ENTER A PRICE ABOVE ₱0"],
    ])("refuses a price from of %s", async (priceFrom, message) => {
      const result = await save("prd-001", { priceFrom });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({ priceFrom: [message] });
      await expectNothingChanged();
    });

    it("refuses a price up to below the price from", async () => {
      const result = await save("prd-001", { priceFrom: "1,200", priceTo: "1,199.99" });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        priceTo: ["SHOULD NOT BE BELOW THE PRICE FROM"],
      });
      await expectNothingChanged();
    });

    it("refuses a variation with no name or no price, on that variation's field", async () => {
      const result = await save("prd-001", {
        variations: [
          { name: "CE FLASH CARDS: ", price: "1,200" },
          { name: "MSTC ONLY", price: "" },
          { name: "HPGE ONLY", price: "abc" },
        ],
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        "variations.0.name": ["ADD A NAME"],
        "variations.1.price": ["ADD A PRICE"],
        "variations.2.price": ["ENTER A PRICE IN PESOS, LIKE 1,250"],
      });
      await expectNothingChanged();
    });

    it("refuses a Listing on another Marketplace's domain", async () => {
      const result = await save("prd-001", {
        listings: {
          shopee: "https://shopee.ph/cards-i.1.2",
          lazada: "https://shopee.ph/cards-i.1.2",
          tiktok: "https://lazada.com.ph/cards",
        },
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        "listings.lazada": ["SHOULD BE A LAZADA.COM.PH LINK"],
        "listings.tiktok": ["SHOULD BE A TIKTOK LINK"],
      });
      await expectNothingChanged();
    });

    it("refuses an SEO title over 60 characters and a description over 160", async () => {
      expect((await save("prd-001", { seoTitle: "x".repeat(60) })).ok).toBe(true);
      await arm.reset();

      const result = await save("prd-001", {
        seoTitle: "x".repeat(61),
        seoDescription: "y".repeat(161),
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        seoTitle: ["KEEP IT TO 60 CHARACTERS"],
        seoDescription: ["KEEP IT TO 160 CHARACTERS"],
      });
      await expectNothingChanged();
    });

    it("refuses the fields every Product needs: short name, Exam, size and a Subject", async () => {
      const result = await save("prd-001", {
        shortName: "",
        examCode: "",
        size: " ",
        subjectCodes: [],
      });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        shortName: ["ADD A SHORT NAME FOR CARDS"],
        examCode: ["CHOOSE AN EXAM"],
        size: ["ADD THE SIZE AND PAPER"],
        subjectCodes: ["CHOOSE AT LEAST ONE SUBJECT"],
      });
      await expectNothingChanged();
    });

    it("refuses a Subject that isn't on the Product's Exam", async () => {
      // The editor drops CE's Subjects when the Exam changes to ME; a request that keeps one is refused.
      const result = await save("prd-001", { examCode: "ME", subjectCodes: ["PIP", "MSTC"] });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({
        subjectCodes: ["MSTC ISN’T A SUBJECT OF ME"],
      });
      await expectNothingChanged();
    });

    it("moves a Product to another Exam with that Exam's Subjects", async () => {
      const result = await save("prd-001", { examCode: "ME", subjectCodes: ["PIP", "MD"] });

      expect(result.ok && result.value.product).toMatchObject({
        examCode: "ME",
        subjectCodes: ["PIP", "MD"],
      });
      expect((await listProducts({ examCode: "ME" })).items.map((p) => p.id)).toContain("prd-001");
    });

    it("refuses an Exam that isn't in the catalogue", async () => {
      const result = await save("prd-001", { examCode: "XX", subjectCodes: ["MSTC"] });

      expect(fieldErrorsOf(result)?.fieldErrors).toEqual({ examCode: ["CHOOSE AN EXAM"] });
      await expectNothingChanged();
    });

    it("refuses Coming Soon for a Product with Reviews, saying how many", async () => {
      const result = await save("prd-001", { comingSoon: true });

      expect(fieldErrorsOf(result)).toEqual({
        kind: "invalid",
        fieldErrors: {},
        formError: "Coming Soon Products can’t have Reviews. Delete or move its 5 Reviews first.",
      });
      await expectNothingChanged();
      const one = await save("prd-006", { comingSoon: true });
      expect(fieldErrorsOf(one)?.formError).toBe(
        "Coming Soon Products can’t have Reviews. Delete or move its 1 Review first.",
      );
    });

    it("refuses a stale save: someone saved after the editor opened", async () => {
      const opened = await formOf("prd-001");
      clockAt(at(MINUTE));
      await seam.updateProduct(OWNER, "prd-001", { ...opened, priceFrom: "1,300" }, BOOT_STAMP);

      const stale = await seam.updateProduct(
        EDITOR,
        "prd-001",
        { ...opened, priceFrom: "1,250" },
        BOOT_STAMP,
      );

      expect(stale).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
      expect(await getProductBySlug("ce-formula-flash-cards")).toMatchObject({ priceFrom: 130000 });
    });

    it("refuses a Product deleted elsewhere as not found", async () => {
      const opened = await formOf("prd-005");
      await arm.deleteProductElsewhere("prd-005");

      expect(await seam.updateProduct(EDITOR, "prd-005", opened, BOOT_STAMP)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });

  describe("updateProduct: Coming Soon", () => {
    it("saves a Product with no Reviews as Coming Soon without its price, variations, Listings or figures", async () => {
      const result = await save("prd-008", { comingSoon: true });

      expect(result.ok && result.value.product).toMatchObject({
        state: "coming-soon",
        priceFrom: null,
        priceTo: null,
        variations: [],
        listings: {},
        shopee: null,
      });
      const comingSoon = await listProducts({ state: "coming-soon" });
      expect(comingSoon.items.map((p) => p.id)).toContain("prd-008");
    });

    it("doesn't check the sale fields of a Coming Soon Product, which it doesn't save", async () => {
      const result = await save("prd-009", {
        priceFrom: "abc",
        shopee: { rating: "9", ratingCount: "", unitsSold: "" },
        listings: { shopee: "", lazada: "https://shopee.ph/x", tiktok: "" },
      });

      expect(result.ok && result.value.product).toMatchObject({ priceFrom: null, listings: {} });
    });

    it("needs a name: ADD A NAME TO SAVE", async () => {
      const result = await save("prd-009", { title: "" });

      expect(fieldErrorsOf(result)).toEqual({
        kind: "invalid",
        fieldErrors: { title: ["ADD A NAME"] },
        formError: "ADD A NAME TO SAVE",
      });
    });

    it("refuses making a Coming Soon Product with no photos Live", async () => {
      const result = await save("prd-009", { comingSoon: false, priceFrom: "650" });

      expect(fieldErrorsOf(result)).toEqual({
        kind: "invalid",
        fieldErrors: {},
        formError: "Add at least one photo to make it Live",
      });
    });
  });

  describe("createProduct", () => {
    it("adds a Coming Soon Product with no price, at an address made from its name", async () => {
      clockAt(at(MINUTE));
      const result = await seam.createProduct(EDITOR, MT_NOTEBOOK);

      expect(result).toEqual({
        ok: true,
        value: {
          product: expect.objectContaining({
            id: expect.stringMatching(/^prd-/),
            slug: "mt-notebook",
            title: "MT Notebook",
            examCode: "MT",
            state: "coming-soon",
            priceFrom: null,
            photos: [],
            showOnWebsite: true,
            availableInApp: false,
          }),
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name },
          reviewCount: 0,
        },
        tags: ["catalogue:products"],
      });
      const comingSoon = await listProducts({ state: "coming-soon" });
      expect(comingSoon.items.map((p) => p.slug)).toContain("mt-notebook");
      expect(await getProductBySlug("mt-notebook")).toMatchObject({ title: "MT Notebook" });
    });

    it("makes the address unique with -2, and keeps it when the name changes", async () => {
      const first = await seam.createProduct(EDITOR, MT_NOTEBOOK);
      const second = await seam.createProduct(EDITOR, MT_NOTEBOOK);
      const notebook = await seam.createProduct(EDITOR, { ...MT_NOTEBOOK, title: "ME Notebook" });

      expect(first.ok && first.value.product.slug).toBe("mt-notebook");
      expect(second.ok && second.value.product.slug).toBe("mt-notebook-2");
      expect(notebook.ok && notebook.value.product.slug).toBe("me-notebook-2");
      if (!second.ok) throw new Error("The second notebook was refused");

      const renamed = await seam.updateProduct(
        EDITOR,
        second.value.product.id,
        { ...productFormValues(second.value.product), title: "MT Big Notebook" },
        { savedAt: second.value.stamp.savedAt },
      );
      expect(renamed.ok && renamed.value.product.slug).toBe("mt-notebook-2");
    });

    it("adds it with its flags: hidden from the website, in the app", async () => {
      const result = await seam.createProduct(EDITOR, {
        ...MT_NOTEBOOK,
        showOnWebsite: false,
        availableInApp: true,
      });

      expect(result.ok && result.value.product).toMatchObject({
        showOnWebsite: false,
        availableInApp: true,
      });
      expect(await getProductBySlug("mt-notebook")).toBeNull();
    });

    it("appends one Staff Activity record, with nothing before", async () => {
      const result = await seam.createProduct(EDITOR, MT_NOTEBOOK);

      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "product",
          entityId: result.ok ? result.value.product.id : "",
          action: "create",
          before: null,
          after: expect.objectContaining({ slug: "mt-notebook" }),
        }),
      ]);
    });

    it("refuses a new Live Product: it has no photo yet", async () => {
      const result = await seam.createProduct(EDITOR, {
        ...MT_NOTEBOOK,
        comingSoon: false,
        priceFrom: "699",
      });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "Add at least one photo to make it Live",
        },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses an invalid form with its fields' messages, adding nothing", async () => {
      const total = (await seam.listProductsForAdmin(EDITOR, {})).total;
      const result = await seam.createProduct(EDITOR, {
        ...MT_NOTEBOOK,
        title: "",
        subjectCodes: ["MSTC"],
      });

      expect(result).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { title: ["ADD A NAME"] } },
      });
      expect((await seam.listProductsForAdmin(EDITOR, {})).total).toBe(total);
    });

    it("refuses a Subject that isn't on the new Product's Exam", async () => {
      const result = await seam.createProduct(EDITOR, { ...MT_NOTEBOOK, subjectCodes: ["MSTC"] });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { subjectCodes: ["MSTC ISN’T A SUBJECT OF MT"] },
        },
      });
    });
  });

  describe("previewProductDelete and deleteProduct", () => {
    it("counts what goes with a Product: its Reviews, photos and the FAQ quotes from them", async () => {
      expect(await seam.previewProductDelete(EDITOR, "prd-005")).toEqual({
        reviews: 3,
        photos: 2,
        faqQuotes: 1,
      });
      expect(await seam.previewProductDelete(EDITOR, "prd-009")).toEqual({
        reviews: 0,
        photos: 0,
        faqQuotes: 0,
      });
      expect(await seam.previewProductDelete(EDITOR, "prd-999")).toBeNull();
    });

    it("deletes a Product with its Reviews and photos, and removes the FAQ quotes from them", async () => {
      const result = await seam.deleteProduct(EDITOR, "prd-005");

      expect(result).toEqual({
        ok: true,
        value: { id: "prd-005", slug: POSTERS, reviews: 3, photos: 2, faqQuotes: 1 },
        tags: ["catalogue:products", "catalogue:reviews", "catalogue:faqs"],
      });
      expect(await getProductBySlug(POSTERS)).toBeNull();
      expect(await seam.getProductForAdmin(EDITOR, "prd-005")).toBeNull();
      expect((await listReviews()).items.some((r) => r.productId === "prd-005")).toBe(false);
      const faqs = (await listFaqs()).flatMap((group) => group.items);
      expect(faqs.some((faq) => faq.reviewQuote?.reviewId === "rev-014")).toBe(false);
      // The FAQ stays, without its quote.
      expect(faqs.length).toBeGreaterThan(0);
    });

    it("keeps the values from before in Staff Activity: the Product, its Reviews and the quotes", async () => {
      const before = await seam.getProductForAdmin(EDITOR, "prd-005");
      await seam.deleteProduct(EDITOR, "prd-005");

      const [record] = await arm.staffActivity();
      expect(record).toMatchObject({
        entity: "product",
        entityId: "prd-005",
        action: "delete",
        before: {
          product: before?.product,
          reviews: expect.arrayContaining([expect.objectContaining({ id: "rev-014" })]),
          faqQuotes: [
            expect.objectContaining({
              reviewQuote: expect.objectContaining({ reviewId: "rev-014" }),
            }),
          ],
        },
        after: null,
      });
    });

    it("refuses a Product deleted elsewhere as not found", async () => {
      await arm.deleteProductElsewhere("prd-005");

      expect(await seam.deleteProduct(EDITOR, "prd-005")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await arm.staffActivity()).toEqual([]);
    });
  });
});

/** Moves the fake clock to `when`. */
function clockAt(when: Date) {
  vi.setSystemTime(when);
}
