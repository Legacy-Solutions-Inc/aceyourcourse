import type { AdminService } from "@/services/admin";
import * as adminSampleArm from "@/services/admin.mock";
import type { MemberService } from "@/services/member";
import * as sampleArm from "@/services/member.mock";
import type { ConsentRecord, Member } from "@/services/member.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import { getSampleStore, resetSampleStore } from "@/services/mock/sample-store";

import { editSampleCatalogue } from "./catalogue-seed";
import { MEMBER_DATABASE_ARM } from "./member-database";

/**
 * The Member seam's arms, for `describe.each(MEMBER_ARMS)` (spec, Phase 3 →
 * Phase 3 seams): one behaviour suite runs against the sample arm in the unit
 * project (`pnpm test`) and the database arm in the database project
 * (`pnpm test:db`, CI), picked like the Admin's by ADMIN_TEST_ARM
 * (vitest.config.ts).
 *
 * Each entry also carries the Admin seam's matching arm, for what Owners
 * change behind the Member's back (the Beta Tester list), and reads back the
 * Member records the seam has no read for.
 */
export interface MemberArm {
  name: string;
  seam: MemberService;
  admin: AdminService;
  /**
   * Restores the sample data, or an edited copy of its catalogue for states
   * the seed lacks, timed from the current (possibly fake) time.
   */
  reset(edit?: (seed: CatalogueSeed) => void): Promise<void>;
  /** Every Member record, in the order they joined. */
  members(): Promise<Member[]>;
  /** Every Member's consent records, in the order they were recorded. */
  consents(): Promise<ConsentRecord[]>;
}

const SAMPLE_ARM: MemberArm = {
  name: "sample data",
  seam: sampleArm,
  admin: adminSampleArm,
  reset: async (edit) => {
    if (edit) editSampleCatalogue(edit);
    else resetSampleStore();
  },
  members: async () => structuredClone(getSampleStore().members),
  consents: async () => structuredClone(getSampleStore().memberConsents),
};

export const MEMBER_ARMS: MemberArm[] =
  process.env.ADMIN_TEST_ARM === "database" ? [MEMBER_DATABASE_ARM] : [SAMPLE_ARM];
