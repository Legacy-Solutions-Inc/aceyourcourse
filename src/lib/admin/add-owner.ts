import { eq, sql } from "drizzle-orm";

import { describeStaff } from "@/lib/db/check";
import { connectDatabase, type Database } from "@/lib/db/connect";
import { connectionFailureCode, postgresErrorCode } from "@/lib/db/errors";
import { isLocalDatabase } from "@/lib/db/local-database";
import * as schema from "@/lib/db/schema";
import { staffEmailSchema } from "@/services/admin.schema";
import { type StaffRow, staffFromRows } from "@/services/admin.rows";
import type { StaffActivity } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// pnpm staff:add-owner <email> (scripts/staff-add-owner.ts, ticket 16): puts
// the first Owner on the staff list at deployment, before anyone can sign in
// to add one in Settings. It makes the email an active Owner, from nothing,
// an Editor or an Invite, records it in Staff Activity with the actor
// "deployment", and changes nothing when the email is an Owner already, so
// running it again is safe. The email is typed at the terminal, never kept in
// the repo. It never prints DATABASE_URL: a failure shows only its code.
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = "Usage: pnpm staff:add-owner <email>";

/** Who Staff Activity says made the change: the deployment, not a signed-in User. */
export const DEPLOYMENT_ACTOR = { email: "deployment", name: "deployment" } as const;

export type AddOwnerOutcome = "added" | "upgraded-editor" | "upgraded-invite" | "unchanged";

export interface OwnerPlan {
  outcome: AddOwnerOutcome;
  /** The email's staff row afterwards. */
  row: StaffRow;
  /** What Staff Activity records, or null when nothing changes. */
  activity: StaffActivity | null;
}

/** A staff row as the Admin shows it (a Staff User or an Invite), for Staff Activity. */
function shown(row: StaffRow) {
  const { staff, invites } = staffFromRows([row]);
  return staff[0] ?? invites[0] ?? null;
}

/**
 * Pure: what the email's staff row becomes. `nextPosition` is the end of the
 * Staff list, where a new Owner goes. A new Owner is named by their email
 * until their first sign-in with Google names them (recordSignIn), as an
 * Invite activated without a Google name is.
 */
export function planOwner(
  existing: StaffRow | undefined,
  email: string,
  now: Date,
  nextPosition: number,
): OwnerPlan {
  if (existing?.status === "active" && existing.role === "owner") {
    return { outcome: "unchanged", row: existing, activity: null };
  }

  const row: StaffRow =
    existing?.status === "active"
      ? { ...existing, role: "owner" }
      : {
          email,
          position: nextPosition,
          status: "active",
          role: "owner",
          name: email,
          addedAt: now,
          lastSignedInAt: null,
          invitedAt: null,
          expiresAt: null,
        };
  const outcome: AddOwnerOutcome = !existing
    ? "added"
    : existing.status === "active"
      ? "upgraded-editor"
      : "upgraded-invite";
  return {
    outcome,
    row,
    activity: {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      actor: { ...DEPLOYMENT_ACTOR },
      entity: "staff",
      entityId: email,
      action: outcome === "upgraded-editor" ? "change-role" : "add-owner",
      before: existing ? shown(existing) : null,
      after: shown(row),
    },
  };
}

/** Makes the email an active Owner, in one transaction, with its Staff Activity. */
export async function addOwner(db: Database, email: string, now: Date): Promise<AddOwnerOutcome> {
  return db.transaction(async (tx) => {
    // One run at a time: a second one waits, then finds the Owner.
    await tx.execute(sql`lock table ${schema.staff} in share row exclusive mode`);
    const [existing] = await tx.select().from(schema.staff).where(eq(schema.staff.email, email));
    const [last] = await tx
      .select({ position: sql<number | null>`max(${schema.staff.position})` })
      .from(schema.staff)
      .where(eq(schema.staff.status, "active"));
    const plan = planOwner(existing, email, now, (last?.position ?? -1) + 1);
    if (!plan.activity) return plan.outcome;

    const { email: _key, ...fields } = plan.row;
    await tx
      .insert(schema.staff)
      .values(plan.row)
      .onConflictDoUpdate({ target: schema.staff.email, set: fields });
    const { activity } = plan;
    await tx.insert(schema.staffActivity).values({
      id: activity.id,
      at: new Date(activity.at),
      actorEmail: activity.actor.email,
      actorName: activity.actor.name,
      entity: activity.entity,
      entityId: activity.entityId,
      action: activity.action,
      before: activity.before,
      after: activity.after,
    });
    return plan.outcome;
  });
}

/** The staff list's counts, as `pnpm db:check` reports them. */
async function staffCounts(db: Database) {
  const [counts] = await db
    .select({
      owners: sql<number>`count(*) filter (where status = 'active' and role = 'owner')::int`,
      editors: sql<number>`count(*) filter (where status = 'active' and role = 'editor')::int`,
      invites: sql<number>`count(*) filter (where status = 'invited')::int`,
    })
    .from(schema.staff);
  return counts ?? { owners: 0, editors: 0, invites: 0 };
}

const RESULTS: Record<AddOwnerOutcome, (email: string) => string> = {
  added: (email) => `✓ Added ${email} as an Owner.`,
  "upgraded-editor": (email) => `✓ ${email} was an Editor, and is an Owner now.`,
  "upgraded-invite": (email) => `✓ ${email} had an Invite, and is an Owner now.`,
  unchanged: (email) => `✓ ${email} is an Owner already. Nothing was changed.`,
};

// ── The command ─────────────────────────────────────────────────────────────

export interface AddOwnerCommand {
  /** The command line after `pnpm staff:add-owner`: one email. */
  args: readonly string[];
  /** DATABASE_URL, which is never printed. */
  databaseUrl: string | undefined;
  connectTimeoutSeconds?: number;
  log(line: string): void;
  error(line: string): void;
}

/** Runs the command and gives its exit code: 0 once the email is an Owner. */
export async function runAddOwner(command: AddOwnerCommand): Promise<number> {
  const { args, databaseUrl: url, log, error } = command;
  const [typed] = args;
  if (args.length !== 1 || typed === undefined) {
    error(USAGE);
    return 1;
  }
  const email = staffEmailSchema.safeParse(typed);
  if (!email.success) {
    error(`${JSON.stringify(typed)} isn't an email address. Nothing was changed.`);
    return 1;
  }
  if (!url) {
    error(
      "DATABASE_URL is not set. Set it to the database to add the Owner to. Nothing was changed.",
    );
    return 1;
  }
  const local = isLocalDatabase(url);
  if (local === null) {
    error("DATABASE_URL is not a valid connection string. Nothing was changed.");
    return 1;
  }

  const connection = connectDatabase(url, {
    connectTimeoutSeconds: command.connectTimeoutSeconds,
    max: 1,
  });
  try {
    const outcome = await addOwner(connection.db, email.data, new Date());
    log(`On ${local ? "the local database" : "a database on another machine"}:`);
    log(RESULTS[outcome](email.data));
    log(describeStaff(await staffCounts(connection.db)));
    return 0;
  } catch (failure) {
    const unreachable = connectionFailureCode(failure);
    const refused = postgresErrorCode(failure);
    error(
      unreachable
        ? `Couldn't reach the database (${unreachable}). Nothing was changed.`
        : refused
          ? `Postgres refused the change (${refused}). Are the migrations applied? Nothing was changed.`
          : "The change failed. Nothing was changed.",
    );
    return 1;
  } finally {
    await connection.close();
  }
}
