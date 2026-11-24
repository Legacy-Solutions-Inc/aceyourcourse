import type * as schema from "@/lib/db/schema";
import { toPlanDays } from "@/lib/plans/plan-rules";
import type {
  AdminPlan,
  BetaTester,
  DeniedSignIn,
  Invite,
  RecordStamp,
  StaffActivity,
  StaffMember,
} from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// Pure mappers between the Admin's own tables (src/lib/db/schema.ts) and the
// Admin seam's types, both ways, for the database arm (admin.db.ts). Times are
// ISO strings in the seam and Dates in the rows. Lists come back in their
// stored order, whatever order the rows arrive in.
// ─────────────────────────────────────────────────────────────────────────────

export type StaffRow = typeof schema.staff.$inferSelect;
export type DeniedSignInRow = typeof schema.deniedSignIns.$inferSelect;
export type StaffActivityRow = typeof schema.staffActivity.$inferSelect;
export type RecordStampRow = typeof schema.recordStamps.$inferSelect;
export type BetaTesterRow = typeof schema.betaTesters.$inferSelect;

/** The record whose stamp says when the seed was loaded: what an unsaved record's stamp is. */
export const SEEDED_RECORD = "seeded";

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? iso(date) : null);

/** A column the row's status guarantees (the staff table checks it). */
function required<T>(value: T | null, column: string, email: string): T {
  if (value === null) throw new Error(`The staff row for ${email} has no ${column}.`);
  return value;
}

// ── The staff list ──────────────────────────────────────────────────────────

export function staffFromRows(rows: readonly StaffRow[]): {
  staff: StaffMember[];
  invites: Invite[];
} {
  const ordered = [...rows].sort((a, b) => a.position - b.position);
  return {
    staff: ordered
      .filter((row) => row.status === "active")
      .map((row) => ({
        email: row.email,
        name: required(row.name, "name", row.email),
        role: row.role,
        addedAt: iso(required(row.addedAt, "added_at", row.email)),
        lastSignedInAt: isoOrNull(row.lastSignedInAt),
      })),
    invites: ordered
      .filter((row) => row.status === "invited")
      .map((row) => ({
        email: row.email,
        role: row.role,
        createdAt: iso(required(row.invitedAt, "invited_at", row.email)),
        expiresAt: iso(required(row.expiresAt, "expires_at", row.email)),
      })),
  };
}

export function staffToRows({
  staff,
  invites,
}: {
  staff: readonly StaffMember[];
  invites: readonly Invite[];
}): StaffRow[] {
  return [
    ...staff.map((member, position): StaffRow => ({
      email: member.email,
      position,
      status: "active",
      role: member.role,
      name: member.name,
      addedAt: new Date(member.addedAt),
      lastSignedInAt: member.lastSignedInAt ? new Date(member.lastSignedInAt) : null,
      invitedAt: null,
      expiresAt: null,
    })),
    ...invites.map((invite, position): StaffRow => ({
      email: invite.email,
      position,
      status: "invited",
      role: invite.role,
      name: null,
      addedAt: null,
      lastSignedInAt: null,
      invitedAt: new Date(invite.createdAt),
      expiresAt: new Date(invite.expiresAt),
    })),
  ];
}

// ── Denied sign-ins and Staff Activity ──────────────────────────────────────

export const deniedSignInFromRow = (row: Omit<DeniedSignInRow, "seq">): DeniedSignIn => ({
  id: row.id,
  email: row.email,
  reason: row.reason,
  at: iso(row.at),
});

export const deniedSignInToRow = (attempt: DeniedSignIn): Omit<DeniedSignInRow, "seq"> => ({
  id: attempt.id,
  email: attempt.email,
  reason: attempt.reason,
  at: new Date(attempt.at),
});

export const staffActivityFromRow = (row: Omit<StaffActivityRow, "seq">): StaffActivity => ({
  id: row.id,
  at: iso(row.at),
  actor: { email: row.actorEmail, name: row.actorName },
  entity: row.entity,
  entityId: row.entityId,
  action: row.action,
  before: row.before,
  after: row.after,
});

export const staffActivityToRow = (activity: StaffActivity): Omit<StaffActivityRow, "seq"> => ({
  id: activity.id,
  at: new Date(activity.at),
  actorEmail: activity.actor.email,
  actorName: activity.actor.name,
  entity: activity.entity,
  entityId: activity.entityId,
  action: activity.action,
  // jsonb holds JSON: a value it can't (undefined inside) is written as JSON writes it.
  before: activity.before ?? null,
  after: activity.after ?? null,
});

// ── Beta Testers ────────────────────────────────────────────────────────────

/** The Beta Tester list, in the order they were added, whatever order the rows arrive in. */
export const betaTestersFromRows = (rows: readonly BetaTesterRow[]): BetaTester[] =>
  [...rows]
    .sort((a, b) => a.seq - b.seq)
    .map((row) => ({
      email: row.email,
      addedAt: iso(row.addedAt),
      addedBy: { email: row.addedByEmail, name: row.addedByName },
    }));

export const betaTesterToRow = (tester: BetaTester): Omit<BetaTesterRow, "seq"> => ({
  email: tester.email,
  addedAt: new Date(tester.addedAt),
  addedByEmail: tester.addedBy.email,
  addedByName: tester.addedBy.name,
});

// ── Record stamps ───────────────────────────────────────────────────────────

/**
 * The stamps by record, and when the seed was loaded (the stamp of a record
 * nobody has saved since). A database seeded before stamps existed reads as
 * seeded at the epoch.
 */
export function stampsFromRows(rows: readonly RecordStampRow[]): {
  seededAt: string;
  stamps: Record<string, RecordStamp>;
} {
  const stamps: Record<string, RecordStamp> = {};
  let seededAt = new Date(0).toISOString();
  for (const row of rows) {
    if (row.record === SEEDED_RECORD) seededAt = iso(row.updatedAt);
    else stamps[row.record] = { savedAt: iso(row.updatedAt), savedBy: row.updatedBy };
  }
  return { seededAt, stamps };
}

export function stampsToRows(stamps: Record<string, RecordStamp>): RecordStampRow[] {
  return Object.entries(stamps).map(([record, stamp]) => ({
    record,
    updatedAt: new Date(stamp.savedAt),
    updatedBy: stamp.savedBy,
  }));
}

// ── Plans (Phase 4, ticket 01) ──────────────────────────────────────────────

export type PlanRow = typeof schema.plans.$inferSelect;

/** Pure: a Plan's row as the seam's Plan, with its last save as its stamp. */
export const planFromRow = (row: PlanRow): AdminPlan => ({
  id: row.id,
  examCode: row.examCode,
  name: row.name,
  // The table's check keeps the days to a Plan's durations.
  days: toPlanDays(row.days),
  priceCentavos: row.priceCentavos,
  bestValue: row.bestValue,
  onSale: row.onSale,
  stamp: { savedAt: row.savedAt.toISOString(), savedBy: row.savedBy },
});

/** Pure: the seam's Plan as its row. */
export const planToRow = ({ stamp, ...plan }: AdminPlan): PlanRow => ({
  ...plan,
  savedAt: new Date(stamp.savedAt),
  savedBy: stamp.savedBy,
});
