import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { databaseArm as adminDatabaseArm } from "@/services/admin.db";
import { consentFromRow, databaseArm, memberFromRow } from "@/services/member.db";

import { DATABASE_ARM as ADMIN_DATABASE_ARM } from "./admin-database";
import type { MemberArm } from "./member-arms";

/**
 * The Member seam's database arm in the database project (`pnpm test:db`),
 * where vitest.config.ts points DATABASE_URL at TEST_DATABASE_URL. Each reset
 * loads the seed, the sample staff list and the sample Beta Tester list, and
 * clears the Members and their consent records, as `pnpm db:reset` does.
 */
export const MEMBER_DATABASE_ARM: MemberArm = {
  name: "database",
  seam: databaseArm,
  admin: adminDatabaseArm,
  reset: () => ADMIN_DATABASE_ARM.reset(),
  members: async () =>
    (
      await getDb()
        .select()
        .from(schema.members)
        .orderBy(asc(schema.members.joinedAt), asc(schema.members.userId))
    ).map(memberFromRow),
  consents: async () =>
    (
      await getDb().select().from(schema.memberConsents).orderBy(asc(schema.memberConsents.seq))
    ).map(consentFromRow),
};
