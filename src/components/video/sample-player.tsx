"use client";

import { useEffect, useRef, useState } from "react";

import { videoLength } from "@/lib/courses/course-rules";
import { watermarkBackground } from "@/lib/watermark";

// ─────────────────────────────────────────────────────────────────────────────
// The sample video player (Phase 5, ticket 02; spec, Phase 5 planning
// decisions → The VdoCipher key decides): what plays in sample mode and with
// the video fake, in place of VdoCipher's player. A dark 16:9 frame labelled
// "SAMPLE VIDEO", the viewer's watermark drifting across it, play and pause,
// a progress bar and a running clock, with no video file. The Lesson editor's
// preview uses it (ticket 02), and the Member App's Lesson player will
// (tickets 03 and 04: `startAt` resumes, `onTime` reports the position for
// the saves and the 90% rule).
// ─────────────────────────────────────────────────────────────────────────────

/** How often the clock moves. */
const TICK_MS = 250;
/** How long the watermark stays in one spot before drifting to the next. */
const DRIFT_MS = 5000;

/** Where the watermark drifts, in turn: left and top, as percentages of the frame. */
export const WATERMARK_SPOTS = [
  { left: 6, top: 10 },
  { left: 52, top: 62 },
  { left: 30, top: 34 },
  { left: 58, top: 12 },
  { left: 8, top: 66 },
] as const;

export interface SamplePlayerProps {
  /** The video's length in seconds. */
  seconds: number;
  /** The text drifting across the video: the viewer's email (and, for Members, short Member ID). */
  watermark: string;
  /** Where to start, in seconds. */
  startAt?: number;
  /** Told the position (seconds) and whether it's playing, on each tick, play and pause. */
  onTime?: (position: number, playing: boolean) => void;
  /** Its accessible name, such as the Lesson's title. */
  title?: string;
}

export function SamplePlayer({
  seconds,
  watermark,
  startAt = 0,
  onTime,
  title,
}: SamplePlayerProps) {
  const [position, setPosition] = useState(() => Math.min(Math.max(startAt, 0), seconds));
  const [playing, setPlaying] = useState(false);
  const [spot, setSpot] = useState(0);
  const report = useRef(onTime);
  useEffect(() => {
    report.current = onTime;
  }, [onTime]);

  // The clock runs while playing, and stops at the end.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPosition((now) => {
        const next = Math.min(now + TICK_MS / 1000, seconds);
        if (next >= seconds) setPlaying(false);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, seconds]);

  useEffect(() => {
    report.current?.(position, playing);
  }, [position, playing]);

  // The watermark drifts on whether or not it's playing, as VdoCipher's does.
  useEffect(() => {
    const timer = setInterval(() => setSpot((now) => (now + 1) % WATERMARK_SPOTS.length), DRIFT_MS);
    return () => clearInterval(timer);
  }, []);

  const at = WATERMARK_SPOTS[spot] ?? WATERMARK_SPOTS[0];
  const share = seconds > 0 ? position / seconds : 0;

  return (
    <figure
      aria-label={title ? `Sample video: ${title}` : "Sample video"}
      className="relative m-0 flex aspect-video w-full max-w-xl flex-col justify-between overflow-hidden bg-ayc-navy text-white select-none"
    >
      <span className="m-3 w-fit border border-white/40 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] text-white/80">
        SAMPLE VIDEO
      </span>
      <div
        aria-hidden="true"
        data-testid="sample-watermark"
        className="pointer-events-none absolute h-[60px] w-[240px] bg-no-repeat transition-[left,top] duration-1000"
        style={{
          left: `${at.left}%`,
          top: `${at.top}%`,
          // A data: picture can't read a CSS token: white, half opacity, on the navy frame.
          backgroundImage: watermarkBackground(watermark, { fill: "#ffffff", opacity: 0.5 }),
          backgroundPosition: "center -30px",
        }}
      />
      <div className="flex items-center gap-3 bg-black/40 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            if (position >= seconds) setPosition(0);
            setPlaying((now) => !now);
          }}
          aria-label={playing ? "Pause" : "Play"}
          className="min-h-9 min-w-9 cursor-pointer border border-white/50 font-mono text-sm font-bold"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div
          role="progressbar"
          aria-label="Played"
          aria-valuemin={0}
          aria-valuemax={Math.round(seconds)}
          aria-valuenow={Math.floor(position)}
          aria-valuetext={`${videoLength(position)} of ${videoLength(seconds)}`}
          className="h-1.5 flex-1 bg-white/25"
        >
          <div className="h-full bg-white" style={{ width: `${share * 100}%` }} />
        </div>
        <span className="font-mono text-xs tabular-nums" data-testid="sample-clock">
          {videoLength(position)} / {videoLength(seconds)}
        </span>
      </div>
    </figure>
  );
}
