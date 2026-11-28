import type {
  PlaybackPass,
  UploadPermission,
  VideoService,
  VideoStatus,
} from "@/services/video.types";

// The video fake (Phase 5, ticket 02; spec, Phase 5 planning decisions → The
// VdoCipher key decides): stands in for VdoCipher in tests and in sample
// mode, so uploads and the player can be clicked through with no key and no
// network. Permission succeeds with no upload host (the browser plays a quick
// progress bar instead of sending the file), a new video reads "processing"
// for a few seconds and then ready with a made-up length, a delete is
// recorded, and a playback pass is a token for the sample player. Tests can
// finish or fail a video, refuse permission and fail deletes.

export interface FakeVideoService extends VideoService {
  /** The titles permission was given for, in order. */
  readonly permissions: readonly string[];
  /** The videos deleted, in order. */
  readonly deleted: readonly string[];
  /** Every delete asked for, failed ones too, in order. */
  readonly deleteAttempts: readonly string[];
  /** The playback passes given, in order. */
  readonly passes: readonly { videoId: string; watermark: string }[];
  /** Makes a video ready now, with this length. */
  finish(videoId: string, seconds?: number): void;
  /** Makes a video fail. */
  fail(videoId: string): void;
  /** Refuses every upload permission from now on. */
  refusePermissions(): void;
  /** Fails every delete from now on. */
  failDeletes(): void;
}

export interface FakeVideoOptions {
  /** How long a new video reads "processing": 4 seconds unless told. */
  processingMs?: number;
  now?: () => number;
}

/** Pure: the sample player's token for a video. */
export const sampleVideoToken = (videoId: string) => `sample:${videoId}`;

/** Pure: a made-up length between 4 and 25 minutes, the same for the same video. */
function madeUpSeconds(videoId: string): number {
  let hash = 0;
  for (const char of videoId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 240 + (hash % 1260);
}

export function createFakeVideoService({
  processingMs = 4000,
  now = Date.now,
}: FakeVideoOptions = {}): FakeVideoService {
  const permissions: string[] = [];
  const deleted: string[] = [];
  const deleteAttempts: string[] = [];
  const passes: { videoId: string; watermark: string }[] = [];
  const made = new Map<string, number>();
  const settled = new Map<string, VideoStatus>();
  let refusing = false;
  let failingDeletes = false;
  return {
    kind: "fake",
    permissions,
    deleted,
    deleteAttempts,
    passes,
    finish(videoId, seconds = madeUpSeconds(videoId)) {
      settled.set(videoId, { status: "ready", seconds });
    },
    fail(videoId) {
      settled.set(videoId, { status: "failed" });
    },
    refusePermissions() {
      refusing = true;
    },
    failDeletes() {
      failingDeletes = true;
    },
    async uploadPermission(title): Promise<UploadPermission | null> {
      if (refusing) return null;
      permissions.push(title);
      const videoId = `fake-video-${crypto.randomUUID()}`;
      made.set(videoId, now());
      return { videoId, target: { kind: "fake" } };
    },
    async videoStatus(videoId): Promise<VideoStatus> {
      const fixed = settled.get(videoId);
      if (fixed) return fixed;
      const madeAt = made.get(videoId);
      if (madeAt === undefined) return { status: "unknown" };
      return now() - madeAt >= processingMs
        ? { status: "ready", seconds: madeUpSeconds(videoId) }
        : { status: "processing" };
    },
    async deleteVideo(videoId) {
      deleteAttempts.push(videoId);
      if (failingDeletes) return false;
      deleted.push(videoId);
      return true;
    },
    async playbackPass(videoId, watermark): Promise<PlaybackPass | null> {
      passes.push({ videoId, watermark });
      return { kind: "sample", token: sampleVideoToken(videoId) };
    },
  };
}
