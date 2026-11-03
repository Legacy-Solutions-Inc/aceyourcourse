import { beforeEach, describe, expect, it } from "vitest";

import { faqFormValues, newFaqForm } from "@/lib/admin/faq-form";
import { newProductForm, productFormValues } from "@/lib/admin/product-form";
import { announcementFormValues, promoBannerFormValues } from "@/lib/admin/promo-form";
import { newReviewForm, reviewFormValues } from "@/lib/admin/review-form";
import * as adminSeam from "@/services/admin";
import type { AdminService } from "@/services/admin";
import type { AdminResult, StaffActor } from "@/services/admin.types";

import { ADMIN_ARMS } from "../../test/admin-arms";

// ─────────────────────────────────────────────────────────────────────────────
// Staff Activity covers every Admin write (spec, Phase 2 → Staff Activity;
// story 80). Each seam write is called once with an input that saves, and
// appends exactly one record for the entity it changed: who, the entity, the
// action, and the values before and after. Each is called once more with an
// input it refuses (a validation error, or a record that isn't there), and
// appends none. A write the table below doesn't know fails the first test, so
// a new one can't skip Staff Activity unnoticed.
// ─────────────────────────────────────────────────────────────────────────────

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

/** The seam's reads: they change nothing. */
const READS = [
  "getStaffByEmail",
  "getLatestDeniedSignIn",
  "listStaff",
  "getOverview",
  "getSettingsForAdmin",
  "listProductsForAdmin",
  "listExamsForAdmin",
  "getProductForAdmin",
  "previewProductDelete",
  "listReviewsForAdmin",
  "getReviewForAdmin",
  "previewReviewDelete",
  "listFaqsForAdmin",
  "getFaqForAdmin",
  "getExamPageForAdmin",
  "getPromoForAdmin",
  "getAnnouncementForAdmin",
] as const satisfies readonly (keyof AdminService)[];

/**
 * Sign-in bookkeeping, which changes nothing in the Admin, so it records no
 * Staff Activity: the refusal log and "LAST SIGNED IN".
 */
const SIGN_IN_RECORDS = [
  "recordDeniedSignIn",
  "recordSignIn",
] as const satisfies readonly (keyof AdminService)[];

interface Write {
  /** Who makes it: the least Staff Role allowed. */
  actor: StaffActor;
  entity: string;
  /** The changed entity's id, or any id for a new one. */
  entityId: string | null;
  saves: (seam: AdminService, actor: StaffActor) => Promise<AdminResult<unknown>>;
  /** An input it refuses, and why. */
  refused: (seam: AdminService, actor: StaffActor) => Promise<AdminResult<unknown>>;
  refusal: "invalid" | "not-found";
}

/** The stamp every record has before anyone saves it. */
async function opened(seam: AdminService) {
  return (await seam.getSettingsForAdmin()).stamp;
}

async function productForm(seam: AdminService, id: string) {
  const found = await seam.getProductForAdmin(EDITOR, id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return productFormValues(found.product);
}

async function reviewForm(seam: AdminService, id: string) {
  const found = await seam.getReviewForAdmin(EDITOR, id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return reviewFormValues(found.review);
}

async function faqForm(seam: AdminService, id: string) {
  const found = await seam.getFaqForAdmin(EDITOR, id);
  if (!found) throw new Error(`${id} isn't in the sample data`);
  return faqFormValues(found.faq);
}

async function cePage(seam: AdminService) {
  const found = await seam.getExamPageForAdmin(EDITOR, "ce");
  if (!found) throw new Error("CE isn't in the sample data");
  return found;
}

async function promoForm(seam: AdminService) {
  return promoBannerFormValues((await seam.getPromoForAdmin(EDITOR)).banner);
}

/** Every Admin write that takes a Staff User, with an input it saves and one it refuses. */
const WRITES: Record<string, Write> = {
  inviteStaff: {
    actor: OWNER,
    entity: "invite",
    entityId: "new.editor@example.com",
    saves: (seam, actor) =>
      seam.inviteStaff(actor, { email: "new.editor@example.com", role: "editor" }),
    refused: (seam, actor) => seam.inviteStaff(actor, { email: "not-an-email", role: "editor" }),
    refusal: "invalid",
  },
  renewInvite: {
    actor: OWNER,
    entity: "invite",
    entityId: "expired.invite@example.com",
    saves: (seam, actor) => seam.renewInvite(actor, "expired.invite@example.com"),
    refused: (seam, actor) => seam.renewInvite(actor, "not-an-email"),
    refusal: "invalid",
  },
  cancelInvite: {
    actor: OWNER,
    entity: "invite",
    entityId: "kim.reyes@gmail.com",
    saves: (seam, actor) => seam.cancelInvite(actor, "kim.reyes@gmail.com"),
    refused: (seam, actor) => seam.cancelInvite(actor, "not-an-email"),
    refusal: "invalid",
  },
  changeStaffRole: {
    actor: OWNER,
    entity: "staff",
    entityId: EDITOR.email,
    saves: (seam, actor) => seam.changeStaffRole(actor, { email: EDITOR.email, role: "owner" }),
    refused: (seam, actor) =>
      // @ts-expect-error A Staff Role that doesn't exist, as a forged request might send.
      seam.changeStaffRole(actor, { email: EDITOR.email, role: "admin" }),
    refusal: "invalid",
  },
  removeStaff: {
    actor: OWNER,
    entity: "staff",
    entityId: EDITOR.email,
    saves: (seam, actor) => seam.removeStaff(actor, EDITOR.email),
    refused: (seam, actor) => seam.removeStaff(actor, "not-an-email"),
    refusal: "invalid",
  },
  updateWebsiteSettings: {
    actor: OWNER,
    entity: "settings",
    entityId: "website",
    saves: async (seam, actor) =>
      seam.updateWebsiteSettings(
        actor,
        { contactEmail: "hello@aceyourcourse.ph" },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateWebsiteSettings(actor, { contactEmail: "not-an-email" }, await opened(seam)),
    refusal: "invalid",
  },
  setProductFlags: {
    actor: EDITOR,
    entity: "product",
    entityId: "prd-001",
    saves: (seam, actor) => seam.setProductFlags(actor, "prd-001", { showOnWebsite: false }),
    refused: (seam, actor) => seam.setProductFlags(actor, "prd-001", {}),
    refusal: "invalid",
  },
  createProduct: {
    actor: EDITOR,
    entity: "product",
    entityId: null,
    saves: (seam, actor) =>
      seam.createProduct(actor, {
        ...newProductForm("MT"),
        title: "MT Notebook",
        shortName: "MT Notebook",
        size: "A5",
        subjectCodes: ["HEMA"],
        comingSoon: true,
      }),
    refused: (seam, actor) =>
      seam.createProduct(actor, { ...newProductForm("MT"), comingSoon: true, title: "" }),
    refusal: "invalid",
  },
  updateProduct: {
    actor: EDITOR,
    entity: "product",
    entityId: "prd-001",
    saves: async (seam, actor) =>
      seam.updateProduct(
        actor,
        "prd-001",
        { ...(await productForm(seam, "prd-001")), priceFrom: "1,250" },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateProduct(
        actor,
        "prd-001",
        { ...(await productForm(seam, "prd-001")), priceFrom: "abc" },
        await opened(seam),
      ),
    refusal: "invalid",
  },
  deleteProduct: {
    actor: EDITOR,
    entity: "product",
    entityId: "prd-005",
    saves: (seam, actor) => seam.deleteProduct(actor, "prd-005"),
    refused: (seam, actor) => seam.deleteProduct(actor, "prd-999"),
    refusal: "not-found",
  },
  createReview: {
    actor: EDITOR,
    entity: "review",
    entityId: null,
    saves: (seam, actor) =>
      seam.createReview(actor, { ...newReviewForm("prd-001"), text: "Sulit!" }),
    refused: (seam, actor) => seam.createReview(actor, { ...newReviewForm("prd-001"), text: "" }),
    refusal: "invalid",
  },
  updateReview: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-002",
    saves: async (seam, actor) =>
      seam.updateReview(
        actor,
        "rev-002",
        { ...(await reviewForm(seam, "rev-002")), stars: 4 },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateReview(
        actor,
        "rev-002",
        { ...(await reviewForm(seam, "rev-002")), stars: 0 },
        await opened(seam),
      ),
    refusal: "invalid",
  },
  setReviewPinned: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-002",
    saves: (seam, actor) => seam.setReviewPinned(actor, "rev-002", true),
    refused: (seam, actor) => seam.setReviewPinned(actor, "rev-999", true),
    refusal: "not-found",
  },
  moveReviewPin: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-006",
    saves: (seam, actor) => seam.moveReviewPin(actor, "rev-006", "up"),
    // rev-013 is first on Home.
    refused: (seam, actor) => seam.moveReviewPin(actor, "rev-013", "up"),
    refusal: "invalid",
  },
  deleteReview: {
    actor: EDITOR,
    entity: "review",
    entityId: "rev-014",
    saves: (seam, actor) => seam.deleteReview(actor, "rev-014"),
    refused: (seam, actor) => seam.deleteReview(actor, "rev-999"),
    refusal: "not-found",
  },
  createFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: null,
    saves: (seam, actor) =>
      seam.createFaq(actor, {
        ...newFaqForm("buying"),
        question: "Can I pay by GCash?",
        answer: "Yes.",
      }),
    refused: (seam, actor) =>
      seam.createFaq(actor, {
        ...newFaqForm("buying"),
        question: "Can I pay by GCash?",
        answer: "a".repeat(401),
      }),
    refusal: "invalid",
  },
  updateFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: "faq-002",
    saves: async (seam, actor) =>
      seam.updateFaq(
        actor,
        "faq-002",
        { ...(await faqForm(seam, "faq-002")), answer: "Yes." },
        await opened(seam),
      ),
    refused: async (seam, actor) =>
      seam.updateFaq(
        actor,
        "faq-002",
        { ...(await faqForm(seam, "faq-002")), question: "" },
        await opened(seam),
      ),
    refusal: "invalid",
  },
  moveFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: "faq-001",
    saves: (seam, actor) => seam.moveFaq(actor, "faq-001", "down"),
    // faq-001 is first in Shipping.
    refused: (seam, actor) => seam.moveFaq(actor, "faq-001", "up"),
    refusal: "invalid",
  },
  deleteFaq: {
    actor: EDITOR,
    entity: "faq",
    entityId: "faq-001",
    saves: (seam, actor) => seam.deleteFaq(actor, "faq-001"),
    refused: (seam, actor) => seam.deleteFaq(actor, "faq-999"),
    refusal: "not-found",
  },
  updateExamHeader: {
    actor: EDITOR,
    entity: "exam",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { exam, stamps } = await cePage(seam);
      const { name, longName, madeFor } = exam;
      return seam.updateExamHeader(
        actor,
        "ce",
        { name, longName, madeFor, blurb: "Every CE formula." },
        stamps.header,
      );
    },
    refused: async (seam, actor) => {
      const { exam, stamps } = await cePage(seam);
      const { longName, blurb, madeFor } = exam;
      return seam.updateExamHeader(
        actor,
        "ce",
        { name: "", longName, blurb, madeFor },
        stamps.header,
      );
    },
    refusal: "invalid",
  },
  updateSubjectNames: {
    actor: EDITOR,
    entity: "exam",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { exam, stamps } = await cePage(seam);
      const subjects = exam.subjects.map((subject, i) =>
        i === 0 ? { ...subject, name: "Math" } : subject,
      );
      return seam.updateSubjectNames(actor, "ce", { subjects }, stamps.subjects);
    },
    refused: async (seam, actor) =>
      seam.updateSubjectNames(actor, "ce", { subjects: [] }, (await cePage(seam)).stamps.subjects),
    refusal: "invalid",
  },
  setExamSection: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "ME",
    saves: (seam, actor) => seam.setExamSection(actor, "me", "reviews", false),
    refused: (seam, actor) => seam.setExamSection(actor, "zz", "reviews", false),
    refusal: "not-found",
  },
  updateBundleOffer: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { page, stamps } = await cePage(seam);
      const offer = page.bundleOffer;
      if (!offer) throw new Error("CE has no bundle offer");
      return seam.updateBundleOffer(
        actor,
        "ce",
        { ...offer, headline: "The CE bundle" },
        stamps.bundleOffer,
      );
    },
    refused: async (seam, actor) => {
      const { page, stamps } = await cePage(seam);
      const offer = page.bundleOffer;
      if (!offer) throw new Error("CE has no bundle offer");
      return seam.updateBundleOffer(
        actor,
        "ce",
        { ...offer, productId: "prd-999" },
        stamps.bundleOffer,
      );
    },
    refusal: "invalid",
  },
  updateExamSeo: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "CE",
    saves: async (seam, actor) => {
      const { stamps } = await cePage(seam);
      return seam.updateExamSeo(
        actor,
        "ce",
        { seoTitle: "CE Board Exam Reviewer", seoDescription: "", shareImage: "" },
        stamps.seo,
      );
    },
    refused: async (seam, actor) => {
      const { stamps } = await cePage(seam);
      return seam.updateExamSeo(
        actor,
        "ce",
        { seoTitle: "T".repeat(80), seoDescription: "", shareImage: "" },
        stamps.seo,
      );
    },
    refusal: "invalid",
  },
  updateOfficialExamDate: {
    actor: EDITOR,
    entity: "exam-page",
    entityId: "CE",
    saves: async (seam, actor) =>
      seam.updateOfficialExamDate(
        actor,
        "ce",
        { officialExamDate: "2027-04-24" },
        (await cePage(seam)).stamps.officialExamDate,
      ),
    refused: async (seam, actor) =>
      seam.updateOfficialExamDate(
        actor,
        "ce",
        { officialExamDate: "2027-02-30" },
        (await cePage(seam)).stamps.officialExamDate,
      ),
    refusal: "invalid",
  },
  updatePromoBanner: {
    actor: EDITOR,
    entity: "promo-banner",
    entityId: "home",
    saves: async (seam, actor) =>
      seam.updatePromoBanner(
        actor,
        { ...(await promoForm(seam)), buttonLabel: "Shop now" },
        (await seam.getPromoForAdmin(actor)).stamp,
      ),
    refused: async (seam, actor) =>
      seam.updatePromoBanner(
        actor,
        { ...(await promoForm(seam)), text: "a".repeat(81) },
        (await seam.getPromoForAdmin(actor)).stamp,
      ),
    refusal: "invalid",
  },
  setPromoBannerVisible: {
    actor: EDITOR,
    entity: "promo-banner",
    entityId: "home",
    // The seed's banner is off.
    saves: (seam, actor) => seam.setPromoBannerVisible(actor, true),
    // @ts-expect-error Not a switch's value, as a forged request might send.
    refused: (seam, actor) => seam.setPromoBannerVisible(actor, "on"),
    refusal: "invalid",
  },
  updateAnnouncement: {
    actor: EDITOR,
    entity: "announcement",
    entityId: "website",
    saves: async (seam, actor) => {
      const { announcement, stamp } = await seam.getAnnouncementForAdmin(actor);
      const { messages } = announcementFormValues(announcement);
      return seam.updateAnnouncement(actor, { messages: messages.slice(0, 1) }, stamp);
    },
    refused: async (seam, actor) =>
      seam.updateAnnouncement(
        actor,
        { messages: [] },
        (await seam.getAnnouncementForAdmin(actor)).stamp,
      ),
    refusal: "invalid",
  },
};

/** resolveSignIn writes too: the first sign-in with an Invite's email activates it. */
const ACTIVATION = "resolveSignIn";

describe("the Staff Activity table", () => {
  it("knows every function of the Admin seam: a read, sign-in bookkeeping, or a write", () => {
    const known = [...READS, ...SIGN_IN_RECORDS, ACTIVATION, ...Object.keys(WRITES)].sort();
    expect(Object.keys(adminSeam).sort()).toEqual(known);
  });
});

describe.each(ADMIN_ARMS)("Staff Activity on every Admin write ($name)", (arm) => {
  const { seam } = arm;
  const writes = Object.entries(WRITES);

  beforeEach(async () => {
    await arm.reset();
  });

  /** Calls `write`, and gives its result and the Staff Activity it appended. */
  async function appendedBy<T>(write: () => Promise<T>) {
    const before = await arm.staffActivity();
    const result = await write();
    const after = await arm.staffActivity();
    expect(after.slice(0, before.length)).toEqual(before);
    return { result, appended: after.slice(before.length) };
  }

  it.each(writes)(
    "%s appends exactly one record, with the values before and after",
    async (_name, write) => {
      const { result, appended } = await appendedBy(() => write.saves(seam, write.actor));

      expect(result).toMatchObject({ ok: true });
      expect(appended).toHaveLength(1);
      const [record] = appended;
      expect(Object.keys(record ?? {}).sort()).toEqual(
        ["action", "actor", "after", "at", "before", "entity", "entityId", "id"].sort(),
      );
      expect(record).toMatchObject({
        id: expect.any(String),
        at: expect.any(String),
        actor: { email: write.actor.email, name: write.actor.name },
        entity: write.entity,
        entityId: write.entityId ?? expect.any(String),
        action: expect.any(String),
      });
      // The values are the entity's own, from before and after the write; each
      // area's suite checks them field by field.
      expect(record?.after).not.toEqual(record?.before);
    },
  );

  it.each(writes)("%s appends nothing when it's refused", async (_name, write) => {
    const { result, appended } = await appendedBy(() => write.refused(seam, write.actor));

    expect(result).toMatchObject({ ok: false, error: { kind: write.refusal } });
    expect(appended).toEqual([]);
  });

  it.each(writes.filter(([, write]) => write.actor.role === "owner"))(
    "%s appends nothing for an Editor, who isn't allowed it",
    async (_name, write) => {
      const { result, appended } = await appendedBy(() => write.saves(seam, EDITOR));

      expect(result).toMatchObject({ ok: false, error: { kind: "forbidden" } });
      expect(appended).toEqual([]);
    },
  );

  it("resolveSignIn appends one record when an Invite activates, and none for a refusal", async () => {
    const kim = { email: "kim.reyes@gmail.com", name: "Kim Reyes" };
    const activated = await appendedBy(() => seam.resolveSignIn(kim, new Date()));
    expect(activated.result).toMatchObject({ status: "staff" });
    expect(activated.appended).toEqual([
      expect.objectContaining({
        actor: kim,
        entity: "staff",
        entityId: kim.email,
        before: expect.objectContaining({ email: kim.email }),
        after: expect.objectContaining({ email: kim.email, role: "editor" }),
      }),
    ]);

    const refused = await appendedBy(() =>
      seam.resolveSignIn({ email: "expired.invite@example.com", name: null }, new Date()),
    );
    expect(refused.result).toEqual({ status: "denied", reason: "invite-expired" });
    expect(refused.appended).toEqual([]);

    const signedInAgain = await appendedBy(() => seam.resolveSignIn(kim, new Date()));
    expect(signedInAgain.appended).toEqual([]);
  });

  it("records no Staff Activity for sign-in bookkeeping", async () => {
    const { appended } = await appendedBy(async () => {
      await seam.recordSignIn(EDITOR.email, new Date());
      await seam.recordDeniedSignIn({
        email: "juan.delacruz@gmail.com",
        reason: "not-staff",
        at: new Date(),
      });
    });
    expect(appended).toEqual([]);
  });
});
