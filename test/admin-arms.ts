import type { AdminService } from "@/services/admin";
import * as sampleArm from "@/services/admin.mock";
import type { DeniedSignIn, StaffActivity } from "@/services/admin.types";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

/**
 * The Admin seam's arms, for `describe.each(ADMIN_ARMS)` (CONVENTIONS §6). Each
 * suite runs the same behaviour against every arm. Stage A has the sample arm
 * only; Stage B adds the database arm here.
 *
 * Besides the arm itself, each entry can reset its data to the seed and read
 * back what the seam has no read for yet, such as Staff Activity.
 */
export interface AdminArm {
  name: string;
  seam: AdminService;
  /** Restores the seed data. Times in it are relative to the current (possibly fake) time. */
  reset(): Promise<void>;
  staffActivity(): Promise<StaffActivity[]>;
  deniedSignIns(): Promise<DeniedSignIn[]>;
}

export const ADMIN_ARMS: AdminArm[] = [
  {
    name: "sample data",
    seam: sampleArm,
    reset: async () => {
      resetSampleStore();
    },
    staffActivity: async () => structuredClone(getSampleStore().staffActivity),
    deniedSignIns: async () => structuredClone(getSampleStore().deniedSignIns),
  },
];
