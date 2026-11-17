import {
  type BetaTesterInput,
  betaTesterInputSchema,
  invalidInput,
  roleRefusal,
} from "@/services/admin.schema";
import type { AdminError, AdminResult, BetaTester, StaffActor } from "@/services/admin.types";
import { getSampleStore } from "@/services/mock/sample-store";

// The sample arm of the Admin seam's Beta Testers (spec, Phase 3 → The beta
// gate): the Google emails an Owner lets into the Member App while its switch
// is off. Like the staff list, emails are compared case-insensitively, so they
// are trimmed and lowercased on the way in. Each write checks the actor's
// Staff Role, validates its input, then appends one Staff Activity record.
// None touches the Catalogue, so none returns a cache tag.

const FORBIDDEN = "ONLY AN OWNER CAN MANAGE BETA TESTERS";
export const ALREADY_A_BETA_TESTER = "This email is already a Beta Tester.";

const saved = <T>(value: T): AdminResult<T> => ({
  ok: true,
  value: structuredClone(value),
  tags: [],
});

/** The Owner-only check and the email's validation, shared by both writes. */
function check(
  actor: StaffActor,
  input: unknown,
): { ok: true; email: string } | { ok: false; error: AdminError } {
  const refusal = roleRefusal(actor, "owner", FORBIDDEN);
  if (refusal) return { ok: false, error: refusal };
  const parsed = betaTesterInputSchema.safeParse(input);
  return parsed.success
    ? { ok: true, email: parsed.data.email }
    : { ok: false, error: invalidInput(parsed.error) };
}

function record(
  actor: StaffActor,
  now: Date,
  change: { action: "add" | "remove"; before: BetaTester | null; after: BetaTester | null },
) {
  const store = getSampleStore();
  const tester = change.after ?? change.before;
  store.staffActivity = [
    ...store.staffActivity,
    {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      actor: { email: actor.email, name: actor.name },
      entity: "beta-tester",
      entityId: tester?.email ?? "",
      action: change.action,
      before: structuredClone(change.before),
      after: structuredClone(change.after),
    },
  ];
}

export async function listBetaTesters(actor: StaffActor): Promise<AdminResult<BetaTester[]>> {
  const refusal = roleRefusal(actor, "owner", FORBIDDEN);
  if (refusal) return { ok: false, error: refusal };
  return saved(getSampleStore().betaTesters);
}

export async function addBetaTester(
  actor: StaffActor,
  input: BetaTesterInput,
): Promise<AdminResult<BetaTester>> {
  const checked = check(actor, input);
  if (!checked.ok) return checked;
  const { email } = checked;

  const store = getSampleStore();
  if (store.betaTesters.some((tester) => tester.email === email)) {
    return {
      ok: false,
      error: { kind: "invalid", fieldErrors: { email: [ALREADY_A_BETA_TESTER] } },
    };
  }

  const now = new Date();
  const tester: BetaTester = {
    email,
    addedAt: now.toISOString(),
    addedBy: { email: actor.email, name: actor.name },
  };
  store.betaTesters = [...store.betaTesters, tester];
  record(actor, now, { action: "add", before: null, after: tester });
  return saved(tester);
}

export async function removeBetaTester(
  actor: StaffActor,
  email: string,
): Promise<AdminResult<BetaTester>> {
  const checked = check(actor, { email });
  if (!checked.ok) return checked;

  const store = getSampleStore();
  const tester = store.betaTesters.find((candidate) => candidate.email === checked.email);
  if (!tester) return { ok: false, error: { kind: "not-found" } };

  // Their Member record, if they have one, stays: only the gate changes.
  store.betaTesters = store.betaTesters.filter((candidate) => candidate !== tester);
  record(actor, new Date(), { action: "remove", before: tester, after: null });
  return saved(tester);
}
