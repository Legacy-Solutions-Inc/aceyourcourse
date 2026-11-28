// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import refused from "../../../test/fixtures/vdocipher/error.json";
import otp from "../../../test/fixtures/vdocipher/otp.json";
import credentials from "../../../test/fixtures/vdocipher/upload-credentials.json";
import preUpload from "../../../test/fixtures/vdocipher/video-pre-upload.json";
import queued from "../../../test/fixtures/vdocipher/video-queued.json";
import ready from "../../../test/fixtures/vdocipher/video-ready.json";

import { createVdoCipherClient } from "./client";
import { VDOCIPHER_PLAYER_ORIGIN, vdoCipherPlayerUrl } from "./hosts";

// The real video service (Phase 5, ticket 02; ADR 0013), over VdoCipher's
// server API. Every test answers from a fixture through an injected fetch: no
// test ever calls VdoCipher. The fixtures follow VdoCipher's documented
// examples, with fake ids and values.

const SECRET = "fake-vdocipher-secret-test-only";
const VIDEO = "1234567890abcdef1234567890abcdef";

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A client whose fetch answers `response` (or throws it), keeping each request. */
function clientAnswering(response: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const log = vi.fn<(message: string) => void>();
  const client = createVdoCipherClient({ apiSecret: SECRET, fetch, log });
  const request = () => {
    const [url, init] = fetch.mock.calls[0] ?? [];
    return {
      url: String(url),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body,
    };
  };
  return { client, fetch, log, request };
}

/** Pure: everything a test's client sent and logged, for checking the secret never leaks. */
const everythingBut = (headers: Headers, rest: unknown) =>
  JSON.stringify({ rest, headers: [...headers].filter(([name]) => name !== "authorization") });

describe("the VdoCipher client", () => {
  it("is the real video service", () => {
    expect(clientAnswering(answer(200, {})).client.kind).toBe("vdocipher");
  });

  describe("upload permission", () => {
    it("asks for credentials with the title, and gives the upload host's form fields and the video id", async () => {
      const { client, request } = clientAnswering(answer(200, credentials));
      const permission = await client.uploadPermission("Beams in flexure");
      const sent = request();
      expect(sent.method).toBe("PUT");
      expect(sent.url).toBe("https://dev.vdocipher.com/api/videos?title=Beams+in+flexure");
      expect(sent.headers.get("authorization")).toBe(`Apisecret ${SECRET}`);
      expect(permission).toEqual({
        videoId: VIDEO,
        target: {
          kind: "vdocipher",
          url: "https://vdo-ap-southeast.s3-accelerate.amazonaws.com",
          fields: [
            ["policy", credentials.clientPayload.policy],
            ["key", credentials.clientPayload.key],
            ["x-amz-signature", credentials.clientPayload["x-amz-signature"]],
            ["x-amz-algorithm", "AWS4-HMAC-SHA256"],
            ["x-amz-date", "20261128T000000Z"],
            ["x-amz-credential", credentials.clientPayload["x-amz-credential"]],
            ["success_action_status", "201"],
            ["success_action_redirect", ""],
          ],
        },
      });
    });

    it.each([
      ["an upload link off VdoCipher's storage host", "https://uploads.example.com"],
      ["a plain http upload link", "http://vdo-ap-southeast.s3-accelerate.amazonaws.com"],
      ["no upload link", ""],
    ])("refuses %s", async (_case, uploadLink) => {
      const { client, log } = clientAnswering(
        answer(200, {
          ...credentials,
          clientPayload: { ...credentials.clientPayload, uploadLink },
        }),
      );
      expect(await client.uploadPermission("A")).toBeNull();
      expect(log).toHaveBeenCalledOnce();
    });

    it("maps an error, a bad answer or no answer to no permission, logging why without the secret", async () => {
      for (const response of [
        answer(401, refused),
        answer(200, { videoId: VIDEO }),
        new TypeError("fetch failed"),
      ]) {
        const { client, log } = clientAnswering(response);
        expect(await client.uploadPermission("A")).toBeNull();
        expect(log).toHaveBeenCalledOnce();
        expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
      }
    });
  });

  describe("a video's status", () => {
    it("reads a ready video with its length in whole seconds", async () => {
      const { client, request } = clientAnswering(answer(200, ready));
      expect(await client.videoStatus(VIDEO)).toEqual({ status: "ready", seconds: 754 });
      expect(request().method).toBe("GET");
      expect(request().url).toBe(`https://dev.vdocipher.com/api/videos/${VIDEO}`);
      expect(request().headers.get("authorization")).toBe(`Apisecret ${SECRET}`);
    });

    it("reads Pre-Upload as still uploading, and Queued as processing", async () => {
      expect(await clientAnswering(answer(200, preUpload)).client.videoStatus(VIDEO)).toEqual({
        status: "uploading",
      });
      expect(await clientAnswering(answer(200, queued)).client.videoStatus(VIDEO)).toEqual({
        status: "processing",
      });
    });

    it("reads an error status as failed, and ready with no length as still processing", async () => {
      expect(
        await clientAnswering(answer(200, { ...ready, status: "Error" })).client.videoStatus(VIDEO),
      ).toEqual({ status: "failed" });
      expect(
        await clientAnswering(answer(200, { ...ready, length: 0 })).client.videoStatus(VIDEO),
      ).toEqual({ status: "processing" });
    });

    it("says unknown for an error, no answer, an answer about another video, or a malformed id", async () => {
      for (const response of [
        answer(404, refused),
        new TypeError("fetch failed"),
        answer(200, { ...ready, id: "another" }),
      ]) {
        expect(await clientAnswering(response).client.videoStatus(VIDEO)).toEqual({
          status: "unknown",
        });
      }
      const { client, fetch } = clientAnswering(answer(200, ready));
      expect(await client.videoStatus("../account")).toEqual({ status: "unknown" });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("deleting a video", () => {
    it("deletes it by id", async () => {
      const { client, request } = clientAnswering(answer(200, { message: "Deleted" }));
      expect(await client.deleteVideo(VIDEO)).toBe(true);
      expect(request().method).toBe("DELETE");
      expect(request().url).toBe(`https://dev.vdocipher.com/api/videos?videos=${VIDEO}`);
      expect(request().headers.get("authorization")).toBe(`Apisecret ${SECRET}`);
    });

    it("says false when VdoCipher refuses or can't be reached, logging it", async () => {
      for (const response of [answer(400, refused), new TypeError("fetch failed")]) {
        const { client, log } = clientAnswering(response);
        expect(await client.deleteVideo(VIDEO)).toBe(false);
        expect(log).toHaveBeenCalledOnce();
      }
    });
  });

  describe("a playback pass", () => {
    it("asks for an OTP carrying the watermark as moving text, and gives the OTP and playback info", async () => {
      const { client, request } = clientAnswering(answer(200, otp));
      const pass = await client.playbackPass(VIDEO, "editor@example.com");
      expect(pass).toEqual({ kind: "vdocipher", otp: otp.otp, playbackInfo: otp.playbackInfo });
      const sent = request();
      expect(sent.method).toBe("POST");
      expect(sent.url).toBe(`https://dev.vdocipher.com/api/videos/${VIDEO}/otp`);
      expect(sent.headers.get("authorization")).toBe(`Apisecret ${SECRET}`);
      expect(sent.headers.get("content-type")).toBe("application/json");
      const body = sent.body as { ttl: number; annotate: string };
      expect(body.ttl).toBe(300);
      // annotate is itself JSON, serialised again (VdoCipher, Watermark).
      expect(JSON.parse(body.annotate)).toEqual([
        {
          type: "rtext",
          text: "editor@example.com",
          alpha: "0.60",
          color: "0xFFFFFF",
          size: "15",
          interval: "5000",
        },
      ]);
    });

    it("gives no pass when VdoCipher refuses, and never puts the secret anywhere but the header", async () => {
      const { client, fetch, log, request } = clientAnswering(answer(403, refused));
      expect(await client.playbackPass(VIDEO, "editor@example.com")).toBeNull();
      const sent = request();
      expect(everythingBut(sent.headers, { url: sent.url, body: sent.body })).not.toContain(SECRET);
      expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  it("builds the embedded player's address on VdoCipher's player host", () => {
    expect(vdoCipherPlayerUrl({ otp: "a b", playbackInfo: "c+d" })).toBe(
      `${VDOCIPHER_PLAYER_ORIGIN}/v2/?otp=a+b&playbackInfo=c%2Bd`,
    );
  });
});
