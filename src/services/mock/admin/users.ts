import { refundsOfOrder } from "@/lib/payments/refunds";
import type { AdminUserRow, UserRole } from "@/services/admin.types";
import * as memberArm from "@/services/member.mock";
import type { Member } from "@/services/member.types";
import { getSampleStore } from "@/services/mock/sample-store";
import { matchesUserQuery, newestFirst, type UsersStore, usersCalls } from "@/services/users.core";

// The sample arm of the Admin seam's Users (Phase 3, ticket 16): the shared
// calls (src/services/users.core.ts) over the in-memory sample store, which
// holds the Members and their records, the staff list and the Beta Tester
// list. Like the database's cascades, a Target Exam or an Access Pass for an
// Exam an Owner deleted is left out.

function examExists(code: string): boolean {
  return getSampleStore().catalogue.exams.some((exam) => exam.code === code);
}

/** A Member's role now: their Staff Role while they're active Staff, otherwise Member. */
function roleOf(email: string): UserRole {
  return getSampleStore().staff.find((staff) => staff.email === email)?.role ?? "member";
}

const isBetaTester = (email: string) =>
  getSampleStore().betaTesters.some((tester) => tester.email === email);

/** A Member's Access Passes, by Exam code. */
function passesOf(userId: string) {
  return getSampleStore()
    .accessPasses.filter((pass) => pass.userId === userId && examExists(pass.examCode))
    .sort((a, b) => a.examCode.localeCompare(b.examCode));
}

/** A Member as the Users list shows them. */
function rowOf(member: Member): AdminUserRow {
  const store = getSampleStore();
  const device = store.memberActiveDevices[member.userId];
  return {
    userId: member.userId,
    name: member.name,
    email: member.email,
    joinedAt: member.joinedAt,
    targetExams: (store.memberTargetExams[member.userId] ?? [])
      .filter((record) => record.removedAt === null && examExists(record.examCode))
      .map((record) => record.examCode),
    accessPasses: passesOf(member.userId).map(({ examCode, endsAt }) => ({ examCode, endsAt })),
    activeDevice: device ? { deviceLabel: device.deviceLabel, claimedAt: device.claimedAt } : null,
    role: roleOf(member.email),
    betaTester: isBetaTester(member.email),
  };
}

const memberOf = (userId: string) =>
  getSampleStore().members.find((member) => member.userId === userId);

const sampleUsersStore: UsersStore = {
  async listMembers(query, { offset, limit }, now) {
    const rows = getSampleStore().members.map(rowOf).sort(newestFirst);
    const matching = rows.filter((row) => matchesUserQuery(row, query, now));
    return {
      rows: structuredClone(matching.slice(offset, offset + limit)),
      matching: matching.length,
      total: rows.length,
    };
  },

  async readMember(userId) {
    const member = memberOf(userId);
    if (!member) return null;
    const store = getSampleStore();
    return structuredClone({
      member,
      role: roleOf(member.email),
      betaTester: isBetaTester(member.email),
      accessPasses: passesOf(userId).map(({ examCode, endsAt }) => ({
        examCode,
        endsAt,
        grants: store.accessPassGrants
          .filter((grant) => grant.userId === userId && grant.examCode === examCode)
          .map(({ userId: _, examCode: __, ...grant }) => grant),
      })),
      consents: store.memberConsents.filter((record) => record.userId === userId),
      orders: store.orders
        .filter((order) => order.userId === userId)
        .map((order) => ({
          order,
          invoice: store.invoiceRequests.find((request) => request.orderId === order.id) ?? null,
          refunds: refundsOfOrder(store.orderRefunds)(order.id),
        })),
    });
  },

  async clearActiveDevice(userId, activity) {
    const member = memberOf(userId);
    if (!member) return null;
    const store = getSampleStore();
    const record = store.memberActiveDevices[userId];
    if (!record) return { member: structuredClone(member), device: null };

    const device = { deviceLabel: record.deviceLabel, claimedAt: record.claimedAt };
    const entry = activity(member, device);
    // The Staff Activity first: should it fail, the device is still Active.
    store.staffActivity = [...store.staffActivity, entry];
    const { [userId]: _, ...others } = store.memberActiveDevices;
    store.memberActiveDevices = others;
    return { member: structuredClone(member), device };
  },
};

export const { listUsers, getMemberForAdmin, forceSignOut } = usersCalls(
  sampleUsersStore,
  memberArm,
);
