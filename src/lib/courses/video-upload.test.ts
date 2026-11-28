import { afterEach, describe, expect, it, vi } from "vitest";

import { FAKE_UPLOAD_MS, secondsLeftOf, sendVideo, type UploadProgress } from "./video-upload";

// The browser's half of a Lesson video upload (Phase 5, ticket 02): one
// multipart POST straight to VdoCipher's upload host, with progress, or the
// fake's quick progress bar. XMLHttpRequest is the browser's, so it's replaced.

/** A stand-in XMLHttpRequest the test answers by hand. */
class FakeRequest {
  static last: FakeRequest | null = null;
  method = "";
  url = "";
  body: FormData | null = null;
  status = 0;
  upload: { onprogress: ((event: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeRequest.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  answer(status: number) {
    this.status = status;
    this.onload?.();
  }
}

const TARGET = {
  kind: "vdocipher" as const,
  url: "https://vdo-ap-southeast.s3-accelerate.amazonaws.com",
  fields: [
    ["policy", "p"],
    ["key", "k"],
    ["success_action_status", "201"],
  ] as [string, string][],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sending to VdoCipher", () => {
  function sending() {
    vi.stubGlobal("XMLHttpRequest", FakeRequest);
    let time = 0;
    const file = new File(["mp4"], "beams.mp4", { type: "video/mp4" });
    const progress: UploadProgress[] = [];
    const send = sendVideo(
      TARGET,
      file,
      (p) => progress.push(p),
      () => time,
    );
    const request = FakeRequest.last;
    if (!request) throw new Error("No request was made");
    return { file, progress, send, request, tick: (ms: number) => (time += ms) };
  }

  it("POSTs the permission's fields, then the file last, straight to the upload host", async () => {
    const { file, send, request } = sending();
    expect(request.method).toBe("POST");
    expect(request.url).toBe(TARGET.url);
    expect([...(request.body?.keys() ?? [])]).toEqual([
      "policy",
      "key",
      "success_action_status",
      "file",
    ]);
    expect(request.body?.get("file")).toBe(file);
    request.answer(201);
    await expect(send.done).resolves.toBe("sent");
  });

  it("reports progress with the time left", () => {
    const { progress, request, tick } = sending();
    tick(60_000);
    request.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    expect(progress).toEqual([{ sent: 0.25, secondsLeft: 180 }]);
  });

  it("fails on a refusal, a network error, or a stop", async () => {
    const refused = sending();
    refused.request.answer(403);
    await expect(refused.send.done).resolves.toBe("failed");
    const broken = sending();
    broken.request.onerror?.();
    await expect(broken.send.done).resolves.toBe("failed");
    const stopped = sending();
    stopped.send.abort();
    await expect(stopped.send.done).resolves.toBe("failed");
  });
});

describe("the fake's upload", () => {
  it("plays a quick progress bar to 100%, sending nothing anywhere", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("XMLHttpRequest", FakeRequest);
    FakeRequest.last = null;
    const progress: number[] = [];
    const send = sendVideo({ kind: "fake" }, new File(["x"], "a.mp4"), (p) =>
      progress.push(p.sent),
    );
    await vi.advanceTimersByTimeAsync(FAKE_UPLOAD_MS);
    await expect(send.done).resolves.toBe("sent");
    expect(progress.at(-1)).toBe(1);
    expect(progress).toHaveLength(10);
    expect(FakeRequest.last).toBeNull();
  });
});

describe("secondsLeftOf", () => {
  it("says nothing until a second in and 1% sent, then works from the rate", () => {
    expect(secondsLeftOf(0.5, 900)).toBeNull();
    expect(secondsLeftOf(0.005, 10_000)).toBeNull();
    expect(secondsLeftOf(0.41, 250_000)).toBeCloseTo(359.76, 1);
    expect(secondsLeftOf(1, 5000)).toBe(0);
  });
});
