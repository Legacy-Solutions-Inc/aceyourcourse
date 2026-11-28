"use client";

import { vdoCipherPlayerUrl } from "@/lib/vdocipher/hosts";
import type { PlaybackPass } from "@/services/video.types";

import { SamplePlayer, type SamplePlayerProps } from "./sample-player";

// A playback pass played (Phase 5, ticket 02): VdoCipher's embedded DRM player
// for a real pass (VdoCipher draws the watermark the pass carries), or the
// sample player for the fake's. The Lesson editor's preview uses it, and the
// Member App's Lesson player will (ticket 03).

interface PassPlayerProps extends Omit<SamplePlayerProps, "title"> {
  pass: PlaybackPass;
  /** The video's name, for the frame's accessible name. */
  title: string;
}

export function PassPlayer({ pass, title, ...sample }: PassPlayerProps) {
  if (pass.kind === "sample") return <SamplePlayer {...sample} title={title} />;
  return (
    <iframe
      src={vdoCipherPlayerUrl(pass)}
      title={`Video: ${title}`}
      allow="encrypted-media"
      allowFullScreen
      className="aspect-video w-full max-w-xl border-0 bg-black"
    />
  );
}
