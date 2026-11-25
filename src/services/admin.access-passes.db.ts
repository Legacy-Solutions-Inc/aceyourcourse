import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { type AccessPassStore, accessPassCalls } from "@/services/access-passes.core";
import { accessPassFromRow } from "@/services/content.rows";
import { memberFromRow, targetExamFromRow, writePass } from "@/services/member.db";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Access Pass actions on Postgres (Phase 3, ticket 17): the
// shared calls (src/services/access-passes.core.ts) over access_passes and
// the records a change writes with it. Each change runs in one transaction
// that first locks the Member's row, as the Member seam's Target Exam
// changes do (member.db.ts), so a grant and a Target Exam change for the same
// Member take turns; then the pass, its history row, the Target Exam, the
// notice and the Staff Activity are written together, or none of them.
// Drizzle bypasses RLS, so authorisation is the seam's role check and the
// Staff Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { accessPasses, exams, members, memberTargetExams } = schema;

const databaseAccessPassStore: AccessPassStore = {
  async withPass(userId, examCode, work) {
    try {
      return await getDb().transaction(async (tx) => {
        const [member] = await tx
          .select()
          .from(members)
          .where(eq(members.userId, userId))
          .for("update");
        if (!member) return null;
        const [exam] = await tx
          .select({ code: exams.code })
          .from(exams)
          .where(eq(exams.code, examCode));
        const [pass] = await tx
          .select()
          .from(accessPasses)
          .where(and(eq(accessPasses.userId, userId), eq(accessPasses.examCode, examCode)))
          .for("update");
        const targetExams = await tx
          .select()
          .from(memberTargetExams)
          .where(eq(memberTargetExams.userId, userId))
          .orderBy(asc(memberTargetExams.seq));

        const { write, result } = work({
          member: memberFromRow(member),
          examExists: exam !== undefined,
          pass: pass ? accessPassFromRow(pass) : null,
          targetExams: targetExams.map(targetExamFromRow),
        });
        if (!write) return result;

        await writePass(tx, userId, examCode, write);
        return result;
      });
    } catch (error) {
      throw asDatabaseError(error);
    }
  },
};

export const { grantAccess, extendAccess, endAccess } = accessPassCalls(databaseAccessPassStore);
