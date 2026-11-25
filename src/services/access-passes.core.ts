import { endedNow, passWithDays } from "@/lib/member-app/access-pass";
import {
  type EndAccessInput,
  endAccessInputSchema,
  type ExtendAccessInput,
  extendAccessInputSchema,
  type GrantAccessInput,
  grantAccessInputSchema,
  invalidInput,
  memberIdSchema,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AccessPassChange,
  AdminError,
  AdminResult,
  StaffActivity,
  StaffActor,
} from "@/services/admin.types";
import type { AccessPass, AccessPassGrant } from "@/services/content.types";
import { activityRecord, formError, NOT_FOUND, refused } from "@/services/content-editor.core";
import { grantedTargetExam, type TargetExamRecord } from "@/services/member.rules";
import type { Member, MemberNotice, NoticeKind } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Access Pass actions (Phase 3, ticket 17; stories 131, 133h
// and 133j; spec, Phase 3 planning decisions → Grants and ending access,
// In-app notices, Target Exams), shared by both arms. Owners only, from a
// Member's detail page, each with a reason:
//
// - Grant: an Exam, and 30, 90, 180 or 365 days or a custom 1–365. A grant
//   for an Exam the Member doesn't have adds it to their Target Exams, or
//   brings back one they removed.
// - Extend: 3, 7, 14 or 30 days on a pass the Member holds.
//   Both add the days from the pass's end, or from now when it has ended
//   (src/lib/member-app/access-pass.ts), and keep them as their own history
//   row (access_pass_grants), so Phase 4 can tell granted days from paid ones.
// - End access now: sets the end to now, keeping every progress record and
//   the history. A pass that has already ended has nothing to end: refused,
//   recording nothing. From Phase 4 this may end only the granted days, never
//   paid ones (refunds handle those); there are no paid days yet.
//
// Each one writes the pass, its history row, the Target Exam, an in-app
// notice for the Member (no email) and its Staff Activity, with the end before
// and after, all or nothing.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = "ONLY AN OWNER CAN GRANT, EXTEND OR END ACCESS";

export const NOT_AN_EXAM = "That isn’t an Exam in the catalogue. Pick one from the list.";
export const noPassToExtend = (examCode: string) =>
  `This Member has no ${examCode} Access Pass to extend. Grant one instead.`;
export const noPassToEnd = (examCode: string) =>
  `This Member has no ${examCode} Access Pass to end. Nothing was changed.`;
export const alreadyEnded = (examCode: string) =>
  `This Member’s ${examCode} Access Pass has already ended, so there’s nothing to end. Nothing was changed.`;

/** A Member's Access Pass for one Exam as it is now, with what a change to it reads. */
export interface PassHolding {
  member: Member;
  /** Whether the Exam is in the catalogue now. */
  examExists: boolean;
  /** The Member's pass for the Exam, or null when they hold none. */
  pass: AccessPass | null;
  /** The Member's Target Exam records, removed ones too, in the order first added. */
  targetExams: TargetExamRecord[];
}

/** What a change writes, all or nothing. */
export interface PassWrite {
  /** The pass's new end (ISO); the pass is made when the Member held none. */
  endsAt: string;
  /** The days a grant or extension added, as their history row. */
  grant: AccessPassGrant | null;
  /** The Target Exam record a grant added or brought back, replacing any by its Exam. */
  targetExam: TargetExamRecord | null;
  notice: MemberNotice;
  activity: StaffActivity;
}

/** How an arm reads and writes a Member's Access Passes. */
export interface AccessPassStore {
  /**
   * Runs `work` on the Member's Access Pass for an Exam as it is now, then
   * writes what it gives, all as one step: two changes to the same Member
   * never interleave, and a write that fails partway leaves everything as it
   * was. Gives work's result, or null for a User id no Member has.
   */
  withPass<T>(
    userId: string,
    examCode: string,
    work: (holding: PassHolding) => { write: PassWrite | null; result: T },
  ): Promise<T | null>;
}

const saved = (value: AccessPassChange): AdminResult<AccessPassChange> => ({
  ok: true,
  value,
  tags: [],
});

/** The refusal of an Exam that isn't in the catalogue, on the Exam field. */
const NO_SUCH_EXAM: AdminError = { kind: "invalid", fieldErrors: { examCode: [NOT_AN_EXAM] } };

/** Pure: how Staff Activity's ids for a Member's passes begin: their User id. */
export const passEntityPrefix = (userId: string) => `${userId}/`;

/** Pure: how Staff Activity names a Member's pass for an Exam. */
export const passEntityId = (userId: string, examCode: string) =>
  `${passEntityPrefix(userId)}${examCode}`;

/** Pure: the notice a change leaves the Member. */
export const noticeOf = (
  userId: string,
  examCode: string,
  kind: NoticeKind,
  endsAt: string,
  now: Date,
): MemberNotice => ({
  id: crypto.randomUUID(),
  userId,
  examCode,
  kind,
  endsAt,
  createdAt: now.toISOString(),
  dismissedAt: null,
});

/** The Admin seam's Access Pass actions, over an arm's store. */
export function accessPassCalls(store: AccessPassStore) {
  /**
   * The checks every action makes first: an Owner, an input the schema
   * takes, and a User id. Gives the refusal, or the parsed input.
   */
  function checked<I extends { userId: string }>(
    actor: StaffActor,
    parse: () =>
      { success: true; data: I } | { success: false; error: Parameters<typeof invalidInput>[0] },
  ): { refusal: AdminResult<never> } | { input: I } {
    const role = roleRefusal(actor, "owner", FORBIDDEN);
    if (role) return { refusal: refused(role) };
    const parsed = parse();
    if (!parsed.success) return { refusal: refused(invalidInput(parsed.error)) };
    if (!memberIdSchema.safeParse(parsed.data.userId).success) return { refusal: NOT_FOUND };
    return { input: parsed.data };
  }

  /** Runs a change on the Member's pass; not-found for a User id no Member has. */
  async function change(
    userId: string,
    examCode: string,
    work: (holding: PassHolding) => {
      write: PassWrite | null;
      result: AdminResult<AccessPassChange>;
    },
  ): Promise<AdminResult<AccessPassChange>> {
    return (await store.withPass(userId, examCode, work)) ?? NOT_FOUND;
  }

  const refuse = (error: AdminError) => ({ write: null, result: refused(error) });

  /** The days a grant or extension adds, written with its history row, notice and Staff Activity. */
  function addDays(
    actor: StaffActor,
    holding: PassHolding,
    {
      userId,
      examCode,
      days,
      reason,
    }: { userId: string; examCode: string; days: number; reason: string },
    kind: "granted" | "extended",
    now: Date,
  ) {
    const endsBefore = holding.pass?.endsAt ?? null;
    const { startsAt, endsAt } = passWithDays(endsBefore, days, now);
    const added = kind === "granted" ? grantedTargetExam(holding.targetExams, examCode, now) : null;
    const targetExam = added?.change ?? null;
    const { email } = holding.member;
    const write: PassWrite = {
      endsAt,
      grant: {
        userId,
        examCode,
        days,
        startsAt,
        endsAt,
        reason,
        grantedBy: { email: actor.email, name: actor.name },
        grantedAt: now.toISOString(),
        orderId: null,
      },
      targetExam: added?.record ?? null,
      notice: noticeOf(userId, examCode, kind, endsAt, now),
      activity: activityRecord(
        actor,
        now,
        "access-pass",
        passEntityId(userId, examCode),
        kind === "granted" ? "grant-access" : "extend-access",
        { email, examCode, endsAt: endsBefore },
        kind === "granted"
          ? { email, examCode, endsAt, days, reason, targetExam }
          : { email, examCode, endsAt, days, reason },
      ),
    };
    return {
      write,
      result: saved({ userId, examCode, endsBefore, endsAt, days, reason, targetExam }),
    };
  }

  async function grantAccess(
    actor: StaffActor,
    sent: GrantAccessInput,
  ): Promise<AdminResult<AccessPassChange>> {
    const checks = checked(actor, () => grantAccessInputSchema.safeParse(sent));
    if ("refusal" in checks) return checks.refusal;
    const { input } = checks;
    const now = new Date();
    return change(input.userId, input.examCode, (holding) =>
      holding.examExists ? addDays(actor, holding, input, "granted", now) : refuse(NO_SUCH_EXAM),
    );
  }

  async function extendAccess(
    actor: StaffActor,
    sent: ExtendAccessInput,
  ): Promise<AdminResult<AccessPassChange>> {
    const checks = checked(actor, () => extendAccessInputSchema.safeParse(sent));
    if ("refusal" in checks) return checks.refusal;
    const { input } = checks;
    const now = new Date();
    return change(input.userId, input.examCode, (holding) => {
      if (!holding.examExists) return refuse(NO_SUCH_EXAM);
      if (!holding.pass) return refuse(formError(noPassToExtend(input.examCode)));
      return addDays(actor, holding, input, "extended", now);
    });
  }

  async function endAccess(
    actor: StaffActor,
    sent: EndAccessInput,
  ): Promise<AdminResult<AccessPassChange>> {
    const checks = checked(actor, () => endAccessInputSchema.safeParse(sent));
    if ("refusal" in checks) return checks.refusal;
    const { userId, examCode, reason } = checks.input;
    const now = new Date();
    return change(userId, examCode, ({ member, examExists, pass }) => {
      if (!examExists) return refuse(NO_SUCH_EXAM);
      if (!pass) return refuse(formError(noPassToEnd(examCode)));
      const endsAt = endedNow(pass.endsAt, now);
      if (endsAt === null) return refuse(formError(alreadyEnded(examCode)));
      const { email } = member;
      return {
        write: {
          endsAt,
          grant: null,
          targetExam: null,
          notice: noticeOf(userId, examCode, "ended", endsAt, now),
          activity: activityRecord(
            actor,
            now,
            "access-pass",
            passEntityId(userId, examCode),
            "end-access",
            { email, examCode, endsAt: pass.endsAt },
            { email, examCode, endsAt, reason },
          ),
        },
        result: saved({
          userId,
          examCode,
          endsBefore: pass.endsAt,
          endsAt,
          days: null,
          reason,
          targetExam: null,
        }),
      };
    });
  }

  return { grantAccess, extendAccess, endAccess };
}
