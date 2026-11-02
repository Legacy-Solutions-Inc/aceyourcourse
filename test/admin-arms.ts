import type { AdminService } from "@/services/admin";
import * as sampleArm from "@/services/admin.mock";
import type { DeniedSignIn, StaffActivity } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";
import type { UploadRequest } from "@/services/uploads.types";

import { editSampleCatalogue } from "./catalogue-seed";
import { imageBytes } from "./image-bytes";
import { UPLOAD_ARMS } from "./upload-arms";

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
    uploadPhoto: async ({ send = true, purpose = "product-photo" } = {}) => {
      const [uploads] = UPLOAD_ARMS;
      if (!uploads) throw new Error("No upload arm");
      const bytes = imageBytes("image/png");
      const created = await uploads.seam.createUpload(
        { email: "content@aceyourcourse.ph", name: "AYC Content Team", role: "editor" },
        { purpose, contentType: "image/png", size: bytes.byteLength },
      );
      if (!created.ok) throw new Error("The upload was refused");
      if (send && !(await uploads.send(created.value, "image/png", bytes))) {
        throw new Error("The file wasn't stored");
      }
      return { path: created.value.path, publicUrl: created.value.publicUrl };
    },
    staffActivity: async () => structuredClone(getSampleStore().staffActivity),
    deniedSignIns: async () => structuredClone(getSampleStore().deniedSignIns),
  },
];
