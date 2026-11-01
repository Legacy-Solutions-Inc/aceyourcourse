import type { z } from "zod";

import {
  type ChangeStaffRoleInput,
  changeStaffRoleSchema,
  invalidInput,
  type InviteStaffInput,
  inviteStaffSchema,
  roleRefusal,
  staffEmailInputSchema,
  staffEmailSchema,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminResult,
  DeniedSignIn,
  Invite,
  SignInIdentity,
  SignInResolution,
  StaffActivity,
  StaffActor,
  StaffList,
  StaffMember,
} from "@/services/admin.types";
import { getSampleStore, type SampleStore } from "@/services/mock/sample-store";
import { inviteMadeAt } from "@/services/mock/staff";

// The sample arm of the Admin seam's staff areas: sign-in, and the Staff and
// Invites an Owner manages in Settings. Emails are compared case-insensitively,
// so they are trimmed and lowercased on the way in.

/** The normalised email, or null when it isn't an email address at all. */
function normaliseEmail(email: string): string | null {
  const parsed = staffEmailSchema.safeParse(email);
  return parsed.success ? parsed.data : null;
}

const toActor = ({ email, name, role }: StaffMember): StaffActor => ({ email, name, role });

export async function resolveSignIn(
  identity: SignInIdentity,
  now: Date,
): Promise<SignInResolution> {
  const email = normaliseEmail(identity.email);
  if (!email) return { status: "denied", reason: "not-staff" };

  const store = getSampleStore();
  const member = store.staff.find((candidate) => candidate.email === email);
  if (member) return { status: "staff", actor: toActor(member) };

  const invite = store.invites.find((candidate) => candidate.email === email);
  if (!invite) return { status: "denied", reason: "not-staff" };
  if (now.getTime() >= new Date(invite.expiresAt).getTime()) {
    return { status: "denied", reason: "invite-expired" };
  }

  // The first sign-in with the invited email activates the Invite.
  const at = now.toISOString();
  const activated: StaffMember = {
    email,
    name: identity.name?.trim() || email,
    role: invite.role,
    addedAt: at,
    lastSignedInAt: at,
  };
  store.invites = store.invites.filter((candidate) => candidate !== invite);
  store.staff = [...store.staff, activated];
  store.staffActivity = [
    ...store.staffActivity,
    {
      id: crypto.randomUUID(),
      at,
      actor: { email, name: activated.name },
      entity: "staff",
      entityId: email,
      action: "activate-invite",
      before: structuredClone(invite),
      after: structuredClone(activated),
    },
  ];
  return { status: "staff", actor: toActor(activated) };
}

export async function recordDeniedSignIn(attempt: {
  email: string;
  reason: DeniedSignIn["reason"];
  at: Date;
}): Promise<DeniedSignIn> {
  const record: DeniedSignIn = {
    id: crypto.randomUUID(),
    email: normaliseEmail(attempt.email) ?? attempt.email.trim().toLowerCase(),
    reason: attempt.reason,
    at: attempt.at.toISOString(),
  };
  const store = getSampleStore();
  store.deniedSignIns = [...store.deniedSignIns, record];
  return structuredClone(record);
}

export async function getLatestDeniedSignIn(email: string): Promise<DeniedSignIn | null> {
  const wanted = normaliseEmail(email);
  if (!wanted) return null;
  const latest = getSampleStore()
    .deniedSignIns.filter((attempt) => attempt.email === wanted)
    .reduce<DeniedSignIn | null>(
      (newest, attempt) => (newest && newest.at >= attempt.at ? newest : attempt),
      null,
    );
  return latest ? structuredClone(latest) : null;
}

export async function getStaffByEmail(email: string): Promise<StaffActor | null> {
  const wanted = normaliseEmail(email);
  if (!wanted) return null;
  const member = getSampleStore().staff.find((candidate) => candidate.email === wanted);
  return member ? toActor(member) : null;
}

export async function recordSignIn(email: string, at: Date): Promise<void> {
  const wanted = normaliseEmail(email);
  const store = getSampleStore();
  store.staff = store.staff.map((member) =>
    member.email === wanted ? { ...member, lastSignedInAt: at.toISOString() } : member,
  );
}

// ── Staff and Invites (Owners only) ─────────────────────────────────────────
// Each write checks the actor's Staff Role, validates its input, applies the
// rules (the last Owner stays, nobody changes their own access, an email is on
// the staff list once), then appends one Staff Activity record. None of them
// touches the Catalogue, so none returns a cache tag.

const FORBIDDEN = "ONLY AN OWNER CAN MANAGE STAFF";
const ALREADY_ON_LIST = "This email is already on the staff list.";
const LAST_OWNER = "There must always be at least one Owner.";
const OWN_ACCESS = "You can't remove or change your own access.";

const NOT_FOUND = { ok: false, error: { kind: "not-found" } } as const;
const brokenRule = (formError: string): AdminResult<never> => ({
  ok: false,
  error: { kind: "invalid", fieldErrors: {}, formError },
});

/** The Owner-only check and the input's validation, shared by every write. */
function check<Schema extends z.ZodTypeAny>(
  actor: StaffActor,
  schema: Schema,
  input: unknown,
): { ok: true; input: z.output<Schema> } | { ok: false; error: AdminError } {
  const refusal = roleRefusal(actor, "owner", FORBIDDEN);
  if (refusal) return { ok: false, error: refusal };
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, input: parsed.data }
    : { ok: false, error: invalidInput(parsed.error) };
}

/**
 * Why `member` can't be demoted or removed by `actor`, or null when they can:
 * the only Owner can't stop being one, and nobody changes their own access.
 */
function protectedAccess(store: SampleStore, actor: StaffActor, member: StaffMember) {
  const owners = store.staff.filter((candidate) => candidate.role === "owner");
  if (member.role === "owner" && owners.length === 1) return LAST_OWNER;
  if (member.email === actor.email.toLowerCase()) return OWN_ACCESS;
  return null;
}

function record(
  store: SampleStore,
  actor: StaffActor,
  now: Date,
  change: Pick<StaffActivity, "entity" | "entityId" | "action" | "before" | "after">,
) {
  store.staffActivity = [
    ...store.staffActivity,
    {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      actor: { email: actor.email, name: actor.name },
      ...change,
      before: structuredClone(change.before),
      after: structuredClone(change.after),
    },
  ];
}

const saved = <T>(value: T): AdminResult<T> => ({
  ok: true,
  value: structuredClone(value),
  tags: [],
});

export async function listStaff(actor: StaffActor): Promise<AdminResult<StaffList>> {
  const refusal = roleRefusal(actor, "owner", FORBIDDEN);
  if (refusal) return { ok: false, error: refusal };
  const { staff, invites } = getSampleStore();
  return saved({ staff, invites });
}

export async function inviteStaff(
  actor: StaffActor,
  input: InviteStaffInput,
): Promise<AdminResult<Invite>> {
  const checked = check(actor, inviteStaffSchema, input);
  if (!checked.ok) return checked;
  const { email, role } = checked.input;

  const store = getSampleStore();
  const listed = [...store.staff, ...store.invites].some((entry) => entry.email === email);
  if (listed) {
    return { ok: false, error: { kind: "invalid", fieldErrors: { email: [ALREADY_ON_LIST] } } };
  }

  const now = new Date();
  const invite = inviteMadeAt(email, role, now);
  store.invites = [...store.invites, invite];
  record(store, actor, now, {
    entity: "invite",
    entityId: email,
    action: "create",
    before: null,
    after: invite,
  });
  return saved(invite);
}

export async function renewInvite(actor: StaffActor, email: string): Promise<AdminResult<Invite>> {
  const checked = check(actor, staffEmailInputSchema, { email });
  if (!checked.ok) return checked;

  const store = getSampleStore();
  const invite = store.invites.find((candidate) => candidate.email === checked.input.email);
  if (!invite) return NOT_FOUND;

  const now = new Date();
  const renewed = inviteMadeAt(invite.email, invite.role, now);
  store.invites = store.invites.map((candidate) => (candidate === invite ? renewed : candidate));
  record(store, actor, now, {
    entity: "invite",
    entityId: invite.email,
    action: "renew",
    before: invite,
    after: renewed,
  });
  return saved(renewed);
}

export async function cancelInvite(actor: StaffActor, email: string): Promise<AdminResult<Invite>> {
  const checked = check(actor, staffEmailInputSchema, { email });
  if (!checked.ok) return checked;

  const store = getSampleStore();
  const invite = store.invites.find((candidate) => candidate.email === checked.input.email);
  if (!invite) return NOT_FOUND;

  store.invites = store.invites.filter((candidate) => candidate !== invite);
  record(store, actor, new Date(), {
    entity: "invite",
    entityId: invite.email,
    action: "cancel",
    before: invite,
    after: null,
  });
  return saved(invite);
}

export async function changeStaffRole(
  actor: StaffActor,
  input: ChangeStaffRoleInput,
): Promise<AdminResult<StaffMember>> {
  const checked = check(actor, changeStaffRoleSchema, input);
  if (!checked.ok) return checked;
  const { email, role } = checked.input;

  const store = getSampleStore();
  const member = store.staff.find((candidate) => candidate.email === email);
  if (!member) return NOT_FOUND;
  if (member.role === role) return saved(member);
  const refusal = protectedAccess(store, actor, member);
  if (refusal) return brokenRule(refusal);

  const changed: StaffMember = { ...member, role };
  store.staff = store.staff.map((candidate) => (candidate === member ? changed : candidate));
  record(store, actor, new Date(), {
    entity: "staff",
    entityId: email,
    action: "change-role",
    before: member,
    after: changed,
  });
  return saved(changed);
}

export async function removeStaff(
  actor: StaffActor,
  email: string,
): Promise<AdminResult<StaffMember>> {
  const checked = check(actor, staffEmailInputSchema, { email });
  if (!checked.ok) return checked;

  const store = getSampleStore();
  const member = store.staff.find((candidate) => candidate.email === checked.input.email);
  if (!member) return NOT_FOUND;
  const refusal = protectedAccess(store, actor, member);
  if (refusal) return brokenRule(refusal);

  // Their Staff Activity stays: it's the permanent record of what they changed.
  store.staff = store.staff.filter((candidate) => candidate !== member);
  record(store, actor, new Date(), {
    entity: "staff",
    entityId: member.email,
    action: "remove",
    before: member,
    after: null,
  });
  return saved(member);
}
