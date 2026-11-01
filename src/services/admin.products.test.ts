import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductRow, StaffActor } from "@/services/admin.types";
import {
  getProductBySlug,
  listBestSellers,
  listExams,
  listHomeReviews,
  listProducts,
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

  describe("getProductRowForAdmin", () => {
    it("gives a Product's row by id, whatever the list's filters, hidden ones included", async () => {
      await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false });

      expect(await seam.getProductRowForAdmin(EDITOR, "prd-005")).toEqual(
        (await list()).rows.find((row) => row.id === "prd-005"),
      );
      expect(await seam.getProductRowForAdmin(EDITOR, "prd-005")).toMatchObject({
        showOnWebsite: false,
        stamp: { savedBy: EDITOR.name },
      });
    });

    it("gives null for a Product that isn't in the catalogue", async () => {
      expect(await seam.getProductRowForAdmin(EDITOR, "prd-999")).toBeNull();
      expect(await seam.getProductRowForAdmin(EDITOR, "new")).toBeNull();
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
          stamp: { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name },
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

      expect(second.ok && second.value.stamp).toEqual({
        // Each save is later than the one before, even in the same millisecond.
        savedAt: new Date(at(MINUTE).getTime() + 1).toISOString(),
        savedBy: OWNER.name,
      });
      expect(await arm.staffActivity()).toHaveLength(2);
    });

    it("stamps only the toggled Product", async () => {
      await seam.setProductFlags(EDITOR, "prd-005", { showOnWebsite: false });

      expect((await rowOf("prd-001"))?.stamp).toEqual({
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

/** Moves the fake clock to `when`. */
function clockAt(when: Date) {
  vi.setSystemTime(when);
}
