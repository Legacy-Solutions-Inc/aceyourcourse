import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNull,
  not,
  or,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { asDatabaseError } from "@/lib/db/errors";
import * as schema from "@/lib/db/schema";
import { staffActivityToRow } from "@/services/admin.rows";
import type { AdminUserRow, UserFilter, UserRole } from "@/services/admin.types";
import { accessPassGrantFromRow } from "@/services/content.rows";
import { consentFromRow, databaseArm as memberArm, memberFromRow } from "@/services/member.db";
import { orderFromRow } from "@/services/orders.rows";
import { type UsersStore, usersCalls } from "@/services/users.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Users on Postgres (Phase 3, ticket 16): the shared calls
// (src/services/users.core.ts) over the members table and the records that
// hang off it. The list's search, filters and page run in SQL, so a page
// reads only its own Members' records, whatever the number of Members; each
// filter is the sample arm's (users.core.ts) as a condition: an Access Pass
// active now is one that ends later than now. A search is text, never a
// pattern: LIKE's wildcards and its escape character are escaped. A forced
// sign-out deletes the Active Device and writes its Staff Activity in one
// transaction, and records nothing when there was no device to delete.
// Drizzle bypasses RLS, so authorisation is the seam's role check and the
// Staff Guard (coding standards §3).
// ─────────────────────────────────────────────────────────────────────────────

const { accessPasses, accessPassGrants, betaTesters, memberActiveDevices, members } = schema;
const { memberConsents, memberTargetExams, staff, staffActivity } = schema;

async function inDatabase<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw asDatabaseError(error);
  }
}

/** Pure: a search as a LIKE pattern matching it anywhere, as text. */
const containing = (q: string) => `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** The Member holds an Access Pass, or (with `now`) one that ends later than `now`. */
function holdsPass(now?: Date): SQL {
  const own = eq(accessPasses.userId, members.userId);
  return exists(
    getDb()
      .select({ userId: accessPasses.userId })
      .from(accessPasses)
      .where(now ? and(own, gt(accessPasses.endsAt, now)) : own),
  );
}

/** The Member's email is an active Staff User's. */
const isStaff = () =>
  exists(
    getDb()
      .select({ email: staff.email })
      .from(staff)
      .where(and(eq(staff.email, members.email), eq(staff.status, "active"))),
  );

/** The Member's email is on the Beta Tester list. */
const isBetaTester = () =>
  exists(
    getDb()
      .select({ email: betaTesters.email })
      .from(betaTesters)
      .where(eq(betaTesters.email, members.email)),
  );

/** The condition a filter puts on a Member, at `now`. */
function filterCondition(filter: UserFilter, now: Date): SQL | undefined {
  switch (filter) {
    case "all":
      return undefined;
    case "active":
      return holdsPass(now);
    case "expired":
      return and(holdsPass(), not(holdsPass(now)));
    case "none":
      return not(holdsPass());
    case "staff":
      return isStaff();
    case "beta":
      return isBetaTester();
  }
}

/** Each Member's role now, by email: their Staff Role while they're active Staff. */
async function rolesOf(emails: readonly string[]): Promise<Map<string, UserRole>> {
  if (emails.length === 0) return new Map();
  const rows = await getDb()
    .select({ email: staff.email, role: staff.role })
    .from(staff)
    .where(and(inArray(staff.email, [...emails]), eq(staff.status, "active")));
  return new Map(rows.map(({ email, role }) => [email, role]));
}

/** Which of these emails are on the Beta Tester list. */
async function betaTestersOf(emails: readonly string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const rows = await getDb()
    .select({ email: betaTesters.email })
    .from(betaTesters)
    .where(inArray(betaTesters.email, [...emails]));
  return new Set(rows.map(({ email }) => email));
}

/** The list's rows for these Members, in the order given. */
async function rowsOf(page: (typeof members.$inferSelect)[]): Promise<AdminUserRow[]> {
  if (page.length === 0) return [];
  const ids = page.map(({ userId }) => userId);
  const emails = page.map(({ email }) => email);
  const db = getDb();
  const [targetExams, passes, devices, roles, testers] = await Promise.all([
    db
      .select({ userId: memberTargetExams.userId, examCode: memberTargetExams.examCode })
      .from(memberTargetExams)
      .where(and(inArray(memberTargetExams.userId, ids), isNull(memberTargetExams.removedAt)))
      .orderBy(asc(memberTargetExams.seq)),
    db
      .select()
      .from(accessPasses)
      .where(inArray(accessPasses.userId, ids))
      .orderBy(asc(accessPasses.examCode)),
    db.select().from(memberActiveDevices).where(inArray(memberActiveDevices.userId, ids)),
    rolesOf(emails),
    betaTestersOf(emails),
  ]);
  return page.map((row) => {
    const device = devices.find((candidate) => candidate.userId === row.userId);
    return {
      ...memberFromRow(row),
      targetExams: targetExams
        .filter((record) => record.userId === row.userId)
        .map(({ examCode }) => examCode),
      accessPasses: passes
        .filter((pass) => pass.userId === row.userId)
        .map(({ examCode, endsAt }) => ({ examCode, endsAt: endsAt.toISOString() })),
      activeDevice: device
        ? { deviceLabel: device.deviceLabel, claimedAt: device.claimedAt.toISOString() }
        : null,
      role: roles.get(row.email) ?? "member",
      betaTester: testers.has(row.email),
    };
  });
}

const databaseUsersStore: UsersStore = {
  listMembers: ({ q, filter }, { offset, limit }, now) =>
    inDatabase(async () => {
      const db = getDb();
      const where = and(
        q ? or(ilike(members.name, containing(q)), ilike(members.email, containing(q))) : undefined,
        filterCondition(filter, now),
      );
      const [page, [matching], [total]] = await Promise.all([
        db
          .select()
          .from(members)
          .where(where)
          .orderBy(desc(members.joinedAt), asc(members.userId))
          .limit(limit)
          .offset(offset),
        db.select({ n: count() }).from(members).where(where),
        db.select({ n: count() }).from(members),
      ]);
      return { rows: await rowsOf(page), matching: matching?.n ?? 0, total: total?.n ?? 0 };
    }),

  readMember: (userId) =>
    inDatabase(async () => {
      const db = getDb();
      const [row] = await db.select().from(members).where(eq(members.userId, userId));
      if (!row) return null;
      const [roles, testers, passes, grants, consents, orders] = await Promise.all([
        rolesOf([row.email]),
        betaTestersOf([row.email]),
        db
          .select()
          .from(accessPasses)
          .where(eq(accessPasses.userId, userId))
          .orderBy(asc(accessPasses.examCode)),
        db
          .select()
          .from(accessPassGrants)
          .where(eq(accessPassGrants.userId, userId))
          .orderBy(asc(accessPassGrants.seq)),
        db
          .select()
          .from(memberConsents)
          .where(eq(memberConsents.userId, userId))
          .orderBy(asc(memberConsents.seq)),
        db.select().from(schema.orders).where(eq(schema.orders.userId, userId)),
      ]);
      return {
        member: memberFromRow(row),
        role: roles.get(row.email) ?? "member",
        betaTester: testers.has(row.email),
        accessPasses: passes.map(({ examCode, endsAt }) => ({
          examCode,
          endsAt: endsAt.toISOString(),
          grants: grants
            .filter((grant) => grant.examCode === examCode)
            .map((grant) => {
              const { userId: _, examCode: __, ...shown } = accessPassGrantFromRow(grant);
              return shown;
            }),
        })),
        consents: consents.map(consentFromRow),
        orders: orders.map(orderFromRow),
      };
    }),

  clearActiveDevice: (userId, activity) =>
    inDatabase(() =>
      getDb().transaction(async (tx) => {
        const [row] = await tx.select().from(members).where(eq(members.userId, userId));
        if (!row) return null;
        const member = memberFromRow(row);
        const [cleared] = await tx
          .delete(memberActiveDevices)
          .where(eq(memberActiveDevices.userId, userId))
          .returning({
            deviceLabel: memberActiveDevices.deviceLabel,
            claimedAt: memberActiveDevices.claimedAt,
          });
        if (!cleared) return { member, device: null };
        const device = {
          deviceLabel: cleared.deviceLabel,
          claimedAt: cleared.claimedAt.toISOString(),
        };
        await tx.insert(staffActivity).values(staffActivityToRow(activity(member, device)));
        return { member, device };
      }),
    ),
};

export const { listUsers, getMemberForAdmin, forceSignOut } = usersCalls(
  databaseUsersStore,
  memberArm,
);
