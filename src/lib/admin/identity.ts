import "server-only";

import { cookies } from "next/headers";

import { env } from "@/env";
import { adminMode } from "@/lib/admin/mode";
import { staffEmailSchema } from "@/services/admin.schema";
import type { SignInIdentity } from "@/services/admin.types";
import { SAMPLE_USERS, type SampleUser } from "@/services/mock/staff";

// ─────────────────────────────────────────────────────────────────────────────
// Who is signed in to the Admin (CONVENTIONS §3). The Staff Guard asks this
// module for the signed-in User's email and name, then checks the staff list
// itself: nothing here grants access.
//
// Stage A has the sample arm only: the development-only "Sign in as" list sets
// the ayc_admin_sample cookie, which is honoured in "sample" mode and ignored
// otherwise. The sample Users stand in for Google accounts, so this arm owns
// them, as Google will own the real ones. Ticket 16 adds the Supabase arm.
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_IDENTITY_COOKIE = "ayc_admin_sample";

function sampleName(email: string): string | null {
  return SAMPLE_USERS.find((user) => user.email === email)?.name ?? null;
}

/**
 * The signed-in User (email trimmed and lowercased), or null when signed out.
 * A cookie that doesn't hold an email address is treated as signed out.
 */
export async function getIdentity(): Promise<SignInIdentity | null> {
  if (adminMode !== "sample") return null;
  const parsed = staffEmailSchema.safeParse((await cookies()).get(SAMPLE_IDENTITY_COOKIE)?.value);
  return parsed.success ? { email: parsed.data, name: sampleName(parsed.data) } : null;
}

/** The "Sign in as" list: the sample Users in sample mode, and nobody otherwise. */
export function listSampleUsers(): readonly SampleUser[] {
  return adminMode === "sample" ? SAMPLE_USERS : [];
}

/** Sample mode only: signs in as this email. Throws in any other mode. */
export async function startSampleSession(email: string): Promise<SignInIdentity> {
  if (adminMode !== "sample") {
    throw new Error("The sample sign-in exists only with sample data.");
  }
  const parsed = staffEmailSchema.parse(email);
  (await cookies()).set(SAMPLE_IDENTITY_COOKIE, parsed, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Sample mode never runs in production; the flag is here for the record.
    secure: env.NODE_ENV === "production",
  });
  return { email: parsed, name: sampleName(parsed) };
}

/** Signs out of the Admin. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SAMPLE_IDENTITY_COOKIE);
}
