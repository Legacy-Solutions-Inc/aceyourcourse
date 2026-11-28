import {
  buildMemberDataExport,
  type MemberDataSource,
  memberDataFilename,
} from "@/lib/member-app/data-export";
import { isLastOwner, LAST_OWNER } from "@/lib/admin/staff-rules";
import { formatDateTime } from "@/lib/manila-time";
import {
  ALREADY_DELETED,
  isAccountDeletionConfirmed,
  isPrivacyRequestOverdue,
} from "@/lib/member-app/privacy-requests";
import { effectiveStatus, expiresAt, type Order, wasPaid } from "@/lib/payments/order-ledger";
import { passEntityPrefix } from "@/services/access-passes.core";
import { courseOwnershipEntityPrefix } from "@/services/course-ownership.core";
import {
  CONFIRMATION_WRONG,
  type DeleteAccountInput,
  deleteAccountInputSchema,
  invalidInput,
  type PrivacyRequestInput,
  privacyRequestIdSchema,
  privacyRequestInputSchema,
  roleRefusal,
} from "@/services/admin.schema";
import type {
  AdminError,
  AdminPrivacyRequest,
  AdminPrivacyRequestDetail,
  AdminResult,
  Invite,
  MemberDataFile,
  StaffActivity,
  StaffActor,
  StaffMember,
} from "@/services/admin.types";
import type { AuthAdmin } from "@/services/auth-admin.types";
import {
  activityRecord,
  formError,
  NOT_FOUND,
  type Refused,
  refused,
} from "@/services/content-editor.core";
import { ordinal } from "@/services/users.core";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Privacy Requests (Phase 3, tickets 18 and 19; stories 133,
// 133q and 133r; spec, Phase 3 planning decisions → Privacy Requests in the
// Admin), shared by both arms. Owners only: an Editor is refused every call,
// as the Staff Guard refuses them the screens.
//
// - The list: every Member's requests, soonest due first, each flagged when
//   it's still open after its due date in Manila. A request whose Member's
//   account is deleted stays, with no Member.
// - A data copy: "Download this Member's data" gives a JSON file of every
//   record kept about the Member (src/lib/member-app/data-export.ts), and
//   each download is logged in Staff Activity. The Owner emails it from the
//   support inbox: nothing is sent from here.
// - A deletion: "Delete this account", after typing the Member's email,
//   deletes their Member data, Access Passes and Course Ownerships (no
//   refund; Phase 5, ticket 07) in one step, then
//   their Supabase User through the auth admin. If Supabase fails, the
//   request stays open, saying the data is gone and the sign-in isn't: the
//   request keeps the opaque User id, so deleting again finishes it, and the
//   retry needs no typed email (there's no Member left to type). Once the
//   Supabase User is gone, the request is done. Someone on the staff list (an
//   active Staff User or an Invite, expired or not) is refused until they're
//   removed from Staff; the last Owner can never be removed, so never
//   deleted.
// - Orders (Phase 4, ticket 14; story 151y): deleting an account keeps its
//   Orders as tax records, with no account (the Orders admin shows them as
//   "Account deleted"), each with its refunds and Invoice Request. A payment
//   in progress (a Pending Order not yet past its 24 hours, as every screen
//   shows it) blocks the deletion until it's confirmed or expires, so no
//   payment lands on an account that's gone; one that still does is the
//   ledger's (settleOrder: Paid, granting nothing). The confirmation counts
//   the paid Orders kept, and a data copy holds the Member's Orders.
// - "Mark done": either type, with the date and who, for a request carried
//   out another way (a deletion withdrawn, or one from Staff that can't be
//   carried out); deleting an account marks its request done itself. A
//   deletion that's half done can't be: delete again to finish it. A server
//   without the Supabase secret key deletes nothing at all.
//
// Staff Activity never keeps a deleted Member's email or name: the export,
// deletion and "Mark done" records name the request and an opaque User id
// only, and deleting the account takes the email out of the earlier records
// about it (a grant, a force sign-out).
// ─────────────────────────────────────────────────────────────────────────────

const SEE_FORBIDDEN = "ONLY AN OWNER CAN SEE PRIVACY REQUESTS";
const ACT_FORBIDDEN = "ONLY AN OWNER CAN CARRY OUT PRIVACY REQUESTS";

export const STAFF_FIRST =
  "This email is on the staff list. Remove them from Staff first, in Settings, then delete the account.";
export const LAST_OWNER_DELETION = `This is the only Owner. ${LAST_OWNER} Their account can’t be deleted.`;
export const SIGN_IN_NOT_DELETED =
  "The Member’s data is deleted, but their sign-in couldn’t be deleted just now. Delete again to finish. The request stays open until then.";
export const NOT_A_DATA_COPY = "Only a data-copy request has a file to download.";
export const NOT_A_DELETION = "Only a deletion request deletes an account.";
export const REQUEST_DONE = "This request is already done.";
export const AUTH_ADMIN_MISSING =
  "This server can’t delete sign-ins (its Supabase secret key isn’t set), so nothing was deleted.";
export const FINISH_DELETING =
  "Finish deleting the account first: its sign-in is still there. Delete again to finish.";

/** Pure: why an account with a payment in progress can't be deleted, and until when, in Manila. */
const paymentInProgress = (until: string) =>
  `This Member has a payment in progress. Try again after it’s confirmed or expires (by ${formatDateTime(until)}).`;

/** A Privacy Request with its Member, as an arm reads it: everything the list shows but the flag. */
export type StoredPrivacyRequest = Omit<AdminPrivacyRequest, "overdue">;

/** A Privacy Request as carrying it out reads it, with what that depends on now. */
export interface PrivacyRequestRecord extends StoredPrivacyRequest {
  /**
   * The User id a deletion removed the Member data of, or null before one
   * has. While the request is open, its Supabase User may still be there.
   */
  deletedUserId: string | null;
  /** The active Staff Users and the Invites: an email on either can't be deleted. */
  staff: Pick<StaffMember, "email" | "role">[];
  invites: Pick<Invite, "email">[];
  /** Whether the Member's email is on the Beta Tester list (false with no Member). */
  betaTester: boolean;
  /** The Member's Orders, Test Orders too (none with no Member): what deleting depends on (ticket 14). */
  orders: Pick<Order, "status" | "createdAt">[];
}

/** What carrying out a request writes, all as one step. */
export interface PrivacyWrite {
  /**
   * Deletes every record of this User id's Member and their Access Passes,
   * empties their requests' and Orders' Member (the Orders stay, ticket 14),
   * and keeps the id on this request; takes the email out of the earlier
   * Staff Activity about the account.
   */
  deleteMemberOf: string | null;
  /** Marks the request done. */
  done: { at: string; by: StaffActivity["actor"] } | null;
  activity: StaffActivity | null;
}

/** How an arm reads and writes the Privacy Requests. */
export interface PrivacyRequestsStore {
  /** Every Member's Privacy Requests, open and done, in any order. */
  readRequests(): Promise<StoredPrivacyRequest[]>;
  /**
   * Runs `work` on the request as it is now, then writes what it gives, all
   * as one step: two calls on the same request never interleave, and a write
   * that fails partway leaves everything as it was. Gives work's result, or
   * null for an id no request has.
   */
  withRequest<T>(
    id: string,
    work: (record: PrivacyRequestRecord) => { write: PrivacyWrite | null; result: T },
  ): Promise<T | null>;
  /** Every record kept about a Member, for their data copy, or null when they're no Member. */
  readMemberData(userId: string): Promise<MemberDataSource | null>;
}

/** Pure: the soonest due first; requests due the same day, oldest first. */
const soonestDue = (a: StoredPrivacyRequest, b: StoredPrivacyRequest) =>
  ordinal(a.dueOn, b.dueOn) || ordinal(a.requestedAt, b.requestedAt) || ordinal(a.id, b.id);

/** Pure: a request marked done by `actor` at `now`: when, and who, as they are now. */
const doneBy = (actor: StaffActor, now: Date): NonNullable<PrivacyWrite["done"]> => ({
  at: now.toISOString(),
  by: { email: actor.email, name: actor.name },
});

/** Pure: a request as it is once marked done. */
const asDone = <R extends StoredPrivacyRequest>(
  record: R,
  done: NonNullable<PrivacyWrite["done"]>,
) => ({
  ...record,
  status: "done" as const,
  doneAt: done.at,
  doneBy: done.by,
});

/** Pure: a request as the list shows it at `now`. */
function listed(record: StoredPrivacyRequest, now: Date): AdminPrivacyRequest {
  const { id, type, status, requestedAt, dueOn, member, doneAt, doneBy } = record;
  return {
    id,
    type,
    status,
    requestedAt,
    dueOn,
    overdue: isPrivacyRequestOverdue(record, now),
    member,
    doneAt,
    doneBy,
  };
}

/**
 * Pure: why the account of a Member with this email can't be deleted, or
 * null when it can. The last Owner first: they can't be removed from Staff
 * either, so "remove them first" would lead nowhere.
 */
export function deletionBlock(
  { staff, invites }: Pick<PrivacyRequestRecord, "staff" | "invites">,
  email: string,
): string | null {
  const wanted = email.toLowerCase();
  if (isLastOwner(staff, wanted)) return LAST_OWNER_DELETION;
  const listedAs = [...staff, ...invites].some((entry) => entry.email === wanted);
  return listedAs ? STAFF_FIRST : null;
}

/**
 * Pure: why a Member with these Orders can't have their account deleted at
 * `now`, or null when they can (ticket 14): a payment is in progress while
 * any Order shows Pending (not yet past its 24 hours), until the last of
 * them expires.
 */
function paymentBlock(
  orders: readonly Pick<Order, "status" | "createdAt">[],
  now: Date,
): string | null {
  const expiries = orders
    .filter((order) => effectiveStatus(order, now) === "pending")
    .map(({ createdAt }) => expiresAt(createdAt));
  // ISO times in UTC sort as text: the last is the latest.
  const last = expiries.sort().at(-1);
  return last ? paymentInProgress(last) : null;
}

/** Pure: why this request's account can't be deleted at `now`, or null when it can (or it's gone). */
function blockOf(record: PrivacyRequestRecord, now: Date): string | null {
  if (!record.member) return null;
  return deletionBlock(record, record.member.email) ?? paymentBlock(record.orders, now);
}

/** The keys in Staff Activity's values that hold a Member's personal data. */
const PERSONAL_KEYS = ["email", "name"] as const;

/** Pure: a Staff Activity value without the Member's email and name. */
function withoutPersonal(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const kept = { ...(value as Record<string, unknown>) };
  for (const key of PERSONAL_KEYS) delete kept[key];
  return kept;
}

/**
 * Pure: an earlier Staff Activity record about a deleted Member's account (a
 * force sign-out, entity "member"; a grant, extension or end of one of
 * their Access Passes, entity "access-pass"; or a Course bought, given,
 * removed or refunded, entity "course-ownership", Phase 5), without their
 * email or name; or null for a record that isn't about it, which stays as
 * it is.
 */
export function withoutDeletedMember(
  activity: StaffActivity,
  userId: string,
): StaffActivity | null {
  const about =
    (activity.entity === "member" && activity.entityId === userId) ||
    (activity.entity === "access-pass" && activity.entityId.startsWith(passEntityPrefix(userId))) ||
    (activity.entity === "course-ownership" &&
      activity.entityId.startsWith(courseOwnershipEntityPrefix(userId)));
  if (!about) return null;
  return {
    ...activity,
    before: withoutPersonal(activity.before),
    after: withoutPersonal(activity.after),
  };
}

const saved = <T>(value: T): AdminResult<T> => ({ ok: true, value, tags: [] });

/** The Admin seam's Privacy Request calls, over an arm's store. */
export function privacyRequestCalls(store: PrivacyRequestsStore) {
  /** The Owner check and the request id: the refusal, or null to go on. */
  function checked(actor: StaffActor, requestId: string, message = ACT_FORBIDDEN) {
    const role = roleRefusal(actor, "owner", message);
    if (role) return refused(role);
    return privacyRequestIdSchema.safeParse(requestId).success ? null : NOT_FOUND;
  }

  /** Reads a request as it is now, changing nothing. */
  const read = (id: string) => store.withRequest(id, (record) => ({ write: null, result: record }));

  const refuse = (error: AdminError) => ({ write: null, result: refused(error) });

  async function listPrivacyRequests(
    actor: StaffActor,
  ): Promise<AdminResult<AdminPrivacyRequest[]>> {
    const refusal = roleRefusal(actor, "owner", SEE_FORBIDDEN);
    if (refusal) return refused(refusal);
    const now = new Date();
    const requests = (await store.readRequests()).sort(soonestDue);
    return saved(requests.map((request) => listed(request, now)));
  }

  async function getPrivacyRequestForAdmin(
    actor: StaffActor,
    requestId: string,
  ): Promise<AdminResult<AdminPrivacyRequestDetail>> {
    const refusal = checked(actor, requestId, SEE_FORBIDDEN);
    if (refusal) return refusal;
    const record = await read(requestId);
    if (!record) return NOT_FOUND;
    const now = new Date();
    return saved({
      ...listed(record, now),
      deletionBlocked: blockOf(record, now),
      deletionUnfinished: record.status === "open" && record.deletedUserId !== null,
      betaTester: record.betaTester,
      paidOrders: record.orders.filter(({ status }) => wasPaid(status)).length,
    });
  }

  async function exportMemberData(
    actor: StaffActor,
    requestId: string,
  ): Promise<AdminResult<MemberDataFile>> {
    const refusal = checked(actor, requestId);
    if (refusal) return refusal;
    const found = await read(requestId);
    if (!found) return NOT_FOUND;
    if (found.type !== "data-copy") return refused(formError(NOT_A_DATA_COPY));
    const source = found.member ? await store.readMemberData(found.member.userId) : null;
    if (!source) return refused(formError(ALREADY_DELETED));

    const now = new Date();
    const { userId } = source.member;
    // Logged only once the file is made, and only while the account is still the one read.
    const logged = await store.withRequest(requestId, (record) =>
      record.member?.userId === userId
        ? {
            write: {
              deleteMemberOf: null,
              done: null,
              activity: activityRecord(actor, now, "privacy-request", requestId, "exported", null, {
                type: "data-copy",
                userId,
              }),
            },
            result: true,
          }
        : { write: null, result: false },
    );
    if (!logged) return refused(formError(ALREADY_DELETED));
    return saved({
      filename: memberDataFilename(userId, now),
      data: buildMemberDataExport(source, now),
    });
  }

  async function deleteMemberAccount(
    actor: StaffActor,
    sent: DeleteAccountInput,
    authAdmin: AuthAdmin,
  ): Promise<AdminResult<AdminPrivacyRequest>> {
    const role = roleRefusal(actor, "owner", ACT_FORBIDDEN);
    if (role) return refused(role);
    const parsed = deleteAccountInputSchema.safeParse(sent);
    if (!parsed.success) return refused(invalidInput(parsed.error));
    const { requestId, confirmation } = parsed.data;
    if (!privacyRequestIdSchema.safeParse(requestId).success) return NOT_FOUND;
    // A server that can't delete Supabase Users deletes no Member data either.
    if (!authAdmin.configured) return refused(formError(AUTH_ADMIN_MISSING));

    // 1. The Member data, in one step.
    const now = new Date();
    const step = await store.withRequest<Refused | { ok: true; userId: string }>(
      requestId,
      (record) => {
        if (record.type !== "deletion") return refuse(formError(NOT_A_DELETION));
        if (record.status === "done") return refuse(formError(REQUEST_DONE));
        const userId = record.member?.userId ?? record.deletedUserId;
        if (!userId) return refuse(formError(ALREADY_DELETED));
        // A retry finds no Member: they were confirmed, and checked, the first time.
        if (record.member) {
          const blocked = blockOf(record, now);
          if (blocked) return refuse(formError(blocked));
          if (!isAccountDeletionConfirmed(confirmation, record.member.email)) {
            return refuse({ kind: "invalid", fieldErrors: { confirmation: [CONFIRMATION_WRONG] } });
          }
        }
        return {
          write: {
            deleteMemberOf: userId,
            done: null,
            activity: activityRecord(
              actor,
              now,
              "privacy-request",
              requestId,
              "account-deleted",
              null,
              { userId },
            ),
          },
          result: { ok: true, userId },
        };
      },
    );
    if (!step) return NOT_FOUND;
    if (!step.ok) return step;

    // 2. The Supabase User. Should it fail, the request stays open to retry.
    const deleted = await authAdmin.deleteUser(step.userId);
    if (!deleted.ok) {
      console.error("A Supabase User wasn't deleted", { requestId, reason: deleted.message });
      return refused(formError(SIGN_IN_NOT_DELETED));
    }

    // 3. Done. Its record is the deletion's (step 1): Staff Activity keeps one
    // per call, and the request keeps the date and who itself.
    const finished = await store.withRequest(requestId, (record) => {
      if (record.status === "done") return { write: null, result: record };
      const done = doneBy(actor, now);
      return {
        write: { deleteMemberOf: null, done, activity: null },
        result: asDone(record, done),
      };
    });
    if (!finished) return NOT_FOUND;
    return saved(listed(finished, now));
  }

  async function markPrivacyRequestDone(
    actor: StaffActor,
    sent: PrivacyRequestInput,
  ): Promise<AdminResult<AdminPrivacyRequest>> {
    const role = roleRefusal(actor, "owner", ACT_FORBIDDEN);
    if (role) return refused(role);
    const parsed = privacyRequestInputSchema.safeParse(sent);
    if (!parsed.success) return refused(invalidInput(parsed.error));
    const { requestId } = parsed.data;
    if (!privacyRequestIdSchema.safeParse(requestId).success) return NOT_FOUND;

    const now = new Date();
    const result = await store.withRequest(requestId, (record) => {
      if (record.status === "done") return refuse(formError(REQUEST_DONE));
      if (record.type === "deletion" && record.deletedUserId !== null) {
        return refuse(formError(FINISH_DELETING));
      }
      const done = doneBy(actor, now);
      return {
        write: {
          deleteMemberOf: null,
          done,
          activity: activityRecord(
            actor,
            now,
            "privacy-request",
            requestId,
            "mark-done",
            { status: "open" },
            { status: "done", doneAt: done.at },
          ),
        },
        result: saved(listed(asDone(record, done), now)),
      };
    });
    return result ?? NOT_FOUND;
  }

  return {
    listPrivacyRequests,
    getPrivacyRequestForAdmin,
    exportMemberData,
    deleteMemberAccount,
    markPrivacyRequestDone,
  };
}
