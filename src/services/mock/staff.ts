import type { Invite, StaffMember, StaffRole } from "@/services/admin.types";

// ─────────────────────────────────────────────────────────────────────────────
// The sample Users for the Admin's Stage A "Sign in as" list (CONVENTIONS §5),
// and the staff list they start with. These are the mockup's samples; never add
// a real person's address here. The first production Owner is added at
// deployment instead.
// ─────────────────────────────────────────────────────────────────────────────

export type SampleUserKey = "owner" | "editor" | "invited" | "expired" | "not-staff";

export interface SampleUser {
  key: SampleUserKey;
  name: string;
  email: string;
  /** What the sample data starts them as, for the "Sign in as" list. */
  startsAs: string;
}

export const SAMPLE_USERS: readonly SampleUser[] = [
  {
    key: "owner",
    name: "Angel Rose L. Lepaña",
    email: "angel@aceyourcourse.ph",
    startsAs: "Owner",
  },
  {
    key: "editor",
    name: "AYC Content Team",
    email: "content@aceyourcourse.ph",
    startsAs: "Editor",
  },
  {
    key: "invited",
    name: "Kim Reyes",
    email: "kim.reyes@gmail.com",
    startsAs: "Invited as an Editor",
  },
  {
    key: "expired",
    name: "Expired Invite",
    email: "expired.invite@example.com",
    startsAs: "Invite expired",
  },
  {
    key: "not-staff",
    name: "Juan Dela Cruz",
    email: "juan.delacruz@gmail.com",
    startsAs: "Not on the staff list",
  },
];

const DAY = 24 * 60 * 60 * 1000;
/** An Invite expires 7 days after it was made or last renewed. */
const INVITE_DAYS = 7;

function sampleUser(key: SampleUserKey): SampleUser {
  const user = SAMPLE_USERS.find((candidate) => candidate.key === key);
  if (!user) throw new Error(`No sample User "${key}"`);
  return user;
}

/** An Invite made, or renewed, at `createdAt`: it expires 7 days later. */
export function inviteMadeAt(email: string, role: StaffRole, createdAt: Date): Invite {
  return {
    email,
    role,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + INVITE_DAYS * DAY).toISOString(),
  };
}

const invite = (key: SampleUserKey, createdAt: number) =>
  inviteMadeAt(sampleUser(key).email, "editor", new Date(createdAt));

/**
 * The staff list the sample data starts with, timed from when the server
 * booted (or the data was reset): the Owner and the Editor are active, Kim's
 * Invite expires 6 days after boot, and the other Invite expired 1 day before.
 */
export function sampleStaff(bootedAt: Date): { staff: StaffMember[]; invites: Invite[] } {
  const boot = bootedAt.getTime();
  const owner = sampleUser("owner");
  const editor = sampleUser("editor");
  return {
    staff: [
      {
        email: owner.email,
        name: owner.name,
        role: "owner",
        addedAt: new Date(boot - 90 * DAY).toISOString(),
        lastSignedInAt: null,
      },
      {
        email: editor.email,
        name: editor.name,
        role: "editor",
        addedAt: new Date(boot - 30 * DAY).toISOString(),
        lastSignedInAt: new Date(boot - 2 * DAY).toISOString(),
      },
    ],
    invites: [invite("invited", boot - DAY), invite("expired", boot - 8 * DAY)],
  };
}
