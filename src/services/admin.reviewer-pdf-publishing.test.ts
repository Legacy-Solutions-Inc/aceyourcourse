import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHOOSE_A_TOPIC,
  NO_PAGES,
  NOT_PUBLISHED,
  SPLIT_FAILED,
  STILL_SPLITTING,
  TOPIC_GONE,
  TOPIC_TAKEN,
  UNPUBLISH_TO_MOVE,
} from "@/lib/reviewer-pdfs/status";
import type { AdminResult, StaffActivity } from "@/services/admin.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { createFakeRenderer, FAKE_PAGE_IMAGE } from "@/services/page-images.fake";

import { sampleActor } from "../../test/admin-inputs";
import { ADMIN_ARMS } from "../../test/admin-arms";
import { pdfOfPages } from "../../test/reviewer-pdfs";

// Placing, previewing and publishing a Reviewer PDF (Phase 3, ticket 13;
// stories 116, 128, 133o; spec, Phase 3 → Content model, Topics editor), run
// against each arm: an Editor places a Draft under a Topic (one Reviewer PDF
// per Topic, with the conflict check), creating the Topic first if need be,
// previews its pages, publishes it (needing a Topic and a job that split
// every page), unpublishes and publishes it again, and flags it Free
// Preview. Each change is one Staff Activity record. The sample data's MSTC
// has Simple Curves (a Published Reviewer PDF), Spiral Curves (a Draft one,
// with no pages: it's from before uploads), and Surveying and Algebra (none).

const EDITOR = sampleActor("editor");
const OWNER = sampleActor("owner");
const START = new Date("2026-11-18T08:00:00.000Z");
const renderer = createFakeRenderer();

const topic = (subject: string, name: string) => sampleTopicId("CE", subject, name);
const SIMPLE_CURVES = topic("MSTC", "Simple Curves");
const SPIRAL_CURVES = topic("MSTC", "Spiral Curves");
const SURVEYING = topic("MSTC", "Surveying");
const ALGEBRA = topic("MSTC", "Algebra");
const SAMPLE_PUBLISHED = sampleContentId(SIMPLE_CURVES, "reviewer-pdf");
const SAMPLE_DRAFT = sampleContentId(SPIRAL_CURVES, "reviewer-pdf");
const UNKNOWN = "3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b";

/** Pure: a save's value, or the test fails saying why it was refused. */
function savedValue<T>(result: AdminResult<T>): T {
  if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result.error)}`);
  return result.value;
}

const SURVEYING_PLACEMENT = { examCode: "CE", subjectCode: "MSTC", topicName: "Surveying" };

describe.each(ADMIN_ARMS)("Placing and publishing Reviewer PDFs ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: START });
    await arm.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** An upload recorded and not yet split: Processing. */
  async function processing(bytes: Uint8Array = pdfOfPages(3)): Promise<string> {
    const path = await arm.uploadReviewerPdf(bytes);
    return savedValue(await seam.recordReviewerPdf(EDITOR, { path, fileName: "MSTC Reviewer.pdf" }))
      .id;
  }

  /** An upload split into every page by its job: a Draft, not placed yet. */
  async function draft(bytes: Uint8Array = pdfOfPages(3)): Promise<string> {
    const id = await processing(bytes);
    for (let run = 0; run < 20; run++) {
      if ((await seam.runReviewerPdfJob(id, renderer)) !== "more") return id;
    }
    throw new Error("The job never finished");
  }

  /** A Draft placed under Surveying, as an Editor leaves one ready to publish. */
  async function placedDraft(): Promise<string> {
    const id = await draft();
    savedValue(await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING }));
    return id;
  }

  const screen = async (id: string) => {
    const found = await seam.getReviewerPdfForAdmin(EDITOR, id);
    if (!found) throw new Error(`No Reviewer PDF ${id}`);
    return found;
  };
  const activitySince = async (count: number): Promise<StaffActivity[]> =>
    (await arm.staffActivity()).slice(count);
  const activityCount = async () => (await arm.staffActivity()).length;

  describe("its screen", () => {
    it("gives a new Draft with its upload, not placed, not Free Preview, and the data's stamp", async () => {
      const id = await draft();

      const { pdf } = await screen(id);

      expect(pdf).toMatchObject({
        id,
        status: "draft",
        placement: null,
        topicId: null,
        freePreview: false,
        upload: { fileName: "MSTC Reviewer.pdf", pageCount: 3, pagesDone: 3 },
        stamp: { savedBy: null },
      });
    });

    it("lists every Topic it can go under, in order, each with the Reviewer PDF already there", async () => {
      const id = await draft();

      const { topics } = await screen(id);

      const mstc = topics.filter((each) => each.examCode === "CE" && each.subjectCode === "MSTC");
      expect(mstc.map(({ name, reviewerPdfId }) => [name, reviewerPdfId])).toEqual([
        ["Simple Curves", SAMPLE_PUBLISHED],
        ["Spiral Curves", SAMPLE_DRAFT],
        ["Surveying", null],
        ["Algebra", null],
      ]);
      expect(topics.map((each) => each.subjectCode)).toContain("HPGE");
    });

    it("gives nothing for an id that isn't a Reviewer PDF's, or isn't an id", async () => {
      expect(await seam.getReviewerPdfForAdmin(EDITOR, UNKNOWN)).toBeNull();
      expect(await seam.getReviewerPdfForAdmin(EDITOR, "simple-curves")).toBeNull();
    });
  });

  describe("placing it under a Topic", () => {
    it("places a Draft, stamps the placement, and records where it was and where it went", async () => {
      const id = await draft();
      const before = await activityCount();
      vi.setSystemTime(new Date(START.getTime() + 60_000));

      const placed = savedValue(
        await seam.placeReviewerPdf(
          EDITOR,
          { id, topic: SURVEYING },
          { savedAt: START.toISOString() },
        ),
      );

      expect(placed).toMatchObject({
        topicId: SURVEYING,
        placement: SURVEYING_PLACEMENT,
        status: "draft",
        stamp: { savedBy: EDITOR.name, savedAt: "2026-11-18T08:01:00.000Z" },
      });
      expect((await screen(id)).pdf).toEqual(placed);
      expect(
        (await seam.listReviewerPdfsForAdmin(EDITOR)).find((pdf) => pdf.id === id),
      ).toMatchObject({ placement: SURVEYING_PLACEMENT });
      expect(await activitySince(before)).toEqual([
        expect.objectContaining({
          actor: { email: EDITOR.email, name: EDITOR.name },
          entity: "reviewer-pdf",
          entityId: id,
          action: "place",
          before: { placement: null },
          after: { placement: SURVEYING_PLACEMENT },
        }),
      ]);
    });

    it("places it under a Topic made with “+ New topic”, by the Topics editor's rules", async () => {
      const id = await draft();
      const made = savedValue(
        await seam.createTopic(EDITOR, { exam: "CE", subject: "MSTC", name: "Transition Curves" }),
      );

      savedValue(await seam.placeReviewerPdf(EDITOR, { id, topic: made.id }));

      const list = await seam.listTopicsForAdmin(EDITOR, "CE", "MSTC");
      expect(list?.topics.at(-1)).toMatchObject({
        name: "Transition Curves",
        content: { reviewerPdf: "draft" },
        // A Topic with a Reviewer PDF can't be deleted.
        deleteBlocker: expect.stringContaining("Reviewer PDF"),
      });
    });

    it("refuses a “+ New topic” whose name the Subject has already, whatever its case", async () => {
      const result = await seam.createTopic(EDITOR, {
        exam: "CE",
        subject: "MSTC",
        name: "simple curves",
      });

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { name: [expect.stringContaining("MSTC")] } },
      });
    });

    it("refuses a Topic that already has a Reviewer PDF, changing and recording nothing", async () => {
      const id = await draft();
      const before = await activityCount();

      const result = await seam.placeReviewerPdf(EDITOR, { id, topic: SIMPLE_CURVES });

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { topic: [TOPIC_TAKEN] } },
      });
      expect((await screen(id)).pdf.topicId).toBeNull();
      expect(await activitySince(before)).toEqual([]);
    });

    it("moves a placed one to another Topic, leaving the first free", async () => {
      const id = await draft();
      const first = savedValue(await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING }));

      const moved = savedValue(
        await seam.placeReviewerPdf(EDITOR, { id, topic: ALGEBRA }, first.stamp),
      );

      expect(moved.placement).toEqual({
        examCode: "CE",
        subjectCode: "MSTC",
        topicName: "Algebra",
      });
      const { topics } = await screen(id);
      expect(topics.find((each) => each.id === SURVEYING)?.reviewerPdfId).toBeNull();
      expect(topics.find((each) => each.id === ALGEBRA)?.reviewerPdfId).toBe(id);
      expect((await arm.staffActivity()).at(-1)).toMatchObject({
        action: "place",
        before: { placement: SURVEYING_PLACEMENT },
        after: { placement: moved.placement },
      });
    });

    it("changes and records nothing when it's placed where it is already", async () => {
      const id = await draft();
      const first = savedValue(await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING }));
      const before = await activityCount();

      const again = savedValue(
        await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING }, first.stamp),
      );

      expect(again.stamp).toEqual(first.stamp);
      expect(await activitySince(before)).toEqual([]);
    });

    it("refuses a stale form: another Staff User placed it since, and the conflict names them", async () => {
      const id = await draft();
      const opened = (await screen(id)).pdf.stamp;
      vi.setSystemTime(new Date(START.getTime() + 60_000));
      savedValue(await seam.placeReviewerPdf(OWNER, { id, topic: SURVEYING }, opened));
      const before = await activityCount();

      const result = await seam.placeReviewerPdf(EDITOR, { id, topic: ALGEBRA }, opened);

      expect(result).toEqual({
        ok: false,
        error: { kind: "conflict", savedBy: OWNER.name, savedAt: "2026-11-18T08:01:00.000Z" },
      });
      expect((await screen(id)).pdf.topicId).toBe(SURVEYING);
      expect(await activitySince(before)).toEqual([]);
    });

    it("waits until it's split into pages, so a job that then fails never holds a Topic", async () => {
      const id = await processing();

      const result = await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING });

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: STILL_SPLITTING },
      });
      expect((await screen(id)).pdf.topicId).toBeNull();
    });

    it("refuses moving a Published one until it's unpublished, then moves it", async () => {
      const id = await placedDraft();
      savedValue(await seam.setReviewerPdfPublished(EDITOR, id, true));
      const opened = (await screen(id)).pdf.stamp;

      expect(await seam.placeReviewerPdf(EDITOR, { id, topic: ALGEBRA }, opened)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: UNPUBLISH_TO_MOVE },
      });
      // Saving it where it is changes nothing, so nothing refuses it.
      expect((await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING }, opened)).ok).toBe(true);
      expect((await screen(id)).pdf.topicId).toBe(SURVEYING);

      savedValue(await seam.setReviewerPdfPublished(EDITOR, id, false));
      const moved = savedValue(await seam.placeReviewerPdf(EDITOR, { id, topic: ALGEBRA }, opened));
      expect(moved).toMatchObject({ status: "unpublished", topicId: ALGEBRA });
    });

    it("refuses a Failed one, so it never holds the Topic its new upload needs", async () => {
      const id = await draft(pdfOfPages(2, { encrypted: true }));
      expect((await screen(id)).pdf.status).toBe("failed");

      const result = await seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING });

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: SPLIT_FAILED },
      });
    });

    it("refuses a Topic that's gone, no Topic at all, and a Reviewer PDF that isn't there", async () => {
      const id = await draft();

      expect(await seam.placeReviewerPdf(EDITOR, { id, topic: UNKNOWN })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { topic: [TOPIC_GONE] } },
      });
      expect(await seam.placeReviewerPdf(EDITOR, { id, topic: "" })).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: { topic: ["CHOOSE A TOPIC"] } },
      });
      expect(await seam.placeReviewerPdf(EDITOR, { id: UNKNOWN, topic: SURVEYING })).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("saves nothing when its Staff Activity can't be recorded", async () => {
      const id = await draft();
      const repair = await arm.breakStaffActivity();

      await expect(seam.placeReviewerPdf(EDITOR, { id, topic: SURVEYING })).rejects.toThrow();

      await repair();
      expect((await screen(id)).pdf).toMatchObject({ topicId: null, stamp: { savedBy: null } });
    });

    it("leaves its Topic free once it's deleted, for the next upload", async () => {
      const id = await placedDraft();
      savedValue(await seam.deleteReviewerPdf(EDITOR, id));
      const next = await draft();

      const placed = await seam.placeReviewerPdf(EDITOR, { id: next, topic: SURVEYING });

      expect(placed.ok).toBe(true);
      // The new one's placement has its own stamp, not the deleted one's.
      expect(savedValue(placed).stamp.savedBy).toBe(EDITOR.name);
    });
  });

  describe("publishing and unpublishing", () => {
    it("publishes a placed Draft, unpublishes it to Unpublished, and publishes it again, each recorded", async () => {
      const id = await placedDraft();
      const before = await activityCount();

      expect(savedValue(await seam.setReviewerPdfPublished(EDITOR, id, true)).status).toBe(
        "published",
      );
      expect(savedValue(await seam.setReviewerPdfPublished(EDITOR, id, false)).status).toBe(
        "unpublished",
      );
      expect(savedValue(await seam.setReviewerPdfPublished(OWNER, id, true)).status).toBe(
        "published",
      );

      expect(
        (await activitySince(before)).map(({ entity, entityId, action, before: was, after }) => ({
          entity,
          entityId,
          action,
          was,
          after,
        })),
      ).toEqual([
        {
          entity: "reviewer-pdf",
          entityId: id,
          action: "publish",
          was: { status: "draft" },
          after: { status: "published" },
        },
        {
          entity: "reviewer-pdf",
          entityId: id,
          action: "unpublish",
          was: { status: "published" },
          after: { status: "unpublished" },
        },
        {
          entity: "reviewer-pdf",
          entityId: id,
          action: "publish",
          was: { status: "unpublished" },
          after: { status: "published" },
        },
      ]);
    });

    it("leaves the placement's stamp as it is, so an open placement form still saves", async () => {
      const id = await placedDraft();
      const opened = (await screen(id)).pdf.stamp;

      savedValue(await seam.setReviewerPdfPublished(EDITOR, id, true));
      savedValue(await seam.setReviewerPdfPublished(EDITOR, id, false));
      savedValue(await seam.setReviewerPdfFreePreview(EDITOR, id, true));

      expect((await screen(id)).pdf.stamp).toEqual(opened);
      expect((await seam.placeReviewerPdf(EDITOR, { id, topic: ALGEBRA }, opened)).ok).toBe(true);
    });

    it("refuses publishing one with no Topic, changing and recording nothing", async () => {
      const id = await draft();
      const before = await activityCount();

      const result = await seam.setReviewerPdfPublished(EDITOR, id, true);

      expect(result).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: CHOOSE_A_TOPIC },
      });
      expect((await screen(id)).pdf.status).toBe("draft");
      expect(await activitySince(before)).toEqual([]);
    });

    it("refuses publishing an upload still being split into pages", async () => {
      const id = await processing();

      expect(await seam.setReviewerPdfPublished(EDITOR, id, true)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: STILL_SPLITTING },
      });
      expect((await screen(id)).pdf.status).toBe("processing");
    });

    it("refuses publishing an upload whose job failed", async () => {
      const id = await draft(pdfOfPages(2, { encrypted: true }));

      expect(await seam.setReviewerPdfPublished(EDITOR, id, true)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: SPLIT_FAILED },
      });
      expect((await screen(id)).pdf.status).toBe("failed");
    });

    it("refuses publishing the sample data's Draft, which has no pages, but unpublishes its Published one", async () => {
      expect(await seam.setReviewerPdfPublished(EDITOR, SAMPLE_DRAFT, true)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: NO_PAGES },
      });

      expect(
        savedValue(await seam.setReviewerPdfPublished(EDITOR, SAMPLE_PUBLISHED, false)).status,
      ).toBe("unpublished");
    });

    it("refuses unpublishing a Draft", async () => {
      const id = await placedDraft();

      expect(await seam.setReviewerPdfPublished(EDITOR, id, false)).toEqual({
        ok: false,
        error: { kind: "invalid", fieldErrors: {}, formError: NOT_PUBLISHED },
      });
    });

    it("changes and records nothing when it's as asked already, as a second press finds it", async () => {
      const id = await placedDraft();
      savedValue(await seam.setReviewerPdfPublished(EDITOR, id, true));
      const before = await activityCount();

      expect(savedValue(await seam.setReviewerPdfPublished(EDITOR, id, true)).status).toBe(
        "published",
      );
      expect(await activitySince(before)).toEqual([]);
    });

    it("refuses a Reviewer PDF that isn't there, and an input that isn't on or off", async () => {
      expect(await seam.setReviewerPdfPublished(EDITOR, UNKNOWN, true)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      const result = await seam.setReviewerPdfPublished(
        EDITOR,
        UNKNOWN,
        "yes" as unknown as boolean,
      );
      expect(result).toMatchObject({ ok: false, error: { kind: "invalid" } });
    });
  });

  describe("Free Preview", () => {
    it("flags it Free Preview and back, each recorded, whatever its status", async () => {
      const id = await draft();
      const before = await activityCount();

      expect(savedValue(await seam.setReviewerPdfFreePreview(EDITOR, id, true)).freePreview).toBe(
        true,
      );
      expect((await screen(id)).pdf.freePreview).toBe(true);
      expect(savedValue(await seam.setReviewerPdfFreePreview(EDITOR, id, false)).freePreview).toBe(
        false,
      );

      expect(
        (await activitySince(before)).map(({ action, before: was, after }) => [action, was, after]),
      ).toEqual([
        ["free-preview", { freePreview: false }, { freePreview: true }],
        ["free-preview", { freePreview: true }, { freePreview: false }],
      ]);
    });

    it("records nothing when it's as asked already, and refuses one that isn't there", async () => {
      const id = await draft();
      const before = await activityCount();

      savedValue(await seam.setReviewerPdfFreePreview(EDITOR, id, false));

      expect(await activitySince(before)).toEqual([]);
      expect(await seam.setReviewerPdfFreePreview(EDITOR, UNKNOWN, true)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("its preview's pages", () => {
    it("gives each page its job stored, and nothing past them", async () => {
      const id = await draft();

      for (const page of [1, 2, 3]) {
        expect(await seam.getReviewerPdfPageForAdmin(EDITOR, id, page)).toEqual(FAKE_PAGE_IMAGE);
      }
      expect(await seam.getReviewerPdfPageForAdmin(EDITOR, id, 4)).toBeNull();
      expect(await seam.getReviewerPdfPageForAdmin(EDITOR, id, 0)).toBeNull();
      expect(await seam.getReviewerPdfPageForAdmin(EDITOR, id, 1.5)).toBeNull();
    });

    it("gives nothing for one not split yet, one with no file, or an id that isn't one", async () => {
      expect(await seam.getReviewerPdfPageForAdmin(EDITOR, await processing(), 1)).toBeNull();
      expect(await seam.getReviewerPdfPageForAdmin(EDITOR, SAMPLE_PUBLISHED, 1)).toBeNull();
      expect(await seam.getReviewerPdfPageForAdmin(EDITOR, "page-1", 1)).toBeNull();
    });
  });
});
