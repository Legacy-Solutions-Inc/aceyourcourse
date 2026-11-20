import type { StaffMember } from "@/services/admin.types";

// The staff list's one rule about Owners (spec, Phase 2 → Staff; ticket 19),
// pure, shared by the Staff screen's writes (src/services/mock/admin/staff.ts,
// which the database arm runs too) and deleting an account
// (src/services/privacy-requests.core.ts): there is always an Owner.

export const LAST_OWNER = "There must always be at least one Owner.";

/**
 * Pure: whether `email` is the only Owner on the staff list: the one Staff
 * User who can never stop being an Owner, be removed, or have their account
 * deleted.
 */
export function isLastOwner(
  staff: readonly Pick<StaffMember, "email" | "role">[],
  email: string,
): boolean {
  const owners = staff.filter((candidate) => candidate.role === "owner");
  return owners.length === 1 && owners[0]?.email === email;
}
