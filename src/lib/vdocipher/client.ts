import "server-only";

import { z } from "zod";

import { isVdoCipherUploadLink } from "@/lib/vdocipher/hosts";
import type {
  PlaybackPass,
  UploadPermission,
  VideoService,
  VideoStatus,
} from "@/services/video.types";

// ─────────────────────────────────────────────────────────────────────────────
// The real video service (Phase 5, ticket 02; spec, Phase 5 planning
// decisions → The video service interface; ADR 0013), over VdoCipher's server
// API with fetch (no SDK):
// - uploadPermission: PUT /videos?title=… gives the new video's id and the
//   form fields the browser posts, with the file last, straight to the upload
//   link. Only an https link on VdoCipher's storage host is handed on.
// - videoStatus: GET /videos/{id}. "Pre-Upload" is the file not there yet,
//   "ready" (with a length) is ready, a status naming an error is failed, and
//   anything else ("Queued" and the like) is processing.
// - deleteVideo: DELETE /videos?videos={id} (VdoCipher keeps it in its trash
//   for 7 days).
// - playbackPass: POST /videos/{id}/otp with a 5-minute OTP whose annotate
//   draws the watermark text drifting across the video.
// The API secret is sent only as the Authorization header ("Apisecret …"). It
// stays on the server: this module is server-only, and nothing it logs or
// answers carries the secret or VdoCipher's raw response.
//
// VdoCipher docs (read 2026-11-28):
// - https://www.vdocipher.com/docs/server/upload/credentials
// - https://www.vdocipher.com/docs/server/upload/browser
// - https://www.vdocipher.com/docs/server/upload/status
// - https://www.vdocipher.com/docs/server/videomanagement/deleting
// - https://www.vdocipher.com/docs/server/playbackauth/otp
// - https://www.vdocipher.com/docs/server/playbackauth/anno
// ─────────────────────────────────────────────────────────────────────────────

const VDOCIPHER_API = "https://dev.vdocipher.com/api";

/** How long a call to VdoCipher may take before it counts as unreachable. */
const TIMEOUT_MS = 15_000;

/** How long a playback pass lasts before the player must have started. */
const OTP_TTL_SECONDS = 300;

/** A VdoCipher video id, before it goes in a URL: letters and digits (32 hex in practice). */
const VIDEO_ID = /^[A-Za-z0-9]{1,64}$/;

export interface VdoCipherClientOptions {
  /** VDOCIPHER_API_SECRET. */
  apiSecret: string;
  fetch?: typeof globalThis.fetch;
  /** Where problems are logged (never with the secret). */
  log?: (message: string) => void;
}

const credentialsSchema = z.object({
  videoId: z.string().regex(VIDEO_ID),
  clientPayload: z.object({
    policy: z.string(),
    key: z.string(),
    "x-amz-signature": z.string(),
    "x-amz-algorithm": z.string(),
    "x-amz-date": z.string(),
    "x-amz-credential": z.string(),
    uploadLink: z.string(),
  }),
});

const videoSchema = z.object({
  id: z.string(),
  status: z.string(),
  length: z.number().nullish(),
});

const otpSchema = z.object({ otp: z.string().min(1), playbackInfo: z.string().min(1) });

type Answer = { ok: true; body: unknown } | { ok: false; why: string };

export function createVdoCipherClient({
  apiSecret,
  fetch = globalThis.fetch,
  log = console.warn,
}: VdoCipherClientOptions): VideoService {
  async function call(path: string, init: RequestInit = {}): Promise<Answer> {
    let response: Response;
    try {
      response = await fetch(`${VDOCIPHER_API}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Apisecret ${apiSecret}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { ok: false, why: "no answer" };
    }
    const body: unknown = await response.json().catch(() => null);
    return response.ok ? { ok: true, body } : { ok: false, why: `HTTP ${response.status}` };
  }

  async function uploadPermission(title: string): Promise<UploadPermission | null> {
    const query = new URLSearchParams({ title });
    const answer = await call(`/videos?${query.toString()}`, { method: "PUT" });
    if (!answer.ok) {
      log(`VdoCipher didn't give upload permission (${answer.why}).`);
      return null;
    }
    const parsed = credentialsSchema.safeParse(answer.body);
    if (!parsed.success) {
      log("VdoCipher's upload permission wasn't in the shape expected.");
      return null;
    }
    const { videoId, clientPayload: payload } = parsed.data;
    if (!isVdoCipherUploadLink(payload.uploadLink)) {
      log("VdoCipher's upload link wasn't an https link on its storage host.");
      return null;
    }
    return {
      videoId,
      target: {
        kind: "vdocipher",
        url: payload.uploadLink,
        fields: [
          ["policy", payload.policy],
          ["key", payload.key],
          ["x-amz-signature", payload["x-amz-signature"]],
          ["x-amz-algorithm", payload["x-amz-algorithm"]],
          ["x-amz-date", payload["x-amz-date"]],
          ["x-amz-credential", payload["x-amz-credential"]],
          ["success_action_status", "201"],
          ["success_action_redirect", ""],
        ],
      },
    };
  }

  async function videoStatus(videoId: string): Promise<VideoStatus> {
    if (!VIDEO_ID.test(videoId)) return { status: "unknown" };
    const answer = await call(`/videos/${videoId}`);
    if (!answer.ok) {
      log(`VdoCipher didn't give video ${videoId}'s status (${answer.why}).`);
      return { status: "unknown" };
    }
    const parsed = videoSchema.safeParse(answer.body);
    if (!parsed.success || parsed.data.id !== videoId) return { status: "unknown" };
    const status = parsed.data.status.toLowerCase();
    const seconds = Math.round(parsed.data.length ?? 0);
    if (status === "pre-upload") return { status: "uploading" };
    if (status === "ready")
      return seconds > 0 ? { status: "ready", seconds } : { status: "processing" };
    if (/error|fail/.test(status)) return { status: "failed" };
    return { status: "processing" };
  }

  async function deleteVideo(videoId: string): Promise<boolean> {
    if (!VIDEO_ID.test(videoId)) return false;
    const answer = await call(`/videos?videos=${videoId}`, { method: "DELETE" });
    if (!answer.ok) log(`VdoCipher didn't delete video ${videoId} (${answer.why}).`);
    return answer.ok;
  }

  async function playbackPass(videoId: string, watermark: string): Promise<PlaybackPass | null> {
    if (!VIDEO_ID.test(videoId)) return null;
    const annotate = JSON.stringify([
      {
        type: "rtext",
        text: watermark,
        alpha: "0.60",
        color: "0xFFFFFF",
        size: "15",
        interval: "5000",
      },
    ]);
    const answer = await call(`/videos/${videoId}/otp`, {
      method: "POST",
      body: JSON.stringify({ ttl: OTP_TTL_SECONDS, annotate }),
    });
    if (!answer.ok) {
      log(`VdoCipher didn't give a playback pass for video ${videoId} (${answer.why}).`);
      return null;
    }
    const parsed = otpSchema.safeParse(answer.body);
    if (!parsed.success) {
      log("VdoCipher's playback pass wasn't in the shape expected.");
      return null;
    }
    return { kind: "vdocipher", ...parsed.data };
  }

  return { kind: "vdocipher", uploadPermission, videoStatus, deleteVideo, playbackPass };
}
