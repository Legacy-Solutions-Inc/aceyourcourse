import { newestOrderFirst } from "@/lib/admin/orders-list";
import { USERS_PAGE_SIZE } from "@/lib/admin/users-list";
import { isPassActive } from "@/lib/member-app/access";
import { endGrantedDays } from "@/lib/payments/order-ledger";
import {
  type ForceSignOutInput,
  forceSignOutInputSchema,
  invalidInput,
  memberIdSchema,
  roleRefusal,
  userListQuerySchema,
} from "@/services/admin.schema";
import type {
  AccessPassRecord,
  AdminAccessPass,
  AdminMemberDetail,
  AdminResult,
  AdminUserList,
  AdminUserRow,
  ForcedSignOut,
  StaffActivity,
  StaffActor,
  UserFilter,
  UserListQuery,
  UserRole,
} from "@/services/admin.types";
import { activityRecord, formError, NOT_FOUND, refused } from "@/services/content-editor.core";
import type { MemberService } from "@/services/member";
import { type AdminOrderRecord, adminOrderOf } from "@/services/orders-admin.core";
import type { ActiveDevice, ConsentRecord, Member } from "@/services/member.types";

// ─────────────────────────────────────────────────────────────────────────────
// The Admin seam's Users (Phase 3, ticket 16; stories 129, 130 and 132;
// BUILD-MAP §3.10), shared by both arms. Owners only: an Editor is refused
// every call here, as the Staff Guard refuses them the screens.
//
// - The list: the Members, newest first, a page at a time, searched by name
//   or email and filtered by their Access Passes, Staff Role or the Beta
//   Tester list, each read now. Each arm finds the page its own way (the
//   sample arm with matchesUserQuery below, the database in SQL).
// - A Member's detail: their records, read fresh, with every Order they made
//   (Phase 4, ticket 07), newest first, and what "End access now" would do
//   to each Access Pass (ticket 10). What the Member App itself
//   reads (Target Exams, the Active Device and its switch log, progress) comes
//   from the arm's Member seam, which reads only that Member's own records.
// - Force sign-out: clears the Member's Active Device, so the device's next
//   Member App request is "replaced" and shows "Session ended". It needs a
//   reason, which Staff Activity keeps with the device it cleared. A Member
//   with no Active Device has nothing to sign out: that's refused, and
//   records nothing.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN = "ONLY AN OWNER CAN SEE AND MANAGE USERS";

export const NO_ACTIVE_DEVICE =
  "This Member has no Active Device, so there’s nothing to sign out. The page is up to date.";

/** What a Member's detail page reads that the Member seam doesn't: who they are to the Admin. */
export interface MemberRecords {
  member: Member;
  role: UserRole;
  betaTester: boolean;
  /** Their Access Passes by Exam code, each with its grants, oldest first. */
  accessPasses: AccessPassRecord[];
  /** Their agreements, oldest first. */
  consents: ConsentRecord[];
  /** Every Order they made, in any order, each with its Invoice Request and refunds (Phase 4, tickets 07–09). */
  orders: AdminOrderRecord[];
}

/** One page of the Members a query matches, newest first, and the counts. */
export interface MemberPage {
  rows: AdminUserRow[];
  matching: number;
  total: number;
}

/** How an arm reads and writes the Users. */
export interface UsersStore {
  /** The Members matching the search and filter at `now`: the `limit` after the first `offset`. */
  listMembers(
    query: Pick<UserListQuery, "q" | "filter">,
    page: { offset: number; limit: number },
    now: Date,
  ): Promise<MemberPage>;
  /** A Member's records, or null for a User id no Member has. */
  readMember(userId: string): Promise<MemberRecords | null>;
  /**
   * Clears the Member's Active Device and, when they had one, records the
   * Staff Activity `activity` makes of it, both or neither. Gives the Member
   * and the device cleared (null when there was none), or null for a User id
   * no Member has.
   */
  clearActiveDevice(
    userId: string,
    activity: (member: Member, device: ActiveDevice) => StaffActivity,
  ): Promise<{ member: Member; device: ActiveDevice | null } | null>;
}

/** What the Users calls read through the arm's Member seam: only the Member's own records. */
export type MemberReads = Pick<
  MemberService,
  "listTargetExams" | "getActiveDevice" | "listDeviceSwitches" | "getProgress"
>;

/** Pure: which of the Access Pass filters a Member's passes fall in at `now`. Ending now is ended. */
export function passFilterOf(
  passes: readonly { endsAt: string }[],
  now: Date,
): "active" | "expired" | "none" {
  if (passes.length === 0) return "none";
  return passes.some(({ endsAt }) => isPassActive(endsAt, now)) ? "active" : "expired";
}

/** Pure: whether a Member's name or email holds the search, ignoring case. */
function matchesSearch({ name, email }: AdminUserRow, q: string | null): boolean {
  if (q === null) return true;
  const wanted = q.toLowerCase();
  return (name ?? "").toLowerCase().includes(wanted) || email.toLowerCase().includes(wanted);
}

/** Pure: whether a Member falls in a filter at `now`. */
function matchesFilter(row: AdminUserRow, filter: UserFilter, now: Date): boolean {
  switch (filter) {
    case "all":
      return true;
    case "staff":
      return row.role !== "member";
    case "beta":
      return row.betaTester;
    default:
      return passFilterOf(row.accessPasses, now) === filter;
  }
}

/** Pure: whether a Member matches the Users list's search and filter at `now`. */
export const matchesUserQuery = (
  row: AdminUserRow,
  { q, filter }: Pick<UserListQuery, "q" | "filter">,
  now: Date,
) => matchesSearch(row, q) && matchesFilter(row, filter, now);

/** Pure: plain character order, as Postgres orders a uuid's hex digits. */
export const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Pure: newest Member first; Members who joined together by User id, as the database orders them. */
export const newestFirst = (a: AdminUserRow, b: AdminUserRow) =>
  ordinal(b.joinedAt, a.joinedAt) || ordinal(a.userId, b.userId);

const saved = <T>(value: T): AdminResult<T> => ({ ok: true, value, tags: [] });

/** Pure: newest first, without the Member's own id, which the page already has. */
const newestWithoutId = <T extends { userId: string }>(records: readonly T[]) =>
  records.map(({ userId: _, ...record }) => record).reverse();

/**
 * Pure: a pass with what "End access now" would do to it at `now` (Phase 4,
 * ticket 10): the Order ledger's endGrantedDays over its history, as the
 * action itself decides, so the panel's label and preview match.
 */
function withEnding(pass: AccessPassRecord, now: Date): AdminAccessPass {
  const ending = endGrantedDays(pass.grants, pass.endsAt, now);
  return {
    ...pass,
    ending:
      ending.kind === "none"
        ? null
        : ending.kind === "now"
          ? { kind: "now" }
          : { kind: "keeps-paid", endsAt: ending.endsAt },
  };
}

/** The Admin seam's Users calls, over an arm's store and Member seam. */
export function usersCalls(store: UsersStore, member: MemberReads) {
  async function listUsers(
    actor: StaffActor,
    query: UserListQuery,
  ): Promise<AdminResult<AdminUserList>> {
    const refusal = roleRefusal(actor, "owner", FORBIDDEN);
    if (refusal) return refused(refusal);
    const parsed = userListQuerySchema.safeParse(query);
    if (!parsed.success) return refused(invalidInput(parsed.error));
    const { q, filter } = parsed.data;
    const now = new Date();
    const pageOf = (page: number) =>
      store.listMembers(
        { q, filter },
        { offset: (page - 1) * USERS_PAGE_SIZE, limit: USERS_PAGE_SIZE },
        now,
      );

    let page = parsed.data.page;
    let found = await pageOf(page);
    const pageCount = Math.max(1, Math.ceil(found.matching / USERS_PAGE_SIZE));
    // A page past the last (an old link, or Members gone since) shows the last.
    if (page > pageCount) {
      page = pageCount;
      found = await pageOf(page);
    }
    return saved({ query: { q, filter, page }, ...found, pageCount });
  }

  async function getMemberForAdmin(
    actor: StaffActor,
    userId: string,
  ): Promise<AdminResult<AdminMemberDetail>> {
    const refusal = roleRefusal(actor, "owner", FORBIDDEN);
    if (refusal) return refused(refusal);
    const id = memberIdSchema.safeParse(userId);
    if (!id.success) return NOT_FOUND;
    const records = await store.readMember(id.data);
    if (!records) return NOT_FOUND;

    const [targetExams, activeDevice, switches] = await Promise.all([
      member.listTargetExams(id.data),
      member.getActiveDevice(id.data),
      member.listDeviceSwitches(id.data),
    ]);
    const progress = await Promise.all(
      targetExams.map(async ({ examCode }) => ({
        examCode,
        progress: await member.getProgress(id.data, examCode),
      })),
    );
    const { member: profile, role, betaTester, accessPasses, consents, orders } = records;
    const now = new Date();
    return saved({
      member: profile,
      role,
      betaTester,
      targetExams,
      accessPasses: accessPasses.map((pass) => withEnding(pass, now)),
      progress,
      activeDevice,
      deviceSwitches: newestWithoutId(switches),
      consents: newestWithoutId(consents),
      orders: orders.map((held) => adminOrderOf(held, now)).sort(newestOrderFirst),
    });
  }

  async function forceSignOut(
    actor: StaffActor,
    input: ForceSignOutInput,
  ): Promise<AdminResult<ForcedSignOut>> {
    const refusal = roleRefusal(actor, "owner", FORBIDDEN);
    if (refusal) return refused(refusal);
    const parsed = forceSignOutInputSchema.safeParse(input);
    if (!parsed.success) return refused(invalidInput(parsed.error));
    const { reason } = parsed.data;
    const id = memberIdSchema.safeParse(parsed.data.userId);
    if (!id.success) return NOT_FOUND;

    const now = new Date();
    const cleared = await store.clearActiveDevice(id.data, ({ email }, device) =>
      activityRecord(
        actor,
        now,
        "member",
        id.data,
        "force-sign-out",
        { email, activeDevice: device },
        { email, activeDevice: null, reason },
      ),
    );
    if (!cleared) return NOT_FOUND;
    if (!cleared.device) return refused(formError(NO_ACTIVE_DEVICE));
    return saved({ userId: id.data, signedOut: cleared.device, reason });
  }

  return { listUsers, getMemberForAdmin, forceSignOut };
}
