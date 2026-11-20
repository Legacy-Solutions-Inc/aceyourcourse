import { describe, expect, it } from "vitest";

import {
  failureMessage,
  isStale,
  MAX_RESTARTS,
  nextBatch,
  PAGES_PER_RUN,
  percentDone,
  progressLabel,
  restartOrFail,
  STALE_AFTER_MS,
  statusAfter,
} from "./job";

// The Reviewer PDF job's rules (ticket 12; spec, Phase 3 planning decisions →
// The Reviewer PDF job), pure: which pages a run renders, when it's done,
// when its heartbeat has gone stale, and when the cron gives up on it.

const NOW = new Date("2026-11-18T08:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("nextBatch", () => {
  it("starts at page 1, about 25 pages a run", () => {
    expect(PAGES_PER_RUN).toBe(25);
    expect(nextBatch({ pageCount: 312, pagesDone: 0 })).toEqual({ from: 1, to: 25 });
  });

  it("carries on from the page after the last one done, never repeating or skipping one", () => {
    expect(nextBatch({ pageCount: 312, pagesDone: 25 })).toEqual({ from: 26, to: 50 });
    expect(nextBatch({ pageCount: 312, pagesDone: 37 })).toEqual({ from: 38, to: 62 });
  });

  it("stops at the last page", () => {
    expect(nextBatch({ pageCount: 312, pagesDone: 300 })).toEqual({ from: 301, to: 312 });
    expect(nextBatch({ pageCount: 3, pagesDone: 0 })).toEqual({ from: 1, to: 3 });
  });

  it("has nothing left once every page is done", () => {
    expect(nextBatch({ pageCount: 312, pagesDone: 312 })).toBeNull();
  });

  it("has nothing to give before the PDF has been read", () => {
    expect(nextBatch({ pageCount: null, pagesDone: 0 })).toBeNull();
  });
});

describe("statusAfter", () => {
  it("stays Processing while pages are left, and is a Draft once the last is done", () => {
    expect(statusAfter({ pageCount: 312, pagesDone: 75 })).toBe("processing");
    expect(statusAfter({ pageCount: 312, pagesDone: 312 })).toBe("draft");
  });
});

describe("isStale", () => {
  const processing = { status: "processing" as const, heartbeatAt: ago(0) };

  it("is fresh while the last heartbeat is recent", () => {
    expect(isStale({ ...processing, heartbeatAt: ago(STALE_AFTER_MS - 1) }, NOW)).toBe(false);
  });

  it("is stale once no heartbeat has come for the stale time", () => {
    expect(isStale({ ...processing, heartbeatAt: ago(STALE_AFTER_MS) }, NOW)).toBe(true);
    expect(isStale({ ...processing, heartbeatAt: null }, NOW)).toBe(true);
  });

  it("is never stale once it's a Draft or Failed", () => {
    expect(isStale({ status: "draft", heartbeatAt: ago(STALE_AFTER_MS * 10) }, NOW)).toBe(false);
    expect(isStale({ status: "failed", heartbeatAt: null }, NOW)).toBe(false);
  });
});

describe("restartOrFail", () => {
  it("restarts a stale job while it has restarts left", () => {
    expect(MAX_RESTARTS).toBe(3);
    expect(restartOrFail({ restarts: 0 })).toBe("restart");
    expect(restartOrFail({ restarts: MAX_RESTARTS - 1 })).toBe("restart");
  });

  it("fails it once it has been restarted the most times allowed", () => {
    expect(restartOrFail({ restarts: MAX_RESTARTS })).toBe("fail");
  });
});

describe("failureMessage", () => {
  it("gives each reason with the fix to try", () => {
    expect(failureMessage("password")).toEqual({
      reason: "The PDF is password-protected.",
      fix: "Remove the password and upload again.",
    });
    expect(failureMessage("corrupt")).toEqual({
      reason: "The PDF is damaged or can’t be read.",
      fix: "Re-export the PDF and upload again.",
    });
    expect(failureMessage("too-big")).toEqual({
      reason: "The PDF is over 200 MB.",
      fix: "Save a smaller copy, 200 MB or less, and upload again.",
    });
    expect(failureMessage("too-many-restarts")).toEqual({
      reason: "Splitting it into pages stopped 3 times in a row.",
      fix: "Try again, or contact the developer.",
    });
  });
});

describe("progressLabel", () => {
  const job = { status: "processing" as const, pageCount: 312, pagesDone: 75 };

  it("counts the pages done while processing", () => {
    expect(progressLabel(job)).toBe("Processing · 75 of 312 pages");
  });

  it("says it's reading the PDF before it knows how many pages it has", () => {
    expect(progressLabel({ ...job, pageCount: null, pagesDone: 0 })).toBe(
      "Processing · reading the PDF",
    );
  });

  it("gives a Draft's or a Published one's page count", () => {
    expect(progressLabel({ ...job, status: "draft", pagesDone: 312 })).toBe("Draft · 312 pages");
    expect(progressLabel({ status: "published", pageCount: 1, pagesDone: 1 })).toBe(
      "Published · 1 page",
    );
    expect(progressLabel({ status: "unpublished", pageCount: null, pagesDone: 0 })).toBe(
      "Unpublished",
    );
  });

  it("says when it failed", () => {
    expect(progressLabel({ ...job, status: "failed" })).toBe("Failed");
  });
});

describe("percentDone", () => {
  it("gives the share of pages done, rounded, once the PDF has been read", () => {
    expect(percentDone({ pageCount: 312, pagesDone: 75 })).toBe(24);
    expect(percentDone({ pageCount: 3, pagesDone: 3 })).toBe(100);
    expect(percentDone({ pageCount: null, pagesDone: 0 })).toBeNull();
  });
});
