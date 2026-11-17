import { createHash } from "node:crypto";

import type { BetaTester } from "@/services/admin.types";
import { SAMPLE_USERS } from "@/services/mock/staff";

// ─────────────────────────────────────────────────────────────────────────────
// The sample Members for the Member App's development-only "Sign in as" list
// (Phase 3, ticket 01), and the Beta Tester list the sample data starts with.
// Never add a real person's address here.
// ─────────────────────────────────────────────────────────────────────────────

export type SampleMemberKey = "tester" | "owner" | "stranger";

export interface SampleMember {
  key: SampleMemberKey;
  name: string;
  email: string;
  /** What the sample data starts them as, for the "Sign in as" list. */
  startsAs: string;
}

function sampleOwner() {
  const owner = SAMPLE_USERS.find((user) => user.key === "owner");
  if (!owner) throw new Error("The sample data has no Owner");
  return owner;
}

export const SAMPLE_MEMBERS: readonly SampleMember[] = [
  { key: "tester", name: "Bea Tester", email: "tester@example.com", startsAs: "Beta Tester" },
  { key: "owner", name: sampleOwner().name, email: sampleOwner().email, startsAs: "Owner" },
  {
    key: "stranger",
    name: "Sam Stranger",
    email: "stranger@example.com",
    startsAs: "Not a Beta Tester · sees “Not open yet”",
  },
];

const DAY = 24 * 60 * 60 * 1000;

/** The Beta Testers the sample data starts with: the sample tester, added by the Owner 3 days before boot. */
export function sampleBetaTesters(bootedAt: Date): BetaTester[] {
  const { email, name } = sampleOwner();
  const tester = SAMPLE_MEMBERS.find((member) => member.key === "tester");
  if (!tester) throw new Error("The sample data has no Beta Tester");
  return [
    {
      email: tester.email,
      addedAt: new Date(bootedAt.getTime() - 3 * DAY).toISOString(),
      addedBy: { email, name },
    },
  ];
}

/**
 * Pure: the User id "Sign in as" gives an email. A sample User has no
 * Supabase User, so the id is made from the email, the same every time and on
 * every restart: a Member record keeps finding its User.
 */
export function sampleUserId(email: string): string {
  const hex = createHash("sha256")
    .update(`sample-user:${email.trim().toLowerCase()}`)
    .digest("hex");
  // Shaped as a version 4 UUID, which is what a Supabase User's id is.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
