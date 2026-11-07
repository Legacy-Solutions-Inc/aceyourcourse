import type { AdminService } from "@/services/admin";
import * as sampleArm from "@/services/admin.mock";
import type { DeniedSignIn, StaffActivity } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import type { UploadRequest } from "@/services/uploads.types";

import { DATABASE_ARM } from "./admin-database";
import { editSampleCatalogue } from "./catalogue-seed";
import { uploadSamplePhoto } from "./sample-photo";

/**
 * The Admin seam's arms, for `describe.each(ADMIN_ARMS)` (CONVENTIONS §6). Each
 * suite runs the same behaviour against every arm: the sample arm in the unit
 * project (`pnpm test`), and the database arm in the database project
 * (`pnpm test:db`), which runs these suites too when TEST_DATABASE_URL is set
 * and marks them with ADMIN_TEST_ARM=database (vitest.config.ts).
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
  /** Deletes a Review behind the seam's back, as another Staff User might. */
  deleteReviewElsewhere(id: string): Promise<void>;
  /**
   * Uploads a PNG through the upload seam, as the photo strip does, and gives
   * the path a save records and where the Website will load it from. With
   * `send: false` the browser never sends the file, as when an upload hasn't
   * finished.
   */
  uploadPhoto(options?: {
    send?: boolean;
    purpose?: UploadRequest["purpose"];
  }): Promise<{ path: string; publicUrl: string }>;
  staffActivity(): Promise<StaffActivity[]>;
  deniedSignIns(): Promise<DeniedSignIn[]>;
}

const SAMPLE_ARM: AdminArm = {
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
  deleteReviewElsewhere: async (id) => {
    const { catalogue } = getSampleStore();
    catalogue.reviews = catalogue.reviews.filter((review) => review.id !== id);
  },
  uploadPhoto: uploadSamplePhoto,
  staffActivity: async () => structuredClone(getSampleStore().staffActivity),
  deniedSignIns: async () => structuredClone(getSampleStore().deniedSignIns),
};

export const ADMIN_ARMS: AdminArm[] =
  process.env.ADMIN_TEST_ARM === "database" ? [DATABASE_ARM] : [SAMPLE_ARM];
