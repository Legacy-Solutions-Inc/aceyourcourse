"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/lib/member-app/guard";
import { paths } from "@/paths";
import { requestPrivacy } from "@/services/member";
import { DELETION_NOT_CONFIRMED, deletionRequestFormSchema } from "@/services/member.schema";

// Account's Privacy Requests (Phase 3, ticket 18; spec, Phase 3 → Privacy
// Requests; stories 111 and 112). Each runs the Member App's server checks
// first (the gate, consent, then the Active Device), and asks only for the
// signed-in Member: who they are comes from the session alone, never from the
// form. Asking again while one of the type is open makes nothing. Owners carry
// requests out by hand (ticket 19); nothing is emailed.

/** What "Delete my account" shows after a refused send. */
export interface DeletionFormState {
  error: string | null;
}

/** "Request a copy of my data": Account then shows it pending. */
export async function requestDataCopy(): Promise<void> {
  const member = await requireMember(paths.memberApp.account);
  await requestPrivacy(member.userId, "data-copy");
  revalidatePath(paths.memberApp.account);
}

/**
 * "Delete my account", once the Member has read the warning and typed the
 * confirmation: refused, asking for nothing, without it. The Member stays
 * signed in, and Account shows the deletion pending.
 */
export async function requestDeletion(
  _previous: DeletionFormState,
  formData: FormData,
): Promise<DeletionFormState> {
  const member = await requireMember(paths.memberApp.account);
  const sent = deletionRequestFormSchema.safeParse({ confirmation: formData.get("confirmation") });
  if (!sent.success) return { error: DELETION_NOT_CONFIRMED };

  await requestPrivacy(member.userId, "deletion");
  revalidatePath(paths.memberApp.account);
  return { error: null };
}
