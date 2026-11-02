import { afterEach, describe, expect, it, vi } from "vitest";

import { measureImage, putFile } from "./put-file";

// The browser's half of the upload seam: the PUT to the one-time upload URL,
// with progress, and the photo's size read before upload. XMLHttpRequest and
// createImageBitmap are the browser's, so they're replaced.

/** A stand-in XMLHttpRequest the test answers by hand. */
class FakeRequest {
  static last: FakeRequest | null = null;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
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
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  answer(status: number) {
    this.status = status;
    this.onload?.();
  }
}

function sending() {
  vi.stubGlobal("XMLHttpRequest", FakeRequest);
  const file = new File(["png"], "front.png", { type: "image/png" });
  const progress: number[] = [];
  const done = putFile("/api/dev/uploads/1?token=t", file, (sent) => progress.push(sent));
  const request = FakeRequest.last;
  if (!request) throw new Error("No request was made");
  return { file, progress, done, request };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("putFile", () => {
  it("PUTs the file with its type to the upload URL, reporting progress, and resolves once stored", async () => {
    const { file, progress, done, request } = sending();

    request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    request.upload.onprogress?.({ lengthComputable: false, loaded: 2, total: 0 });
    request.answer(201);

    await expect(done).resolves.toBeUndefined();
    expect(request).toMatchObject({
      method: "PUT",
      url: "/api/dev/uploads/1?token=t",
      headers: { "content-type": "image/png" },
      body: file,
    });
    expect(progress).toEqual([0.25]);
  });

  it("rejects when the upload URL refuses the file", async () => {
    const { done, request } = sending();
    request.answer(409);
    await expect(done).rejects.toThrow("The upload URL answered 409");
  });

  it("rejects when the network fails or the upload is stopped", async () => {
    const failed = sending();
    failed.request.onerror?.();
    await expect(failed.done).rejects.toThrow("The upload didn't reach the server");

    const stopped = sending();
    stopped.request.onabort?.();
    await expect(stopped.done).rejects.toThrow("The upload was stopped");
  });
});

describe("measureImage", () => {
  const file = new File(["png"], "front.png", { type: "image/png" });

  it("reads the photo's width and height", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({ width: 900, height: 600, close }));

    expect(await measureImage(file)).toEqual({ width: 900, height: 600 });
    expect(close).toHaveBeenCalled();
  });

  it("is null when the browser can't read it, or can't read images at all", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("not an image");
    });
    expect(await measureImage(file)).toBeNull();

    vi.stubGlobal("createImageBitmap", undefined);
    expect(await measureImage(file)).toBeNull();
  });
});
