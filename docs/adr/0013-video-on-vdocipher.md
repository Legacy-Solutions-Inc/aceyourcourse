# 13. Video Courses stream from VdoCipher

Date: 2026-11-26

## Status

Accepted

## Decision

Lesson videos are hosted and streamed by **VdoCipher**, on an account the
client owns and pays for (Starter, USD 149 a year, after the 30-day free
trial). The contract requires Widevine and FairPlay DRM "(for example,
VdoCipher)", the signed-in user's email as a visible watermark on videos, and
blocked screen recording where the device supports hardware DRM (section 3.4).

Our server authorises every playback. It runs the access decision (ADR 0010,
ADR 0011) first, and only then asks VdoCipher for a one-time playback pass
that carries the Member's watermark. Lesson videos are never served from our
own storage.

## Considered options

- **Mux.** DRM is an add-on at USD 100 a month plus a fee per view, still in
  beta, and FairPlay needs a separate application to Apple. No per-viewer
  watermark was found.
- **Bunny Stream.** Enterprise DRM (Widevine and FairPlay) is USD 99 a month
  plus a fee per view. No per-viewer watermark was found.
- **Our own storage (Supabase), or unlisted YouTube.** Free or cheap, but with
  no DRM: the file or its link shows in the browser's developer tools and can
  be downloaded, which breaks the contract's video DRM clause. Self-hosting
  would also need a video conversion pipeline we'd build and run ourselves.

## Consequences

- The VdoCipher API secret is server-only and never `NEXT_PUBLIC_`. The user
  sets it; executers never use the VdoCipher dashboard or API.
- Tests, e2e and sample mode use a fake video service, as payments use a fake
  PayMongo client.
- Playback runs in VdoCipher's player. Resume and progress come from that
  player's JavaScript API, not from a player we build.
- If heavy watching uses up the yearly streaming allowance, the client moves
  up a plan. Nothing in the code changes.
