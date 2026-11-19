import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import { shortMemberId } from "@/lib/member-app/member-id";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import {
  createFakeRenderer,
  FAKE_PAGE_IMAGE,
  fakeStamped,
  fakeStamper,
} from "@/services/page-images.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { pdfOfPages } from "../../test/reviewer-pdfs";

// Reading a Reviewer PDF through the Member seam (spec, Phase 3 → Burned-in
// watermark, Reviewer PDF reader, Progress storage and Resume; stories 101,
// 102 and 105), run against every arm: opening one through the access
// decision, each page stamped with the Member's own details (here by the
// fake stamper; sharp's is page-images.sharp.test.ts), the pages each Member
// viewed (once per page), the Study Day, and the page and zoom they left it
// at. An Editor uploads a 3-page PDF, which the fake renderer splits, and
// places it under CE MSTC's Surveying; it's 17 Nov 2026, 11:42 in Manila. The
// tester's CE pass ends 90 days after; the lapsed tester's ended 3 days
// before; the stranger has none.
const BOOT = new Date("2026-11-17T03:42:00.000Z");
const EDITOR = sampleActor("editor");
const SURVEYING = sampleTopicId("CE", "MSTC", "Surveying");
const SIMPLE_CURVES = sampleTopicId("CE", "MSTC", "Simple Curves");
/** The sample data's Published Reviewer PDF, from before uploads: it has no pages. */
const SAMPLE_PUBLISHED = sampleContentId(SIMPLE_CURVES, "reviewer-pdf");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

const MEMBERS = {
  tester: { email: "tester@example.com", name: "Bea Tester" },
  lapsed: { email: "lapsed@example.com", name: "Lou Lapsed" },
  stranger: { email: "stranger@example.com", name: "Sam Stranger" },
} as const;
type Who = keyof typeof MEMBERS;
const userOf = (who: Who) => sampleUserId(MEMBERS[who].email);
/** The page `who` is sent: the clean page, stamped with their email and short Member ID. */
const stampedFor = (who: Who) =>
  fakeStamped(FAKE_PAGE_IMAGE, { email: MEMBERS[who].email, memberId: shortMemberId(userOf(who)) });

describe.each(MEMBER_ARMS)("Member seam reading a Reviewer PDF ($name)", (arm) => {
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

  /** An Editor's 3-page upload, split by its job and placed under Surveying: a Draft. */
  async function placedDraft(): Promise<string> {
    const path = await arm.uploadReviewerPdf(pdfOfPages(3));
    const recorded = await arm.admin.recordReviewerPdf(EDITOR, { path, fileName: "Surveying.pdf" });
    if (!recorded.ok) throw new Error("The Reviewer PDF wasn't recorded");
    const { id } = recorded.value;
    while ((await arm.admin.runReviewerPdfJob(id, createFakeRenderer())) === "more");
    const placed = await arm.admin.placeReviewerPdf(EDITOR, { id, topic: SURVEYING });
    if (!placed.ok) throw new Error("The Reviewer PDF wasn't placed");
    return id;
  }

  /** The same, Published, and Free Preview when asked. */
  async function published({ freePreview = false } = {}): Promise<string> {
    const id = await placedDraft();
    if (freePreview) await arm.admin.setReviewerPdfFreePreview(EDITOR, id, true);
    await arm.admin.setReviewerPdfPublished(EDITOR, id, true);
    return id;
  }

  const open = async (who: Who, id: string, overrides: Partial<MemberAccess> = {}) =>
    seam.openReviewerPdf(userOf(who), id, await accessOf(who, overrides));
  const read = async (who: Who, id: string, page: number, overrides: Partial<MemberAccess> = {}) =>
    seam.readReviewerPage(
      userOf(who),
      { reviewerPdfId: id, page },
      await accessOf(who, overrides),
      fakeStamper,
    );
  const savePosition = async (
    who: Who,
    id: string,
    place: { page: number; zoom: number },
    overrides: Partial<MemberAccess> = {},
  ) =>
    seam.saveReaderPosition(
      userOf(who),
      { reviewerPdfId: id, ...place },
      await accessOf(who, overrides),
    );

  /** The Member's progress in a Reviewer PDF, as opening it gives it. */
  async function progressOf(who: Who, id: string, overrides: Partial<MemberAccess> = {}) {
    const opening = await open(who, id, overrides);
    if (opening.status !== "allowed") throw new Error(`Not opened: ${opening.status}`);
    return opening.reviewerPdf;
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

  describe("openReviewerPdf", () => {
    it("opens a Published one the Member's pass allows: its pages, and their own progress", async () => {
      const id = await published();

      expect(await open("tester", id)).toEqual({
        status: "allowed",
        via: "pass",
        item: expect.objectContaining({
          kind: "reviewer-pdf",
          id,
          subjectCode: "MSTC",
          topicName: "Surveying",
          available: true,
        }),
        reviewerPdf: { pageCount: 3, resumeAt: null },
      });
    });

    it("opens a Free Preview one for a Member with no pass, and any Published one for active Staff", async () => {
      const free = await published({ freePreview: true });
      expect(await open("stranger", free)).toMatchObject({
        status: "allowed",
        via: "free-preview",
      });

      await arm.admin.setReviewerPdfFreePreview(EDITOR, free, false);
      expect(await open("stranger", free, { activeStaff: true })).toMatchObject({
        status: "allowed",
        via: "staff",
      });
    });

    it("refuses a locked one and an expired one, counting the pages the Member viewed, kept", async () => {
      const id = await published({ freePreview: true });
      await read("lapsed", id, 1);
      await read("lapsed", id, 2);
      await arm.admin.setReviewerPdfFreePreview(EDITOR, id, false);

      expect(await open("stranger", id)).toEqual({
        status: "refused",
        item: expect.objectContaining({ id }),
        decision: { outcome: "locked" },
        viewed: 0,
      });
      expect(await open("lapsed", id)).toEqual({
        status: "refused",
        item: expect.objectContaining({ id }),
        decision: { outcome: "expired", passEndedAt: expect.any(String) },
        viewed: 2,
      });
    });

    it("says a Draft or an Unpublished one is no longer available, even to Staff", async () => {
      const id = await placedDraft();
      expect(await open("tester", id, { activeStaff: true })).toMatchObject({
        status: "refused",
        decision: { outcome: "unavailable" },
      });

      await arm.admin.setReviewerPdfPublished(EDITOR, id, true);
      await arm.admin.setReviewerPdfPublished(EDITOR, id, false);
      expect(await open("tester", id)).toMatchObject({
        status: "refused",
        decision: { outcome: "unavailable" },
      });
    });

    it("refuses a replaced device and a request with no device token", async () => {
      const id = await published();
      expect(await open("tester", id, { device: "replaced" })).toMatchObject({
        status: "refused",
        decision: { outcome: "device-replaced" },
      });
      expect(await open("tester", id, { device: "no-token" })).toMatchObject({
        status: "refused",
        decision: { outcome: "no-token" },
      });
    });

    it("opens the sample data's Published one, from before uploads, with no pages yet", async () => {
      expect(await open("tester", SAMPLE_PUBLISHED)).toMatchObject({
        status: "allowed",
        reviewerPdf: { pageCount: 0, resumeAt: null },
      });
    });

    it("finds none for an id that isn't a Reviewer PDF's", async () => {
      for (const id of [UNKNOWN, "not-an-id", sampleContentId(SIMPLE_CURVES, "deck")]) {
        expect(await open("tester", id)).toEqual({ status: "not-found" });
      }
    });
  });

  describe("readReviewerPage", () => {
    it("gives the page stamped with the Member's email and short Member ID, recording it viewed and the day a Study Day", async () => {
      const id = await published();

      expect(await read("tester", id, 2)).toEqual({ status: "page", image: stampedFor("tester") });

      expect(await arm.pageViews()).toEqual([
        { userId: userOf("tester"), reviewerPdfId: id, page: 2, viewedAt: BOOT.toISOString() },
      ]);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17"]);
    });

    it("stamps each Member's copy of the same page with their own details", async () => {
      const id = await published({ freePreview: true });
      const mine = await read("tester", id, 1);
      const theirs = await read("stranger", id, 1);

      expect(mine).toEqual({ status: "page", image: stampedFor("tester") });
      expect(theirs).toEqual({ status: "page", image: stampedFor("stranger") });
    });

    it("records a page viewed twice once, from the first time", async () => {
      const id = await published();
      await read("tester", id, 3);
      vi.setSystemTime(new Date(BOOT.getTime() + 60 * 60 * 1000));
      await read("tester", id, 3);
      await read("tester", id, 1);

      expect(await arm.pageViews()).toEqual([
        {
          userId: userOf("tester"),
          reviewerPdfId: id,
          page: 1,
          viewedAt: "2026-11-17T04:42:00.000Z",
        },
        { userId: userOf("tester"), reviewerPdfId: id, page: 3, viewedAt: BOOT.toISOString() },
      ]);
    });

    it("records a new Study Day for a page viewed just after Manila midnight, not before", async () => {
      const id = await published();
      // 23:59:59 on 17 Nov in Manila (UTC+8), then midnight.
      vi.setSystemTime(new Date("2026-11-17T15:59:59.000Z"));
      await read("tester", id, 1);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17"]);

      vi.setSystemTime(new Date("2026-11-17T16:00:00.000Z"));
      await read("tester", id, 2);
      expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17", "2026-11-18"]);
    });

    it("refuses a locked or expired Member's page with no image, recording nothing", async () => {
      const id = await published();

      expect(await read("stranger", id, 1)).toEqual({
        status: "refused",
        decision: { outcome: "locked" },
      });
      expect(await read("lapsed", id, 1)).toEqual({
        status: "refused",
        decision: { outcome: "expired", passEndedAt: expect.any(String) },
      });
      // Decided before the page's range: a page it doesn't have is refused the same.
      expect(await read("stranger", id, 99)).toEqual({
        status: "refused",
        decision: { outcome: "locked" },
      });
      expect(await arm.pageViews()).toEqual([]);
      expect(await seam.listStudyDays(userOf("stranger"))).toEqual([]);
      expect(await seam.listStudyDays(userOf("lapsed"))).toEqual([]);
    });

    it("refuses an Unpublished or Draft one's pages as no longer available", async () => {
      const draft = await placedDraft();
      expect(await read("tester", draft, 1, { activeStaff: true })).toEqual({
        status: "refused",
        decision: { outcome: "unavailable" },
      });

      await arm.admin.setReviewerPdfPublished(EDITOR, draft, true);
      await arm.admin.setReviewerPdfPublished(EDITOR, draft, false);
      expect(await read("tester", draft, 1)).toEqual({
        status: "refused",
        decision: { outcome: "unavailable" },
      });
      expect(await arm.pageViews()).toEqual([]);
    });

    it("refuses a replaced device, and a request with no device token", async () => {
      const id = await published();
      expect(await read("tester", id, 1, { device: "replaced" })).toEqual({
        status: "refused",
        decision: { outcome: "device-replaced" },
      });
      expect(await read("tester", id, 1, { device: "no-token" })).toEqual({
        status: "refused",
        decision: { outcome: "no-token" },
      });
      expect(await arm.pageViews()).toEqual([]);
    });

    it("has no page below 1, past the last, or of a Reviewer PDF that isn't one", async () => {
      const id = await published();
      for (const page of [0, -1, 4, 1.5]) {
        expect(await read("tester", id, page)).toEqual({ status: "not-found" });
      }
      expect(await read("tester", UNKNOWN, 1)).toEqual({ status: "not-found" });
      expect(await read("tester", "not-an-id", 1)).toEqual({ status: "not-found" });
      // The sample data's Published one has no pages at all.
      expect(await read("tester", SAMPLE_PUBLISHED, 1)).toEqual({ status: "not-found" });
      expect(await arm.pageViews()).toEqual([]);
    });

    it("refuses a User id that isn't one", async () => {
      const id = await published();
      await expect(
        seam.readReviewerPage(
          "tester",
          { reviewerPdfId: id, page: 1 },
          await accessOf("tester"),
          fakeStamper,
        ),
      ).rejects.toThrow();
    });
  });

  describe("saveReaderPosition", () => {
    it("saves the page and zoom the Reviewer PDF then reopens at, replacing the last", async () => {
      const id = await published();

      expect(await savePosition("tester", id, { page: 2, zoom: 125 })).toEqual({
        ok: true,
        value: { page: 2, zoom: 125 },
      });
      expect((await progressOf("tester", id)).resumeAt).toEqual({ page: 2, zoom: 125 });

      await savePosition("tester", id, { page: 3, zoom: 75 });
      expect((await progressOf("tester", id)).resumeAt).toEqual({ page: 3, zoom: 75 });
    });

    it("keeps each Member's place and pages viewed to themselves", async () => {
      const id = await published({ freePreview: true });
      await savePosition("tester", id, { page: 3, zoom: 150 });
      await read("tester", id, 3);

      expect(await progressOf("stranger", id)).toEqual({ pageCount: 3, resumeAt: null });
      // The tester's pages viewed aren't counted as theirs when it locks.
      await arm.admin.setReviewerPdfFreePreview(EDITOR, id, false);
      expect(await open("stranger", id)).toMatchObject({ status: "refused", viewed: 0 });
    });

    it("refuses a locked Member's place, saving nothing", async () => {
      const id = await published();
      expect(await savePosition("stranger", id, { page: 2, zoom: 100 })).toEqual({
        ok: false,
        refusal: { reason: "refused", decision: { outcome: "locked" } },
      });
      expect((await progressOf("stranger", id, { activeStaff: true })).resumeAt).toBeNull();
    });

    it("refuses a page it doesn't have, or a Reviewer PDF that isn't one", async () => {
      const id = await published();
      for (const page of [0, 4]) {
        expect(await savePosition("tester", id, { page, zoom: 100 })).toEqual({
          ok: false,
          refusal: { reason: "not-found" },
        });
      }
      expect(await savePosition("tester", UNKNOWN, { page: 1, zoom: 100 })).toEqual({
        ok: false,
        refusal: { reason: "not-found" },
      });
      expect((await progressOf("tester", id)).resumeAt).toBeNull();
    });

    it("throws for a zoom the reader doesn't offer", async () => {
      const id = await published();
      await expect(savePosition("tester", id, { page: 1, zoom: 110 })).rejects.toThrow();
    });
  });

  it("deletes the Members' pages viewed and places with the Reviewer PDF", async () => {
    const id = await published();
    await read("tester", id, 1);
    await savePosition("tester", id, { page: 1, zoom: 125 });
    await arm.admin.setReviewerPdfPublished(EDITOR, id, false);

    const deleted = await arm.admin.deleteReviewerPdf(EDITOR, id);
    expect(deleted.ok).toBe(true);

    expect(await arm.pageViews()).toEqual([]);
    expect(await open("tester", id)).toEqual({ status: "not-found" });
    // The Study Day stays: the Member did study that day.
    expect(await seam.listStudyDays(userOf("tester"))).toEqual(["2026-11-17"]);
  });
});
