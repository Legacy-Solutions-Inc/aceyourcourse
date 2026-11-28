"use client";

import { useCallback, useEffect, useRef } from "react";

import type { PlayerEvent } from "@/lib/courses/lesson-saving";
import { VDOCIPHER_PLAYER_ORIGIN, vdoCipherPlayerUrl } from "@/lib/vdocipher/hosts";
import type { PlaybackPass } from "@/services/video.types";

import { SamplePlayer } from "./sample-player";

// ─────────────────────────────────────────────────────────────────────────────
// The Lesson player adapter (Phase 5, ticket 04; spec, Phase 5 planning
// decisions → Watching a Lesson): one player for a playback pass that starts
// at a position and reports the same events, whichever player plays it:
//   - "time" while it plays, "pause" when it stops short of the end, "end"
//     at the end, each with the position in seconds.
// For a real pass it's VdoCipher's embedded DRM player, driven through its
// player API (https://player.vdocipher.com/v2/api.js: VdoPlayer.getInstance,
// and player.video's HTMLVideoElement-like timeupdate, pause and ended
// events and currentTime); for the video fake's, the sample player. So the
// Lesson screen's saving (src/lib/courses/lesson-saving.ts) is written once,
// and e2e drives it through the sample player.
// ─────────────────────────────────────────────────────────────────────────────

interface LessonPlayerProps {
  pass: PlaybackPass;
  /** The video's length in seconds. */
  seconds: number;
  /** The text drifting across the video (the sample player draws it; VdoCipher draws the pass's). */
  watermark: string;
  /** The video's name, for the player's accessible name. */
  title: string;
  /** Where to start, in seconds. */
  startAt: number;
  /** Told each time, pause and end. */
  onEvent: (event: PlayerEvent) => void;
}

export function LessonPlayer({ pass, onEvent, ...rest }: LessonPlayerProps) {
  const report = useRef(onEvent);
  useEffect(() => {
    report.current = onEvent;
  }, [onEvent]);
  // One function for the player's life, telling whoever listens now.
  const tell = useCallback((event: PlayerEvent) => report.current(event), []);

  if (pass.kind === "sample") return <SampleLessonPlayer {...rest} tell={tell} />;
  return (
    <VdoCipherLessonPlayer
      url={vdoCipherPlayerUrl(pass)}
      title={rest.title}
      startAt={rest.startAt}
      tell={tell}
    />
  );
}

type Tell = (event: PlayerEvent) => void;

/** The sample player, its clock turned into the adapter's events. */
function SampleLessonPlayer({
  seconds,
  watermark,
  title,
  startAt,
  tell,
}: Omit<LessonPlayerProps, "pass" | "onEvent"> & { tell: Tell }) {
  const wasPlaying = useRef(false);
  return (
    <SamplePlayer
      seconds={seconds}
      watermark={watermark}
      title={title}
      startAt={startAt}
      onTime={(position, playing) => {
        if (playing) tell({ type: "time", position });
        else if (wasPlaying.current)
          tell({ type: position >= seconds ? "end" : "pause", position });
        wasPlaying.current = playing;
      }}
    />
  );
}

/** What VdoCipher's player API gives, as far as the adapter uses it. */
interface VdoVideo {
  currentTime: number;
  /** As HTMLVideoElement's: 1 (HAVE_METADATA) or more once it can seek. */
  readyState?: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}
interface VdoPlayerApi {
  getInstance(iframe: HTMLIFrameElement): { video: VdoVideo };
}
declare global {
  interface Window {
    VdoPlayer?: VdoPlayerApi;
  }
}

/** VdoCipher's player API script: on the player's own host, the only script host allowed. */
export const VDOCIPHER_API_SCRIPT = `${VDOCIPHER_PLAYER_ORIGIN}/v2/api.js`;

/** The player API script's load, once per page: resolves to the API, or rejects when it didn't load. */
let vdoPlayerApi: Promise<VdoPlayerApi> | null = null;

/** Loads VdoCipher's player API once per page, resolving to it once it's there. */
function loadVdoPlayerApi(): Promise<VdoPlayerApi> {
  if (window.VdoPlayer) return Promise.resolve(window.VdoPlayer);
  vdoPlayerApi ??= new Promise<VdoPlayerApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = VDOCIPHER_API_SCRIPT;
    script.async = true;
    script.addEventListener("load", () =>
      window.VdoPlayer ? resolve(window.VdoPlayer) : reject(new Error("No VdoPlayer")),
    );
    script.addEventListener("error", () => reject(new Error("VdoCipher's player API didn't load")));
    document.head.append(script);
  }).catch((error: unknown) => {
    // Another Lesson screen tries again.
    vdoPlayerApi = null;
    throw error;
  });
  return vdoPlayerApi;
}

/** VdoCipher's embedded DRM player, its video's events turned into the adapter's. */
function VdoCipherLessonPlayer({
  url,
  title,
  startAt,
  tell,
}: {
  url: string;
  title: string;
  startAt: number;
  tell: Tell;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Where it starts is fixed when the screen opens, whatever a refresh says later.
  const start = useRef(startAt);
  useEffect(() => {
    let detach = () => {};
    let gone = false;
    loadVdoPlayerApi()
      .then((api) => {
        if (gone || !frame.current) return;
        const { video } = api.getInstance(frame.current);
        const at = () => video.currentTime;
        // Picks up at the saved position once the video can seek: now, if its
        // metadata loaded before the API did, else when it does.
        const seek = () => {
          if (start.current > 0) video.currentTime = start.current;
        };
        if ((video.readyState ?? 0) >= 1) seek();
        const handlers: Record<string, () => void> = {
          loadedmetadata: seek,
          timeupdate: () => tell({ type: "time", position: at() }),
          pause: () => tell({ type: "pause", position: at() }),
          ended: () => tell({ type: "end", position: at() }),
        };
        for (const [type, handler] of Object.entries(handlers))
          video.addEventListener(type, handler);
        detach = () => {
          for (const [type, handler] of Object.entries(handlers)) {
            video.removeEventListener(type, handler);
          }
        };
      })
      // Without the API the video still plays; it just isn't saved.
      .catch(() => {});
    return () => {
      gone = true;
      detach();
    };
  }, [url, tell]);

  return (
    <iframe
      ref={frame}
      src={url}
      title={`Video: ${title}`}
      allow="encrypted-media"
      allowFullScreen
      className="aspect-video w-full max-w-xl border-0 bg-black"
    />
  );
}
