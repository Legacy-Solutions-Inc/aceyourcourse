import { faqSlugFor } from "@/lib/admin/faq-form";
import {
  type FaqForm,
  faqFormSchema,
  faqIdInputSchema,
  type FaqInput,
  type FaqMove,
  faqMoveSchema,
  QUOTE_NOT_WORD_FOR_WORD,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminFaq,
  AdminFaqList,
  AdminResult,
  DeletedFaq,
  FaqListQuery,
  FaqReviewOption,
  RecordStamp,
  StaffActor,
} from "@/services/admin.types";
import { type CatalogueSeed, FAQ_GROUP_TITLES, FAQ_GROUPS } from "@/services/catalogue.schema";
import type { Faq, FaqGroup } from "@/services/catalogue.types";
import { CATALOGUE_TAGS } from "@/services/catalogue.tags";
import { getSampleStore, stampOf } from "@/services/mock/sample-store";

import { writeCatalogue } from "./write";

// The sample arm of the Admin seam's FAQs area: the 5 fixed groups and the
// FAQs list, with search across groups; the editor's add and save; ▲▼ within
// a group; and delete. Each FAQ is its own record, with its own stamp for the
// editor's conflict check. ▲▼ always saves (spec, Phase 2 → Conflict check),
// so the order has a stamp of its own and never makes an open editor's save a
// conflict. Each group is ordered 1, 2, 3…: an FAQ added, or moved into a
// group, goes last, and one that leaves closes the gap behind it.

/** An FAQ's record key, for the stamp its editor checks. */
const recordOf = (id: string) => `faq:${id}`;

/** The record key of every group's order, which ▲▼ changes. */
const ORDER_RECORD = "faqs:order";

const findFaq = (catalogue: CatalogueSeed, id: string) =>
  catalogue.faqs.find((faq) => faq.id === id);

const exists = (id: string) => (catalogue: CatalogueSeed) => findFaq(catalogue, id) !== undefined;

/** A group's FAQs, in order. */
const groupFaqs = (catalogue: CatalogueSeed, group: FaqGroup) =>
  catalogue.faqs.filter((faq) => faq.group === group).sort((a, b) => a.order - b.order);

const groupOrderOf = (catalogue: CatalogueSeed, group: FaqGroup) =>
  groupFaqs(catalogue, group).map((faq) => faq.id);

/** Numbers a group 1, 2, 3… in its order, closing any gap. */
function renumber(draft: CatalogueSeed, group: FaqGroup) {
  groupFaqs(draft, group).forEach((faq, index) => {
    faq.order = index + 1;
  });
}

/** The next place in a group: after the last one. */
const lastPlace = (catalogue: CatalogueSeed, group: FaqGroup) =>
  Math.max(0, ...groupFaqs(catalogue, group).map((faq) => faq.order)) + 1;

const isGroup = (group: string | undefined): group is FaqGroup =>
  FAQ_GROUPS.some((g) => g === group);

/** The Reviews shown on the Website: those of a Live Product shown on the website. */
function quotableReviews(catalogue: CatalogueSeed): FaqReviewOption[] {
  const products = new Map(catalogue.products.map((product) => [product.id, product]));
  return catalogue.reviews.flatMap((review) => {
    const product = products.get(review.productId);
    if (product?.state !== "live" || !product.showOnWebsite) return [];
    const { shortName, examCode } = product;
    return [
      { id: review.id, stars: review.stars, text: review.text, product: { shortName, examCode } },
    ];
  });
}

export async function listFaqsForAdmin(
  _actor: StaffActor,
  query: FaqListQuery,
): Promise<AdminFaqList> {
  const { catalogue } = getSampleStore();
  const group = isGroup(query.group) ? query.group : FAQ_GROUPS[0];
  const q = query.q?.trim() || null;
  const search = q?.toLowerCase();

  const rows = search
    ? FAQ_GROUPS.flatMap((g) => groupFaqs(catalogue, g)).filter(
        (faq) =>
          faq.question.toLowerCase().includes(search) || faq.answer.toLowerCase().includes(search),
      )
    : groupFaqs(catalogue, group);

  return structuredClone({
    groups: FAQ_GROUPS.map((g) => ({
      group: g,
      title: FAQ_GROUP_TITLES[g].title,
      count: catalogue.faqs.filter((faq) => faq.group === g).length,
    })),
    query: { group, q },
    rows,
    reviews: quotableReviews(catalogue),
    slugs: catalogue.faqs.map((faq) => faq.slug),
  });
}

function adminFaqOf(catalogue: CatalogueSeed, id: string, stamp: RecordStamp): AdminFaq | null {
  const faq = findFaq(catalogue, id);
  return faq ? structuredClone({ faq, stamp }) : null;
}

/** The saved value, read after the write committed. */
function savedFaq(catalogue: CatalogueSeed, id: string): AdminFaq {
  const saved = adminFaqOf(catalogue, id, stampOf(getSampleStore(), recordOf(id)));
  if (!saved) throw new Error(`FAQ ${id} vanished during its own save`);
  return saved;
}

export async function getFaqForAdmin(_actor: StaffActor, id: string): Promise<AdminFaq | null> {
  const store = getSampleStore();
  return adminFaqOf(store.catalogue, id, stampOf(store, recordOf(id)));
}

const invalid = (field: string, message: string): AdminError => ({
  kind: "invalid",
  fieldErrors: { [field]: [message] },
});

/**
 * The rules that need the catalogue, with the editor's messages: the quote is
 * from a Review shown on the Website, word for word, and only one FAQ shows
 * the Subjects table. `existing` is the FAQ being saved, or undefined for a
 * new one. A quote it already has is kept while it's unchanged, even if its
 * Review's Product was hidden since: the FAQ page drops it until then.
 */
function faqRules(
  catalogue: CatalogueSeed,
  input: FaqInput,
  existing: Faq | undefined,
): AdminError | null {
  const quote = input.reviewQuote;
  const kept =
    quote !== null &&
    existing?.reviewQuote?.reviewId === quote.reviewId &&
    existing.reviewQuote.text === quote.text;
  if (quote && !kept) {
    const review = catalogue.reviews.find((r) => r.id === quote.reviewId);
    if (!review) {
      return invalid("quoteReviewId", "THAT REVIEW ISN’T IN THE CATALOGUE · PICK ANOTHER");
    }
    if (!quotableReviews(catalogue).some((r) => r.id === review.id)) {
      return invalid("quoteReviewId", "ITS PRODUCT ISN’T ON THE WEBSITE · PICK ANOTHER REVIEW");
    }
    // The seed's rule: the quote appears in the Review, character for character.
    if (!review.text.includes(quote.text)) return invalid("quoteText", QUOTE_NOT_WORD_FOR_WORD);
  }

  const table = input.showCoverageTable
    ? catalogue.faqs.find((faq) => faq.showCoverageTable && faq.id !== existing?.id)
    : undefined;
  if (table) {
    return invalid("showCoverageTable", `“${table.question}” SHOWS IT · ONLY ONE QUESTION CAN`);
  }
  return null;
}

/** A new FAQ's id: after the highest one, like the seed's ("faq-019"). */
function newFaqId(catalogue: CatalogueSeed): string {
  const numbers = catalogue.faqs.map((faq) => Number(/^faq-(\d+)$/.exec(faq.id)?.[1]));
  const next = Math.max(0, ...numbers.filter(Number.isFinite)) + 1;
  return `faq-${String(next).padStart(3, "0")}`;
}

export async function createFaq(actor: StaffActor, input: FaqForm): Promise<AdminResult<AdminFaq>> {
  const id = newFaqId(getSampleStore().catalogue);
  return writeCatalogue(actor, input, undefined, {
    role: "staff",
    schema: faqFormSchema,
    record: recordOf(id),
    check: (catalogue, fields) => faqRules(catalogue, fields, undefined),
    activity: { entity: "faq", entityId: id, action: "create" },
    snapshot: (catalogue) => findFaq(catalogue, id) ?? null,
    apply: (draft, fields) => {
      // The deep link is set from the question now and stays fixed afterwards.
      const slug = faqSlugFor(
        fields.question,
        draft.faqs.map((faq) => faq.slug),
      );
      draft.faqs.push({ id, slug, order: lastPlace(draft, fields.group), ...fields });
    },
    result: (catalogue) => savedFaq(catalogue, id),
    tags: [CATALOGUE_TAGS.faqs],
  });
}

export async function updateFaq(
  actor: StaffActor,
  id: string,
  input: FaqForm,
  expected?: { savedAt: string },
): Promise<AdminResult<AdminFaq>> {
  return writeCatalogue(actor, input, expected, {
    role: "staff",
    schema: faqFormSchema,
    record: recordOf(id),
    exists: exists(id),
    check: (catalogue, fields) => faqRules(catalogue, fields, findFaq(catalogue, id)),
    activity: { entity: "faq", entityId: id, action: "update" },
    snapshot: (catalogue) => findFaq(catalogue, id) ?? null,
    apply: (draft, fields) => {
      const faq = findFaq(draft, id);
      if (!faq) return;
      const from = faq.group;
      // Its id and deep link stay; in another group, it goes last there.
      const order = fields.group === from ? faq.order : lastPlace(draft, fields.group);
      Object.assign(faq, fields, { order });
      if (fields.group !== from) renumber(draft, from);
    },
    result: (catalogue) => savedFaq(catalogue, id),
    tags: [CATALOGUE_TAGS.faqs],
  });
}

/** Why ▲ or ▼ can't move this FAQ, or null when it can. */
function moveRefusal(catalogue: CatalogueSeed, id: string, direction: FaqMove) {
  const faq = findFaq(catalogue, id);
  const order = faq ? groupOrderOf(catalogue, faq.group) : [];
  const index = order.indexOf(id);
  const refuse = (formError: string): AdminError => ({
    kind: "invalid",
    fieldErrors: {},
    formError,
  });
  if (direction === "up" && index === 0) return refuse("IT’S ALREADY FIRST IN ITS GROUP");
  if (direction === "down" && index === order.length - 1) {
    return refuse("IT’S ALREADY LAST IN ITS GROUP");
  }
  return null;
}

export async function moveFaq(
  actor: StaffActor,
  id: string,
  direction: FaqMove,
): Promise<AdminResult<string[]>> {
  const orderOf = (catalogue: CatalogueSeed) => {
    const faq = findFaq(catalogue, id);
    return faq ? groupOrderOf(catalogue, faq.group) : [];
  };
  // Like a single toggle, ▲▼ always saves: there's no form to go stale.
  return writeCatalogue(actor, { direction }, undefined, {
    role: "staff",
    schema: faqMoveSchema,
    record: ORDER_RECORD,
    exists: exists(id),
    check: (catalogue, move) => moveRefusal(catalogue, id, move.direction),
    activity: { entity: "faq", entityId: id, action: "move" },
    snapshot: orderOf,
    apply: (draft, move) => {
      const faq = findFaq(draft, id);
      if (!faq) return;
      const faqs = groupFaqs(draft, faq.group);
      const index = faqs.indexOf(faq);
      const other = faqs[move.direction === "up" ? index - 1 : index + 1];
      if (!other) return;
      [faq.order, other.order] = [other.order, faq.order];
    },
    result: orderOf,
    tags: [CATALOGUE_TAGS.faqs],
  });
}

export async function deleteFaq(actor: StaffActor, id: string): Promise<AdminResult<DeletedFaq>> {
  return writeCatalogue(actor, { id }, undefined, {
    role: "staff",
    schema: faqIdInputSchema,
    record: recordOf(id),
    exists: exists(id),
    activity: { entity: "faq", entityId: id, action: "delete" },
    // Staff Activity keeps every value the delete removes (spec, Phase 2 → Deleting).
    snapshot: (catalogue) => findFaq(catalogue, id) ?? null,
    apply: (draft) => {
      const faq = findFaq(draft, id);
      if (!faq) return;
      draft.faqs = draft.faqs.filter((f) => f.id !== id);
      renumber(draft, faq.group);
    },
    result: () => ({ id }),
    tags: [CATALOGUE_TAGS.faqs],
  });
}
