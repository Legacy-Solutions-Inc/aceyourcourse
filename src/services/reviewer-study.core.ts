import { manilaDate } from "@/lib/manila-time";
import type { MemberAccess, RefusedDecision } from "@/lib/member-app/access";
import { shortMemberId } from "@/lib/member-app/member-id";
import type { ReaderPlace } from "@/lib/reviewer-pdfs/reader";
import type { ReaderPosition, ReviewerPageView } from "@/services/content.types";
import {
  isRecordId,
  memberUserIdSchema,
  readerPositionInputSchema,
  reviewerPageInputSchema,
} from "@/services/member.schema";
import type {
  ContentItem,
  ReaderPositionInput,
  ReviewerPage,
  ReviewerPageInput,
  ReviewerPdfOpening,
  StudyResult,
} from "@/services/member.types";
import type { PageStamper } from "@/services/page-images.types";
import { decide } from "@/services/study-access";

// ─────────────────────────────────────────────────────────────────────────────
// Reading a Reviewer PDF (spec, Phase 3 → Burned-in watermark, Reviewer PDF
// reader, Progress storage and Resume; ticket 14): the Member seam's reader
// calls, written once over a small store port that each arm implements
// (member.mock.ts over the sample store, member.db.ts over Postgres), so both
// arms apply the same rules.
//
// Every call decides the Reviewer PDF with the access decision first, from
// the content as it is now and the Member's side the server gathered for
// this request (src/lib/member-app/access-check.ts): a refused one's pages
// are never read, and nothing is written. A page leaves only stamped with the
// Member's own email and short Member ID, by the stamper its caller passes
// (sharp on the page endpoint, a fake in the tests); the clean page never
// leaves this module. Viewing a page records it, once per Member and page,
// and the day it's viewed in Manila as a Study Day.
// ─────────────────────────────────────────────────────────────────────────────

/** What each arm gives the reader calls. Every read and write is the given Member's own. */
export interface ReviewerStudyStore {
  /** A Reviewer PDF as the access decision reads it, with where it sits, or null when there's none placed with this id. */
  readReviewerPdfItem(reviewerPdfId: string): Promise<ContentItem | null>;
  /** How many pages it has to read: every page its job split, or 0 while it has none. */
  readPageCount(reviewerPdfId: string): Promise<number>;
  /** A page's clean image, or null when it isn't stored: only ever read once the access decision allows it. */
  readPage(reviewerPdfId: string, page: number): Promise<Uint8Array | null>;
  /** The Member's email, as their record holds it, or null for a User with no Member record. */
  readMemberEmail(userId: string): Promise<string | null>;
  /** How many of its pages the Member has viewed. */
  countPagesViewed(userId: string, reviewerPdfId: string): Promise<number>;
  /** The page and zoom the Member left it at, or null. */
  readPosition(userId: string, reviewerPdfId: string): Promise<ReaderPlace | null>;
  /**
   * Records the page viewed, unless the Member viewed it before, and the Study
   * Day, once per day, together. False, recording nothing, when the Reviewer
   * PDF has gone meanwhile.
   */
  saveView(view: ReviewerPageView, day: string): Promise<boolean>;
  /**
   * Saves where the Member is, replacing their earlier place in it. False,
   * saving nothing, when the Reviewer PDF has gone meanwhile. Throws for a
   * User with no Member record.
   */
  savePosition(position: ReaderPosition): Promise<boolean>;
}

const NOT_FOUND = { ok: false, refusal: { reason: "not-found" } } as const;
const refused = (decision: RefusedDecision) =>
  ({ ok: false, refusal: { reason: "refused", decision } }) as const;

/** The reader calls over one arm's store (the Member seam's contract, in member.ts). */
export function reviewerStudyCalls(store: ReviewerStudyStore) {
  /** A Reviewer PDF by an id the browser sent, or null when it isn't one. */
  const itemOf = (reviewerPdfId: string) =>
    isRecordId(reviewerPdfId) ? store.readReviewerPdfItem(reviewerPdfId) : Promise.resolve(null);

  /** Whether a page number is one of these pages. */
  const isPageOf = (page: number, pageCount: number) =>
    Number.isInteger(page) && page >= 1 && page <= pageCount;

  async function openReviewerPdf(
    userId: string,
    reviewerPdfId: string,
    access: MemberAccess,
  ): Promise<ReviewerPdfOpening> {
    const member = memberUserIdSchema.parse(userId);
    const item = await itemOf(reviewerPdfId);
    if (!item) return { status: "not-found" };

    const decided = decide(item, access);
    if (!decided.allowed) {
      const viewed = await store.countPagesViewed(member, item.id);
      return { status: "refused", item, decision: decided.decision, viewed };
    }

    const pageCount = await store.readPageCount(item.id);
    const leftAt = await store.readPosition(member, item.id);
    return {
      status: "allowed",
      item,
      via: decided.via,
      reviewerPdf: {
        pageCount,
        resumeAt: leftAt && isPageOf(leftAt.page, pageCount) ? leftAt : null,
      },
    };
  }

  async function readReviewerPage(
    userId: string,
    input: ReviewerPageInput,
    access: MemberAccess,
    stamper: PageStamper,
  ): Promise<ReviewerPage> {
    const member = memberUserIdSchema.parse(userId);
    const { reviewerPdfId, page } = reviewerPageInputSchema.parse(input);
    // The address is the browser's: a Reviewer PDF that isn't one has no page.
    const item = await itemOf(reviewerPdfId);
    if (!item) return { status: "not-found" };

    // The access decision first, then the page's range: no Member learns a refused one's length.
    const decided = decide(item, access);
    if (!decided.allowed) return { status: "refused", decision: decided.decision };
    if (!isPageOf(page, await store.readPageCount(item.id))) return { status: "not-found" };
    const clean = await store.readPage(item.id, page);
    if (!clean) return { status: "not-found" };

    const email = await store.readMemberEmail(member);
    if (email === null) throw new Error("Only a Member has study records.");
    const image = await stamper.stamp(clean, { email, memberId: shortMemberId(member) });

    // Viewing a page is studying: the day it's viewed in Manila is a Study Day.
    const view = {
      userId: member,
      reviewerPdfId: item.id,
      page,
      viewedAt: access.now.toISOString(),
    };
    if (!(await store.saveView(view, manilaDate(access.now)))) return { status: "not-found" };
    return { status: "page", image };
  }

  async function saveReaderPosition(
    userId: string,
    input: ReaderPositionInput,
    access: MemberAccess,
  ): Promise<StudyResult<ReaderPlace>> {
    const member = memberUserIdSchema.parse(userId);
    const { reviewerPdfId, page, zoom } = readerPositionInputSchema.parse(input);
    const item = await itemOf(reviewerPdfId);
    if (!item) return NOT_FOUND;
    const decided = decide(item, access);
    if (!decided.allowed) return refused(decided.decision);
    if (!isPageOf(page, await store.readPageCount(item.id))) return NOT_FOUND;

    const position: ReaderPosition = {
      userId: member,
      reviewerPdfId: item.id,
      page,
      zoom,
      savedAt: access.now.toISOString(),
    };
    if (!(await store.savePosition(position))) return NOT_FOUND;
    return { ok: true, value: { page, zoom } };
  }

  return { openReviewerPdf, readReviewerPage, saveReaderPosition };
}
