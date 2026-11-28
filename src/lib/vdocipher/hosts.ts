// VdoCipher's hosts the browser meets (Phase 5, ticket 02; ADR 0013), shared
// by the security headers (src/lib/csp.ts), the real client's check of the
// upload link it hands the browser, and the embedded player. Nothing secret:
// safe in the browser.
//
// VdoCipher docs (read 2026-11-28):
// - https://www.vdocipher.com/docs/player/v2/ (the iframe on player.vdocipher.com/v2/)
// - https://www.vdocipher.com/docs/server/upload/credentials and
//   https://www.vdocipher.com/docs/server/upload/browser (the upload link is
//   an "https://{s3-bucket-url}.amazonaws.com" storage host)

/** Where VdoCipher's embedded player is served from: the only frame-src the site adds. */
export const VDOCIPHER_PLAYER_ORIGIN = "https://player.vdocipher.com";

/**
 * Where the browser sends a Lesson's file: VdoCipher's upload link, on an
 * Amazon S3 host (which bucket varies by region), as a CSP source.
 */
export const VDOCIPHER_UPLOAD_SOURCE = "https://*.amazonaws.com";

/** Pure: whether an upload link is on VdoCipher's storage host, over https. */
export function isVdoCipherUploadLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === "https:" && url.hostname.endsWith(".amazonaws.com");
  } catch {
    return false;
  }
}

/** Pure: the embedded player's address for one playback pass. */
export function vdoCipherPlayerUrl(pass: { otp: string; playbackInfo: string }): string {
  const query = new URLSearchParams({ otp: pass.otp, playbackInfo: pass.playbackInfo });
  return `${VDOCIPHER_PLAYER_ORIGIN}/v2/?${query.toString()}`;
}
