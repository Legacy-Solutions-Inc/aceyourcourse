import { describe, expect, it } from "vitest";

import type { ReviewerPdfStatus } from "@/services/content.types";

import {
  CHOOSE_A_TOPIC,
  changeRefusal,
  hasEveryPage,
  NO_PAGES,
  NOT_PUBLISHED,
  reviewerPdfState,
  SPLIT_FAILED,
  statusAfterChange,
  STILL_SPLITTING,
  UNPUBLISH_TO_MOVE,
} from "./status";

// A Reviewer PDF's status rules (Phase 3, ticket 13; story 116; spec, Phase 3
// → Content model), pure: Processing → Draft → Published ⇄ Unpublished, or
// Processing → Failed. Placing needs a job that succeeded, and a Published
// one unpublished first; publishing needs a Topic and every page; only a
// Published one can be unpublished. The status it has already is no change.

const placedDraft = { status: "draft", hasTopic: true, hasPages: true } as const;

describe("publishing", () => {
  it("is allowed for a placed Draft, or a placed Unpublished one, whose job split every page", () => {
    expect(changeRefusal(placedDraft, "publish")).toBeNull();
    expect(changeRefusal({ ...placedDraft, status: "unpublished" }, "publish")).toBeNull();
  });

  it("is refused without a Topic, saying to choose one", () => {
    expect(changeRefusal({ ...placedDraft, hasTopic: false }, "publish")).toBe(CHOOSE_A_TOPIC);
    expect(CHOOSE_A_TOPIC).toBe("CHOOSE A TOPIC BEFORE PUBLISHING");
    expect(
      changeRefusal({ status: "unpublished", hasTopic: false, hasPages: true }, "publish"),
    ).toBe(CHOOSE_A_TOPIC);
  });

  it("is refused while it's still being split into pages, Topic or not", () => {
    for (const hasTopic of [true, false]) {
      expect(changeRefusal({ status: "processing", hasTopic, hasPages: false }, "publish")).toBe(
        STILL_SPLITTING,
      );
    }
  });

  it("is refused once its job failed, saying to upload the PDF again", () => {
    for (const hasTopic of [true, false]) {
      expect(changeRefusal({ status: "failed", hasTopic, hasPages: false }, "publish")).toBe(
        SPLIT_FAILED,
      );
    }
  });

  it("is refused for one with no pages, as the sample data's are, from before uploads", () => {
    expect(changeRefusal({ ...placedDraft, hasPages: false }, "publish")).toBe(NO_PAGES);
  });

  it("is no change for one that's Published already, and so never refused", () => {
    expect(changeRefusal({ ...placedDraft, status: "published" }, "publish")).toBeNull();
  });
});

describe("unpublishing", () => {
  it("is allowed for a Published one, and no change for an Unpublished one", () => {
    expect(changeRefusal({ ...placedDraft, status: "published" }, "unpublish")).toBeNull();
    // The sample data's Published ones have no pages, and can still be taken down.
    expect(
      changeRefusal({ status: "published", hasTopic: true, hasPages: false }, "unpublish"),
    ).toBeNull();
    expect(changeRefusal({ ...placedDraft, status: "unpublished" }, "unpublish")).toBeNull();
  });

  it("is refused for one that was never Published", () => {
    const others: ReviewerPdfStatus[] = ["processing", "draft", "failed"];
    for (const status of others) {
      expect(changeRefusal({ ...placedDraft, status }, "unpublish")).toBe(NOT_PUBLISHED);
    }
  });
});

describe("placing under a Topic", () => {
  it("is allowed for a Draft or an Unpublished one, placed already or not", () => {
    for (const status of ["draft", "unpublished"] as const) {
      for (const hasTopic of [true, false]) {
        expect(changeRefusal({ status, hasTopic, hasPages: true }, "place")).toBeNull();
      }
    }
    // The sample data's, with no pages, can be placed too: only publishing needs pages.
    expect(changeRefusal({ status: "draft", hasTopic: true, hasPages: false }, "place")).toBeNull();
  });

  it("waits until it's split, so a job that then fails never holds a Topic", () => {
    expect(changeRefusal({ status: "processing", hasTopic: false, hasPages: false }, "place")).toBe(
      STILL_SPLITTING,
    );
  });

  it("is refused once its job failed, so it never holds the Topic its new upload needs", () => {
    expect(changeRefusal({ status: "failed", hasTopic: false, hasPages: false }, "place")).toBe(
      SPLIT_FAILED,
    );
  });

  it("is refused for a Published one until it's unpublished, so live content never moves unseen", () => {
    expect(changeRefusal({ ...placedDraft, status: "published" }, "place")).toBe(UNPUBLISH_TO_MOVE);
  });
});

describe("reviewerPdfState", () => {
  it("reads its status, whether it has a Topic, and whether its job split every page", () => {
    const upload = {
      fileName: "a.pdf",
      fileSize: 10,
      uploadedAt: "2026-11-18T08:00:00.000Z",
      pageCount: 2,
      pagesDone: 2,
      heartbeatAt: null,
      restarts: 0,
      failure: null,
    };
    expect(reviewerPdfState({ status: "draft", topicId: "t1" }, upload)).toEqual({
      status: "draft",
      hasTopic: true,
      hasPages: true,
    });
    expect(reviewerPdfState({ status: "draft", topicId: null }, null)).toEqual({
      status: "draft",
      hasTopic: false,
      hasPages: false,
    });
  });
});

describe("statusAfterChange", () => {
  it("publishes to Published, and unpublishes to Unpublished, never back to Draft", () => {
    expect(statusAfterChange("publish")).toBe("published");
    expect(statusAfterChange("unpublish")).toBe("unpublished");
  });
});

describe("hasEveryPage", () => {
  const upload = {
    fileName: "MSTC Reviewer.pdf",
    fileSize: 1200,
    uploadedAt: "2026-11-18T08:00:00.000Z",
    pageCount: 3,
    pagesDone: 3,
    heartbeatAt: "2026-11-18T08:00:03.000Z",
    restarts: 0,
    failure: null,
  };

  it("holds once the job has split every page of the PDF", () => {
    expect(hasEveryPage(upload)).toBe(true);
  });

  it("doesn't hold partway, before the page count is read, or with no upload at all", () => {
    expect(hasEveryPage({ ...upload, pagesDone: 2 })).toBe(false);
    expect(hasEveryPage({ ...upload, pageCount: null, pagesDone: 0 })).toBe(false);
    expect(hasEveryPage(null)).toBe(false);
  });
});
