import type { DeniedSignIn, Invite, StaffActivity, StaffMember } from "@/services/admin.types";
import { sampleStaff } from "@/services/mock/staff";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin's Stage A sample data (CONVENTIONS §3): one editable in-memory copy,
// held by the dev server. It lives on globalThis, so every route module and
// every hot reload share it, and a server restart starts it again from the
// seed. Only the seam's sample arm reads it. Ticket 02 adds the catalogue.
//
// Vitest gotcha: globalThis survives vi.resetModules(), so tests call
// resetSampleStore() rather than reloading modules.
// ─────────────────────────────────────────────────────────────────────────────

export interface SampleStore {
  /** Changes on boot and on every reset, so caches can't outlive the data. */
  generation: string;
  /** When the data was made. The sample Invites' times are relative to it. */
  bootedAt: string;
  staff: StaffMember[];
  invites: Invite[];
  deniedSignIns: DeniedSignIn[];
  staffActivity: StaffActivity[];
}

const STORE = Symbol.for("aceyourcourse.admin.sample-store");
const holder = globalThis as typeof globalThis & { [STORE]?: SampleStore };

function createSampleStore(now: Date): SampleStore {
  return {
    generation: crypto.randomUUID(),
    bootedAt: now.toISOString(),
    ...sampleStaff(now),
    deniedSignIns: [],
    staffActivity: [],
  };
}

/** The sample data, made from the seed on first use. */
export function getSampleStore(): SampleStore {
  return (holder[STORE] ??= createSampleStore(new Date()));
}

/** Starts the sample data again from the seed, timed from now. */
export function resetSampleStore(): SampleStore {
  holder[STORE] = createSampleStore(new Date());
  return holder[STORE];
}
