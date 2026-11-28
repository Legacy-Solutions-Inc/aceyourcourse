// ─────────────────────────────────────────────────────────────────────────────
// The video service (Phase 5, ticket 02; spec, Phase 5 planning decisions →
// The video service interface; Testing Decisions → Phase 5 seams → Video
// service; ADR 0013): what Lessons ask of VdoCipher, behind one small
// interface, like the payments client (payments.types.ts). Four jobs: one-time
// upload permission for a new video, a video's status and length, deleting a
// video, and a playback pass carrying watermark text. The fake
// (video.fake.ts) stands in for it in tests and in sample mode, where it also
// drives the sample player and uploads; the real client
// (src/lib/vdocipher/client.ts) needs VDOCIPHER_API_SECRET. The selector
// (video.ts) says which, if any, this server has.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where the browser sends the file: VdoCipher's upload host, as a multipart
 * POST of these fields (in order) and then the file as `file`; or, with the
 * fake, nowhere (the browser plays a quick progress bar instead).
 */
export type UploadTarget =
  { kind: "vdocipher"; url: string; fields: [name: string, value: string][] } | { kind: "fake" };

/** One-time upload permission: the new video's id at the service, and where the file goes. */
export interface UploadPermission {
  videoId: string;
  target: UploadTarget;
}

/**
 * A video's status at the service: the file not there yet ("uploading"),
 * being prepared ("processing"), ready to play with its length in whole
 * seconds, or failed; "unknown" when the service couldn't say, which changes
 * nothing.
 */
export type VideoStatus =
  | { status: "uploading" }
  | { status: "processing" }
  | { status: "ready"; seconds: number }
  | { status: "failed" }
  | { status: "unknown" };

/**
 * What a player needs to play one video once: VdoCipher's OTP and playback
 * info, for its embedded player; or, with the fake, a token for the sample
 * player.
 */
export type PlaybackPass =
  { kind: "vdocipher"; otp: string; playbackInfo: string } | { kind: "sample"; token: string };

export interface VideoService {
  /** Which service this is: "fake" in tests and sample mode, "vdocipher" with the key. */
  readonly kind: "fake" | "vdocipher";
  /** Asks for one-time permission to upload a new video under this title. Never throws. */
  uploadPermission(title: string): Promise<UploadPermission | null>;
  /** Reads a video's status and length now. Never throws. */
  videoStatus(videoId: string): Promise<VideoStatus>;
  /** Deletes a video; false when the service refused or couldn't be reached. Never throws. */
  deleteVideo(videoId: string): Promise<boolean>;
  /** A playback pass for a video, drawing the watermark text across it; null when refused. Never throws. */
  playbackPass(videoId: string, watermark: string): Promise<PlaybackPass | null>;
}
