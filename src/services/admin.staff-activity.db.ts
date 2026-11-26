import "server-only";

import { and, desc, eq, inArray, lt, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { staffActivityFromRow } from "@/services/admin.rows";
import { staffActivityCalls, type StaffActivityStore } from "@/services/staff-activity.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Staff Activity list on Postgres (Phase 4, ticket 15): the shared call
// (src/services/staff-activity.core.ts) over the staff_activity table, read
// by keyset on its identity column `seq` (staff_activity_seq_idx), newest
// first. The actors are each email's latest name (DISTINCT ON). A seq is
// taken when a row is inserted, not when its transaction commits, so a
// record whose save was still committing while an Owner paged past its seq
// shows on their next first page, not in the pages they're turning; no
// committed record is ever repeated. Drizzle
// bypasses RLS, so authorisation is the seam's role check and the Staff
// Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { staffActivity } = schema;

async function inDatabase<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

const databaseStaffActivityStore: StaffActivityStore = {
  listActivity: ({ actorEmail, entities, beforeSeq, limit }) =>
    inDatabase(async () => {
      const where: SQL[] = [];
      if (beforeSeq !== null) where.push(lt(staffActivity.seq, beforeSeq));
      if (actorEmail !== null) where.push(eq(staffActivity.actorEmail, actorEmail));
      if (entities !== null) where.push(inArray(staffActivity.entity, [...entities]));
      const rows = await getDb()
        .select()
        .from(staffActivity)
        .where(and(...where))
        .orderBy(desc(staffActivity.seq))
        .limit(limit);
      return rows.map((row) => ({ ...staffActivityFromRow(row), seq: row.seq }));
    }),

  listActivityActors: () =>
    inDatabase(() =>
      getDb()
        .selectDistinctOn([staffActivity.actorEmail], {
          email: staffActivity.actorEmail,
          name: staffActivity.actorName,
        })
        .from(staffActivity)
        .orderBy(staffActivity.actorEmail, desc(staffActivity.seq)),
    ),

  listActivityEntities: () =>
    inDatabase(async () =>
      (await getDb().selectDistinct({ entity: staffActivity.entity }).from(staffActivity)).map(
        ({ entity }) => entity,
      ),
    ),
};

export const { listStaffActivity } = staffActivityCalls(databaseStaffActivityStore);
