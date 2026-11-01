import { staffEmailSchema } from "@/services/admin.schema";
import type {
  DeniedSignIn,
  SignInIdentity,
  SignInResolution,
  StaffActor,
  StaffMember,
} from "@/services/admin.types";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's staff sign-in area. Emails are compared
// case-insensitively, so they are trimmed and lowercased on the way in.

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
