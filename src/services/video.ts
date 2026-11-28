import "server-only";

import { serverEnv } from "@/env.server";
import { type AdminMode, adminMode } from "@/lib/admin/mode";
import { createVdoCipherClient } from "@/lib/vdocipher/client";
import { createFakeVideoService, type FakeVideoService } from "@/services/video.fake";
import type { VideoService } from "@/services/video.types";

// ─────────────────────────────────────────────────────────────────────────────
// The video service selector (Phase 5, ticket 02; spec, Phase 5 planning
// decisions → The VdoCipher key decides; ADR 0013): the video service this
// server has, if any, as the PayMongo key decides payments (payments.ts).
// - Sample mode: the fake, so uploads and the sample player work locally.
// - Otherwise VDOCIPHER_API_SECRET decides: set, VdoCipher; unset, none. With
//   none, the Lesson editor reads "Connect the video service to upload" and
//   upload permission is refused on the server; the rest of the builder works.
// ─────────────────────────────────────────────────────────────────────────────

/** Which video service the server has. */
export type VideoMode = "fake" | "vdocipher" | "off";

export interface VideoModeInputs {
  adminMode: AdminMode;
  /** VDOCIPHER_API_SECRET as set, if at all. */
  apiSecret: string | undefined;
}

/** Pure: the fake in sample mode; otherwise VdoCipher with its secret, or off. */
export function computeVideoMode({ adminMode: mode, apiSecret }: VideoModeInputs): VideoMode {
  if (mode === "sample") return "fake";
  return apiSecret?.trim() ? "vdocipher" : "off";
}

/** The mode this server runs in, fixed for a given build and environment. */
export const videoMode = computeVideoMode({
  adminMode,
  apiSecret: serverEnv.VDOCIPHER_API_SECRET,
});

// The fake keeps what it made, so it lives on globalThis like the sample
// store: every route module and HMR reload share one.
const FAKE = Symbol.for("aceyourcourse.video.fake");
const holder = globalThis as typeof globalThis & { [FAKE]?: FakeVideoService };

/** The video fake, only in sample mode. */
export function sampleVideoFake(): FakeVideoService | null {
  if (videoMode !== "fake") return null;
  return (holder[FAKE] ??= createFakeVideoService());
}

const vdoCipher =
  videoMode === "vdocipher" && serverEnv.VDOCIPHER_API_SECRET
    ? createVdoCipherClient({ apiSecret: serverEnv.VDOCIPHER_API_SECRET })
    : null;

/** The video service this server has, or null when it isn't connected. */
export function videoService(): VideoService | null {
  return vdoCipher ?? sampleVideoFake();
}
