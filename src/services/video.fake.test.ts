import { describe, expect, it } from "vitest";

import { createFakeVideoService, sampleVideoToken } from "./video.fake";

// The video fake (Phase 5, ticket 02): sample mode's and the tests' video
// service. Permission always succeeds with a local target, a video reads
// "processing" for a few seconds and then ready with a made-up length,
// deletes are recorded, and a playback pass is a sample player's token.

describe("the video fake", () => {
  it("gives upload permission with a new video id and no upload host", async () => {
    const fake = createFakeVideoService();
    const first = await fake.uploadPermission("Beams in flexure");
    const second = await fake.uploadPermission("Beams in flexure");
    expect(first).toMatchObject({ target: { kind: "fake" } });
    expect(first?.videoId).toMatch(/^fake-video-/);
    expect(second?.videoId).not.toBe(first?.videoId);
    expect(fake.permissions).toEqual(["Beams in flexure", "Beams in flexure"]);
  });

  it("reads processing for a few seconds, then ready with a made-up length", async () => {
    let now = 1_000_000;
    const fake = createFakeVideoService({ processingMs: 4000, now: () => now });
    const permission = await fake.uploadPermission("Shear");
    const id = permission?.videoId ?? "";
    expect(await fake.videoStatus(id)).toEqual({ status: "processing" });
    now += 3999;
    expect(await fake.videoStatus(id)).toEqual({ status: "processing" });
    now += 1;
    const ready = await fake.videoStatus(id);
    expect(ready.status).toBe("ready");
    const seconds = ready.status === "ready" ? ready.seconds : 0;
    expect(seconds).toBeGreaterThanOrEqual(240);
    expect(seconds).toBeLessThan(1500);
    // The same video always has the same length.
    expect(await fake.videoStatus(id)).toEqual(ready);
  });

  it("finishes or fails a video when told, and doesn't know a video it never made", async () => {
    const fake = createFakeVideoService({ processingMs: Number.POSITIVE_INFINITY });
    const a = (await fake.uploadPermission("A"))?.videoId ?? "";
    const b = (await fake.uploadPermission("B"))?.videoId ?? "";
    fake.finish(a, 754);
    fake.fail(b);
    expect(await fake.videoStatus(a)).toEqual({ status: "ready", seconds: 754 });
    expect(await fake.videoStatus(b)).toEqual({ status: "failed" });
    expect(await fake.videoStatus("not-one-of-its")).toEqual({ status: "unknown" });
  });

  it("records each delete, and fails them when told", async () => {
    const fake = createFakeVideoService();
    expect(await fake.deleteVideo("fake-video-1")).toBe(true);
    fake.failDeletes();
    expect(await fake.deleteVideo("fake-video-2")).toBe(false);
    expect(fake.deleted).toEqual(["fake-video-1"]);
    expect(fake.deleteAttempts).toEqual(["fake-video-1", "fake-video-2"]);
  });

  it("refuses permission when told, as VdoCipher answering an error would", async () => {
    const fake = createFakeVideoService();
    fake.refusePermissions();
    expect(await fake.uploadPermission("A")).toBeNull();
  });

  it("gives a sample player's token as the playback pass, keeping the watermark asked for", async () => {
    const fake = createFakeVideoService();
    expect(await fake.playbackPass("fake-video-1", "editor@example.com")).toEqual({
      kind: "sample",
      token: sampleVideoToken("fake-video-1"),
    });
    expect(fake.passes).toEqual([{ videoId: "fake-video-1", watermark: "editor@example.com" }]);
  });
});
