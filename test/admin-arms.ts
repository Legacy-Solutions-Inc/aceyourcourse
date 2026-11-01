import type { AdminService } from "@/services/admin";
import * as sampleArm from "@/services/admin.mock";
import type { DeniedSignIn, StaffActivity } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "./catalogue-seed";

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
  /**
   * Restores the seed data, or an edited copy of it for states the seed lacks.
   * Times in it are relative to the current (possibly fake) time.
   */
  reset(edit?: (seed: CatalogueSeed) => void): Promise<void>;
  /** Deletes a Product (and its Reviews) behind the seam's back, as another Staff User might. */
  deleteProductElsewhere(id: string): Promise<void>;
  staffActivity(): Promise<StaffActivity[]>;
  deniedSignIns(): Promise<DeniedSignIn[]>;
}

export const ADMIN_ARMS: AdminArm[] = [
  {
    name: "sample data",
    seam: sampleArm,
    reset: async (edit) => {
      if (edit) editSampleCatalogue(edit);
      else resetSampleStore();
    },
    deleteProductElsewhere: async (id) => {
      const { catalogue } = getSampleStore();
      catalogue.products = catalogue.products.filter((product) => product.id !== id);
      catalogue.reviews = catalogue.reviews.filter((review) => review.productId !== id);
    },
    staffActivity: async () => structuredClone(getSampleStore().staffActivity),
    deniedSignIns: async () => structuredClone(getSampleStore().deniedSignIns),
  },
];
