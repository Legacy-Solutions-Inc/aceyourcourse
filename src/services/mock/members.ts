import type { BetaTester } from "@/services/admin.types";
import type { CatalogueSeed } from "@/services/catalogue.schema";
import type { AccessPass, AccessPassGrant } from "@/services/content.types";
import { SAMPLE_USERS } from "@/services/mock/staff";

import { stableUuid } from "./stable-uuid";

// ─────────────────────────────────────────────────────────────────────────────
// The sample Members for the Member App's development-only "Sign in as" list
// (Phase 3, ticket 01), the Beta Tester list the sample data starts with, and
// their Access Passes (ticket 05). Never add a real person's address here.
// ─────────────────────────────────────────────────────────────────────────────

export type SampleMemberKey = "tester" | "owner" | "stranger" | "lapsed" | "renewing";

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
  {
    key: "tester",
    name: "Bea Tester",
    email: "tester@example.com",
    startsAs: "Beta Tester · CE All-Access",
  },
  { key: "owner", name: sampleOwner().name, email: sampleOwner().email, startsAs: "Owner" },
  {
    key: "stranger",
    name: "Sam Stranger",
    email: "stranger@example.com",
    startsAs: "Not a Beta Tester · sees “Not open yet”",
  },
  {
    key: "lapsed",
    name: "Lou Lapsed",
    email: "lapsed@example.com",
    startsAs: "Beta Tester · CE All-Access ended",
  },
  {
    key: "renewing",
    name: "Rae Renewing",
    email: "renewing@example.com",
    startsAs: "Beta Tester · CE All-Access ends in 5 days",
  },
];

function sampleMember(key: SampleMemberKey): SampleMember {
  const member = SAMPLE_MEMBERS.find((candidate) => candidate.key === key);
  if (!member) throw new Error(`The sample data has no Member "${key}"`);
  return member;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The Beta Testers the sample data starts with, added by the Owner: the
 * sample tester 3 days before boot, then the lapsed tester 2 days before, and
 * the renewing tester 1 day before (Phase 4, ticket 12).
 */
export function sampleBetaTesters(bootedAt: Date): BetaTester[] {
  const { email, name } = sampleOwner();
  return (
    [
      ["tester", 3],
      ["lapsed", 2],
      ["renewing", 1],
    ] as const
  ).map(([key, daysAgo]) => ({
    email: sampleMember(key).email,
    addedAt: new Date(bootedAt.getTime() - daysAgo * DAY).toISOString(),
    addedBy: { email, name },
  }));
}

/**
 * The sample Access Passes, timed from `bootedAt`: the tester's CE pass ends
 * 90 days after boot, the lapsed tester's ended 3 days before, and the
 * renewing tester's ends 5 days after, within its renewal reminder's week
 * (Phase 4, ticket 12). The
 * stranger has none. They're keyed by the User id "Sign in as" gives each
 * Member, so a pass is waiting before its Member's first sign-in. Granting
 * comes with ticket 17, so the grant history starts empty. A catalogue
 * without CE (an edited seed) has no passes.
 */
export function sampleAccessPasses(
  bootedAt: Date,
  catalogue: CatalogueSeed,
): { accessPasses: AccessPass[]; accessPassGrants: AccessPassGrant[] } {
  const passes = (
    [
      ["tester", 90],
      ["lapsed", -3],
      ["renewing", 5],
    ] as const
  ).map(([key, days]) => ({
    userId: sampleUserId(sampleMember(key).email),
    examCode: "CE",
    endsAt: new Date(bootedAt.getTime() + days * DAY).toISOString(),
  }));
  const exists = (code: string) => catalogue.exams.some((exam) => exam.code === code);
  return { accessPasses: passes.filter((pass) => exists(pass.examCode)), accessPassGrants: [] };
}

/**
 * Pure: the User id "Sign in as" gives an email. A sample User has no
 * Supabase User, so the id is made from the email, the same every time and on
 * every restart: a Member record keeps finding its User.
 */
export function sampleUserId(email: string): string {
  return stableUuid(`sample-user:${email.trim().toLowerCase()}`);
}
