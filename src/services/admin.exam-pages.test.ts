import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bundleFormValues,
  dateFormValues,
  headerFormValues,
  seoFormValues,
  subjectFormValues,
} from "@/lib/admin/exam-page-form";
import { productFormValues } from "@/lib/admin/product-form";
import type {
  BundleOfferForm,
  ExamHeaderForm,
  ExamSeoForm,
  SubjectNamesForm,
} from "@/services/admin.schema";
import type { AdminExamPage, StaffActor } from "@/services/admin.types";
import { getExamByCode, getExamPage, listExams } from "@/services/catalogue";
import type { ExamPageSection } from "@/services/catalogue.types";

import { ADMIN_ARMS } from "../../test/admin-arms";

// The Admin seam's Exam pages area, run against every arm (spec, Phase 2 →
// Exam pages & promo, Conflict check, Staff Activity; stories 74, 75, 77):
// each Exam page's Header and Subject names (the Exam's own fields), its
// section toggles, bundle offer, SEO overrides with the share image, and
// Official Exam Date. Every save is live on the Website. Each test boots the
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

const NEVER_SAVED = { savedAt: BOOT.toISOString(), savedBy: null };
const SAVED_BY_EDITOR = { savedAt: at(MINUTE).toISOString(), savedBy: EDITOR.name };

/** The CE Products, in the catalogue's order: cards, posters, the bundle, and the notebook. */
const CE_CARDS = "prd-001";
const CE_POSTERS = "prd-005";
const CE_BUNDLE = "prd-008";
const CE_NOTEBOOK = "prd-009";
/** ME's Live flash cards. */
const ME_CARDS = "prd-002";

/** A page title whose whole <title>, with " · Ace Your Course", is `length` characters. */
const titleOfFull = (length: number) => "T".repeat(length - " · Ace Your Course".length);
const text = (length: number) => "d".repeat(length);

const WAIT_FOR_UPLOADS = "Wait for uploads to finish.";
const NOT_UPLOADED = "THE IMAGE ISN’T UPLOADED · ADD IT AGAIN";

describe.each(ADMIN_ARMS)("Admin seam: Exam pages ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const opened = async (code: string) => {
    const page = await seam.getExamPageForAdmin(EDITOR, code);
    if (!page) throw new Error(`${code} isn't in the catalogue`);
    return page;
  };
  const saved = (result: { ok: boolean; value?: AdminExamPage }) => {
    if (!result.ok || !result.value)
      throw new Error(`expected a save, got ${JSON.stringify(result)}`);
    return result.value;
  };
  const header = async (code: string, changes: Partial<ExamHeaderForm>, actor = EDITOR) => {
    const { exam, stamps } = await opened(code);
    return seam.updateExamHeader(
      actor,
      code,
      { ...headerFormValues(exam), ...changes },
      stamps.header,
    );
  };
  const subjects = async (code: string, form: (current: SubjectNamesForm) => SubjectNamesForm) => {
    const { exam, stamps } = await opened(code);
    return seam.updateSubjectNames(EDITOR, code, form(subjectFormValues(exam)), stamps.subjects);
  };
  const bundle = async (code: string, changes: Partial<BundleOfferForm>, actor = EDITOR) => {
    const { page, stamps } = await opened(code);
    return seam.updateBundleOffer(
      actor,
      code,
      { ...bundleFormValues(page), ...changes },
      stamps.bundleOffer,
    );
  };
  const seo = async (code: string, changes: Partial<ExamSeoForm>, actor = EDITOR) => {
    const { page, stamps } = await opened(code);
    return seam.updateExamSeo(actor, code, { ...seoFormValues(page), ...changes }, stamps.seo);
  };
  const date = async (code: string, officialExamDate: string) => {
    const { stamps } = await opened(code);
    return seam.updateOfficialExamDate(EDITOR, code, { officialExamDate }, stamps.officialExamDate);
  };
  const later = () => vi.setSystemTime(at(MINUTE));

  describe("getExamPageForAdmin", () => {
    it("opens CE: the Exam, its page with the bundle offer, every part's stamp and its Products", async () => {
      const page = await opened("CE");
      expect(page.exam).toMatchObject({ code: "CE", name: "Civil Engineering" });
      expect(page.page).toMatchObject({
        examCode: "CE",
        sections: { subjects: true, bundleOffer: true, reviews: true },
        bundleOffer: { productId: CE_BUNDLE, buttonLabel: "See the bundle" },
        seoTitle: null,
        shareImage: null,
        officialExamDate: null,
      });
      expect(page.stamps).toEqual({
        header: NEVER_SAVED,
        subjects: NEVER_SAVED,
        sections: NEVER_SAVED,
        bundleOffer: NEVER_SAVED,
        seo: NEVER_SAVED,
        officialExamDate: NEVER_SAVED,
      });
      // Coming Soon and hidden Products can be chosen too: the offer shows once they're Live.
      expect(page.products).toEqual([
        { id: CE_CARDS, shortName: "CE Formula Flash Cards", state: "live", showOnWebsite: true },
        {
          id: CE_POSTERS,
          shortName: "Ultimate CE Posters 2.0",
          state: "live",
          showOnWebsite: true,
        },
        { id: CE_BUNDLE, shortName: "CE Review Bundle 3-in-1", state: "live", showOnWebsite: true },
        {
          id: CE_NOTEBOOK,
          shortName: "CE Solving Notebook",
          state: "coming-soon",
          showOnWebsite: true,
        },
      ]);
    });

    it("matches the code in any case", async () => {
      expect((await opened("me")).exam.code).toBe("ME");
    });

    it.each(["XX", ""])("gives null for the unknown code %j", async (code) => {
      expect(await seam.getExamPageForAdmin(EDITOR, code)).toBeNull();
    });

    it("gives an Exam with no page record the defaults", async () => {
      await arm.reset((seed) => {
        seed.examPages = seed.examPages.filter((page) => page.examCode !== "EE");
      });
      expect((await opened("EE")).page).toEqual({
        examCode: "EE",
        sections: { subjects: true, bundleOffer: true, reviews: true },
        bundleOffer: null,
        seoTitle: null,
        seoDescription: null,
        shareImage: null,
        officialExamDate: null,
      });
    });
  });

  describe("updateExamHeader", () => {
    it("saves the name, long name, text and made for, trimmed, live on the Website", async () => {
      later();
      const result = await header("CE", {
        name: " Civil Engineering ",
        longName: "Civil Engineer Licensure Examination",
        blurb: "Every CE formula, in four formats.\r\nStart with the cards. ",
        madeFor: "Reviewees and review centers",
      });

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exams"] });
      expect(saved(result).stamps.header).toEqual(SAVED_BY_EDITOR);
      // The other parts keep their own stamps, so their editors don't conflict.
      expect(saved(result).stamps.seo).toEqual(NEVER_SAVED);
      expect(await getExamByCode("ce")).toMatchObject({
        name: "Civil Engineering",
        longName: "Civil Engineer Licensure Examination",
        blurb: "Every CE formula, in four formats.\nStart with the cards.",
        madeFor: "Reviewees and review centers",
      });
    });

    it("refuses an empty name and text, each with its field's message, changing nothing", async () => {
      const result = await header("CE", { name: "  ", blurb: "" });

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { name: ["ADD THE EXAM NAME"], blurb: ["ADD THE TEXT"] },
        },
      });
      expect((await getExamByCode("ce"))?.name).toBe("Civil Engineering");
      expect(await arm.staffActivity()).toEqual([]);
    });

    it("refuses a name over 60 characters", async () => {
      expect(await header("CE", { name: text(61) })).toMatchObject({
        ok: false,
        error: { fieldErrors: { name: ["KEEP IT TO 60 CHARACTERS"] } },
      });
      expect(await header("CE", { name: text(60) })).toMatchObject({ ok: true });
    });

    it("refuses a save over a newer one, saying who saved it and when", async () => {
      const stale = await opened("CE");
      later();
      saved(await header("CE", { madeFor: "Board reviewees" }, OWNER));

      const result = await seam.updateExamHeader(
        EDITOR,
        "CE",
        { ...headerFormValues(stale.exam), name: "CE" },
        stale.stamps.header,
      );
      expect(result).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: at(MINUTE).toISOString() },
      });
      expect((await getExamByCode("ce"))?.name).toBe("Civil Engineering");
    });

    it("answers not-found for an unknown Exam", async () => {
      const ce = await opened("CE");
      expect(
        await seam.updateExamHeader(EDITOR, "XX", headerFormValues(ce.exam), ce.stamps.header),
      ).toEqual({ ok: false, error: { kind: "not-found" } });
    });

    it("records Staff Activity with the Header before and after", async () => {
      later();
      saved(await header("ME", { madeFor: "Mechanical reviewees" }));

      expect(await arm.staffActivity()).toEqual([
        {
          id: expect.any(String),
          at: at(MINUTE).toISOString(),
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "exam",
          entityId: "ME",
          action: "update-header",
          before: expect.objectContaining({
            madeFor: "Engineers needing a quick formula reference",
          }),
          after: expect.objectContaining({ madeFor: "Mechanical reviewees" }),
        },
      ]);
    });
  });

  describe("updateSubjectNames", () => {
    it("renames a Subject wherever the Website names it, keeping its code", async () => {
      later();
      const result = await subjects("CE", ({ subjects: list }) => ({
        subjects: list.map((subject) =>
          subject.code === "MSTC" ? { ...subject, name: " Math, Surveying & Transpo " } : subject,
        ),
      }));

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exams"] });
      expect(saved(result).stamps.subjects).toEqual(SAVED_BY_EDITOR);
      const renamed = { code: "MSTC", name: "Math, Surveying & Transpo" };
      // The Exam page and the Product pages read the Exam; the FAQ table lists the Exams.
      expect((await getExamByCode("ce"))?.subjects[0]).toEqual(renamed);
      expect((await listExams()).find((exam) => exam.code === "CE")?.subjects[0]).toEqual(renamed);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({ entity: "exam", entityId: "CE", action: "rename-subjects" }),
      ]);
    });

    it("refuses a blank Subject name with its field's message", async () => {
      const result = await subjects("CE", ({ subjects: list }) => ({
        subjects: list.map((subject, index) => (index === 1 ? { ...subject, name: " " } : subject)),
      }));
      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { "subjects.1.name": ["ADD THE SUBJECT’S NAME"] } },
      });
    });

    it.each<[string, (list: SubjectNamesForm["subjects"]) => SubjectNamesForm["subjects"]]>([
      ["a changed code", (list) => list.map((s, i) => (i === 0 ? { ...s, code: "MATH" } : s))],
      ["the codes in another order", (list) => [...list].reverse()],
      ["a Subject left out", (list) => list.slice(1)],
      ["a Subject added", (list) => [...list, { code: "GEO", name: "Geotechnical" }]],
    ])("refuses %s: the codes are fixed", async (_change, change) => {
      const result = await subjects("CE", ({ subjects: list }) => ({ subjects: change(list) }));
      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {},
          formError: "SUBJECT CODES CAN’T BE CHANGED · RELOAD THE PAGE",
        },
      });
      expect((await getExamByCode("ce"))?.subjects.map((s) => s.code)).toEqual([
        "MSTC",
        "HPGE",
        "PSAD",
      ]);
    });
  });

  describe("setExamSection", () => {
    it("hides Reviews on ME at once, with no conflict check, and shows it again", async () => {
      later();
      const hidden = await seam.setExamSection(EDITOR, "me", "reviews", false);

      expect(hidden).toMatchObject({ ok: true, tags: ["catalogue:exam-pages"] });
      expect(saved(hidden).page.sections).toEqual({
        subjects: true,
        bundleOffer: false,
        reviews: false,
      });
      expect((await getExamPage("me"))?.sections.reviews).toBe(false);

      saved(await seam.setExamSection(EDITOR, "ME", "reviews", true));
      expect((await getExamPage("me"))?.sections.reviews).toBe(true);
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "exam-page",
          entityId: "ME",
          action: "set-section",
          before: expect.objectContaining({ reviews: true }),
          after: expect.objectContaining({ reviews: false }),
        }),
        expect.objectContaining({ action: "set-section" }),
      ]);
    });

    it("doesn't make another part's open editor conflict", async () => {
      const before = await opened("CE");
      later();
      saved(await seam.setExamSection(EDITOR, "CE", "subjects", false));
      expect(
        await seam.updateExamSeo(EDITOR, "CE", seoFormValues(before.page), before.stamps.seo),
      ).toMatchObject({ ok: true });
    });

    it("makes the record of an Exam that has none", async () => {
      await arm.reset((seed) => {
        seed.examPages = seed.examPages.filter((page) => page.examCode !== "EE");
      });
      saved(await seam.setExamSection(EDITOR, "EE", "subjects", false));
      expect((await getExamPage("ee"))?.sections).toEqual({
        subjects: false,
        bundleOffer: true,
        reviews: true,
      });
    });

    it("refuses a section that can't be hidden", async () => {
      const header = "header" as unknown as ExamPageSection;
      expect(await seam.setExamSection(EDITOR, "CE", header, false)).toMatchObject({
        ok: false,
        error: { kind: "invalid", fieldErrors: { section: ["UNKNOWN SECTION"] } },
      });
    });

    it("answers not-found for an unknown Exam", async () => {
      expect(await seam.setExamSection(EDITOR, "XX", "reviews", false)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("updateBundleOffer", () => {
    it("offers another CE Product, with its headline, text and button label, on the Website", async () => {
      later();
      const result = await bundle("CE", {
        productId: CE_POSTERS,
        headline: " Ultimate CE Posters 2.0 ",
        text: "Every CE formula on your wall.",
        buttonLabel: "See the posters",
      });

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exam-pages"] });
      expect(saved(result).stamps.bundleOffer).toEqual(SAVED_BY_EDITOR);
      expect((await getExamPage("ce"))?.bundleOffer).toMatchObject({
        headline: "Ultimate CE Posters 2.0",
        text: "Every CE formula on your wall.",
        buttonLabel: "See the posters",
        product: { id: CE_POSTERS, slug: "ultimate-ce-posters-2-0" },
      });
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "exam-page",
          entityId: "CE",
          action: "update-bundle-offer",
          before: expect.objectContaining({ productId: CE_BUNDLE }),
          after: expect.objectContaining({ productId: CE_POSTERS }),
        }),
      ]);
    });

    it("gives ME an offer, shown once its section is on", async () => {
      saved(
        await bundle("ME", {
          productId: ME_CARDS,
          headline: "ME Formula Flash Cards",
          text: "All three MELE subjects.",
          buttonLabel: "See the cards",
        }),
      );
      expect((await getExamPage("me"))?.bundleOffer?.product.id).toBe(ME_CARDS);
      expect((await getExamPage("me"))?.sections.bundleOffer).toBe(false);

      saved(await seam.setExamSection(EDITOR, "ME", "bundleOffer", true));
      expect((await getExamPage("me"))?.sections.bundleOffer).toBe(true);
    });

    it("keeps an offer of a Coming Soon Product, which the Website shows once it's Live", async () => {
      saved(await bundle("CE", { productId: CE_NOTEBOOK }));
      expect((await opened("CE")).page.bundleOffer?.productId).toBe(CE_NOTEBOOK);
      expect((await getExamPage("ce"))?.bundleOffer).toBeNull();
    });

    it("removes the offer when no Product is chosen", async () => {
      const result = await bundle("CE", { productId: "", headline: "" });
      expect(saved(result).page.bundleOffer).toBeNull();
      expect((await getExamPage("ce"))?.bundleOffer).toBeNull();
    });

    it("refuses a Product of another Exam", async () => {
      expect(await bundle("CE", { productId: ME_CARDS })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { productId: ["PICK ONE OF THE CE PRODUCTS"] } },
      });
      expect((await opened("CE")).page.bundleOffer?.productId).toBe(CE_BUNDLE);
    });

    it.each([
      ["one that isn't in the catalogue", async () => "prd-404"],
      [
        "one deleted since the editor opened",
        async () => {
          await arm.deleteProductElsewhere(CE_POSTERS);
          return CE_POSTERS;
        },
      ],
    ])("refuses %s", async (_case, productId) => {
      const { page, stamps } = await opened("CE");
      const result = await seam.updateBundleOffer(
        EDITOR,
        "CE",
        { ...bundleFormValues(page), productId: await productId() },
        stamps.bundleOffer,
      );
      expect(result).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { productId: ["THAT PRODUCT ISN’T IN THE CATALOGUE · PICK ANOTHER"] },
        },
      });
    });

    it("refuses a chosen Product with no headline, text or button label", async () => {
      expect(await bundle("CE", { headline: "", text: " ", buttonLabel: "" })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: {
            headline: ["ADD A HEADLINE"],
            text: ["ADD THE TEXT"],
            buttonLabel: ["ADD THE BUTTON LABEL"],
          },
        },
      });
    });

    it("refuses a save over a newer one", async () => {
      const stale = await opened("CE");
      later();
      saved(await bundle("CE", { headline: "The CE bundle" }, OWNER));
      expect(
        await seam.updateBundleOffer(
          EDITOR,
          "CE",
          bundleFormValues(stale.page),
          stale.stamps.bundleOffer,
        ),
      ).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: OWNER.name } });
    });
  });

  describe("the bundle Product's own changes", () => {
    it("deleting the bundle Product removes the offer, keeping the page", async () => {
      const offer = (await opened("CE")).page.bundleOffer;
      expect(await seam.deleteProduct(EDITOR, CE_BUNDLE)).toMatchObject({
        ok: true,
        tags: expect.arrayContaining(["catalogue:exam-pages"]),
      });
      expect((await opened("CE")).page).toMatchObject({
        bundleOffer: null,
        sections: { bundleOffer: true },
      });
      // Staff Activity keeps the offer the delete removed.
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({
            bundleOffers: [expect.objectContaining({ examCode: "CE", bundleOffer: offer })],
          }),
        }),
      ]);
    });

    it("refuses moving the bundle Product to another Exam, naming the page", async () => {
      const product = await seam.getProductForAdmin(EDITOR, CE_BUNDLE);
      if (!product) throw new Error("the seed has no CE bundle");
      const result = await seam.updateProduct(
        EDITOR,
        CE_BUNDLE,
        { ...productFormValues(product.product), examCode: "ME", subjectCodes: ["MATH"] },
        product.stamp,
      );
      expect(result).toMatchObject({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { examCode: ["THE CE PAGE OFFERS IT AS ITS BUNDLE · CHANGE THAT FIRST"] },
        },
      });
    });
  });

  describe("updateExamSeo", () => {
    it("saves a title and description, live on the Website", async () => {
      later();
      const result = await seo("CE", {
        seoTitle: " CE Board Exam Reviewer ",
        seoDescription: "Formula flash cards, notebooks and posters for the CELE.",
      });

      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exam-pages"] });
      expect(saved(result).stamps.seo).toEqual(SAVED_BY_EDITOR);
      expect(await getExamPage("ce")).toMatchObject({
        seoTitle: "CE Board Exam Reviewer",
        seoDescription: "Formula flash cards, notebooks and posters for the CELE.",
      });
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({ entity: "exam-page", entityId: "CE", action: "update-seo" }),
      ]);
    });

    it("saves blank fields as none, so the Website uses the generated text", async () => {
      saved(await seo("CE", { seoTitle: "CE Board Exam Reviewer" }));
      saved(await seo("CE", { seoTitle: "  ", seoDescription: "" }));
      expect(await getExamPage("ce")).toMatchObject({ seoTitle: null, seoDescription: null });
    });

    it("takes a whole title of 60 characters, and refuses 61", async () => {
      expect(await seo("CE", { seoTitle: titleOfFull(60) })).toMatchObject({ ok: true });
      expect(await seo("CE", { seoTitle: titleOfFull(61) })).toEqual({
        ok: false,
        error: {
          kind: "invalid",
          fieldErrors: { seoTitle: ["KEEP THE WHOLE TITLE TO 60 CHARACTERS"] },
        },
      });
    });

    it("takes a description of 160 characters, and refuses 161", async () => {
      expect(await seo("CE", { seoDescription: text(160) })).toMatchObject({ ok: true });
      expect(await seo("CE", { seoDescription: text(161) })).toMatchObject({
        ok: false,
        error: { fieldErrors: { seoDescription: ["KEEP IT TO 160 CHARACTERS"] } },
      });
    });

    it("saves an uploaded share image at its public URL, keeps it, and clears it", async () => {
      const upload = await arm.uploadPhoto({ purpose: "share-image" });
      const result = await seo("CE", { shareImage: upload.path });
      expect(saved(result).page.shareImage).toBe(upload.publicUrl);
      expect((await getExamPage("ce"))?.shareImage).toBe(upload.publicUrl);

      // Saved again with the image it has, it keeps it.
      saved(await seo("CE", { seoTitle: "CE Board Exam Reviewer" }));
      expect((await getExamPage("ce"))?.shareImage).toBe(upload.publicUrl);

      saved(await seo("CE", { shareImage: "" }));
      expect((await getExamPage("ce"))?.shareImage).toBeNull();
    });

    it("asks to wait for a share image whose file hasn't arrived", async () => {
      const upload = await arm.uploadPhoto({ purpose: "share-image", send: false });
      expect(await seo("CE", { shareImage: upload.path })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: WAIT_FOR_UPLOADS },
      });
    });

    it.each([
      ["a Product photo upload", () => arm.uploadPhoto({ purpose: "product-photo" })],
      ["a path the Admin didn't upload", async () => ({ path: "/products/x/1.webp" })],
    ])("refuses %s as the share image", async (_case, image) => {
      const { path } = await image();
      expect(await seo("CE", { shareImage: path })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { shareImage: [NOT_UPLOADED] } },
      });
    });

    it("refuses a save over a newer one", async () => {
      const stale = await opened("CE");
      later();
      saved(await seo("CE", { seoTitle: "CE Reviewer" }, OWNER));
      expect(
        await seam.updateExamSeo(EDITOR, "CE", seoFormValues(stale.page), stale.stamps.seo),
      ).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: OWNER.name } });
    });
  });

  describe("updateOfficialExamDate", () => {
    it("saves a future date", async () => {
      later();
      const result = await date("CE", "2027-04-24");
      expect(result).toMatchObject({ ok: true, tags: ["catalogue:exam-pages"] });
      expect(saved(result).page.officialExamDate).toBe("2027-04-24");
      expect(saved(result).stamps.officialExamDate).toEqual(SAVED_BY_EDITOR);
      expect((await getExamPage("ce"))?.officialExamDate).toBe("2027-04-24");
      expect(await arm.staffActivity()).toEqual([
        expect.objectContaining({
          entity: "exam-page",
          entityId: "CE",
          action: "update-official-exam-date",
          before: null,
          after: "2027-04-24",
        }),
      ]);
    });

    it("saves a past date: the editor only warns about it", async () => {
      expect(saved(await date("CE", "2026-04-24")).page.officialExamDate).toBe("2026-04-24");
    });

    it("saves none", async () => {
      saved(await date("CE", "2027-04-24"));
      expect(saved(await date("CE", "")).page.officialExamDate).toBeNull();
    });

    it.each(["2026-02-30", "24 April 2027", "2027-4-24"])(
      "refuses %j, which isn't a real date",
      async (value) => {
        expect(await date("CE", value)).toEqual({
          ok: false,
          error: { kind: "invalid", fieldErrors: { officialExamDate: ["ENTER A REAL DATE"] } },
        });
      },
    );

    it("refuses a save over a newer one", async () => {
      const stale = await opened("CE");
      later();
      saved(await date("CE", "2027-04-24"));
      expect(
        await seam.updateOfficialExamDate(
          OWNER,
          "CE",
          dateFormValues(stale.page),
          stale.stamps.officialExamDate,
        ),
      ).toMatchObject({ ok: false, error: { kind: "conflict", savedBy: EDITOR.name } });
    });
  });
});
