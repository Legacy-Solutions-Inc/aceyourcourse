"use server";

import { redirect } from "next/navigation";

import { consentStatus } from "@/lib/member-app/consent";
import { checkConsent, requireGatedMember } from "@/lib/member-app/guard";
import { safeMemberAppNext } from "@/lib/member-app/safe-next";
import { paths } from "@/paths";
import { recordConsent } from "@/services/member";
import {
  BOTH_AGREEMENTS_REQUIRED,
  bothAgreementsSchema,
  shownVersionsSchema,
} from "@/services/member.schema";

/** What the consent screen shows after a refused send. */
export interface ConsentFormState {
  error: string | null;
}

/**
 * "Agree and continue" (spec, Phase 3 → Consent). The gate goes first, so
 * someone it doesn't let in gets no Member or consent record; consent itself
 * is what this action gives, so it's the one Member App action that doesn't
 * require it. The versions the screen showed must still be the current ones,
 * or the screen reloads with them. It refuses anything short of both
 * agreements, whatever the browser did with the button. It then adds the
 * agreement to the signed-in Member's own history, timed now, and continues
 * to `next`, sanitised to a Member App path. Who agrees comes from the
 * session alone, never from the form.
 */
export async function agreeAndContinue(
  _previous: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  const next = safeMemberAppNext(formData.get("next"));
  const member = await requireGatedMember(next);

  const { status, current } = await checkConsent(member.userId);
  const shown = shownVersionsSchema.parse({
    termsVersion: formData.get("termsVersion"),
    privacyVersion: formData.get("privacyVersion"),
  });
  // The screen showed other versions than the current ones, so the Member
  // hasn't seen what they'd be agreeing to.
  if (consentStatus(current, shown) !== "ok") {
    redirect(paths.memberApp.consent(next, { outdated: true }));
  }

  const agreed = bothAgreementsSchema.safeParse({
    terms: formData.get("terms"),
    privacy: formData.get("privacy"),
  });
  if (!agreed.success) return { error: BOTH_AGREEMENTS_REQUIRED };

  // Agreed already (a second click, or another tab): one record is enough.
  if (status !== "ok") await recordConsent(member.userId, shown);
  redirect(next);
}
