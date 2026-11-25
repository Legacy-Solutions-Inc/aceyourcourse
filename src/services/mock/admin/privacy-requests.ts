import { getSampleStore, type SampleStore } from "@/services/mock/sample-store";
import {
  type PrivacyRequestRecord,
  type PrivacyRequestsStore,
  privacyRequestCalls,
  type StoredPrivacyRequest,
  withoutDeletedMember,
} from "@/services/privacy-requests.core";

// The sample arm of the Admin seam's Privacy Requests (Phase 3, tickets 18
// and 19): the shared calls (src/services/privacy-requests.core.ts) over the
// in-memory sample store, which holds the Members, every record the Member
// App keeps for them, and the requests they made. Like the database, a
// request outlives its Member's account, with no Member. A Node process runs
// one call at a time here, so a call reads and writes in one step.

/** A request as the list reads it, with its Member, or none once their account is deleted. */
function storedRequest(store: SampleStore, id: string): StoredPrivacyRequest | null {
  const request = store.privacyRequests.find((candidate) => candidate.id === id);
  if (!request) return null;
  const { userId, type, status, requestedAt, dueOn, doneAt, doneBy } = request;
  const found = userId ? store.members.find((member) => member.userId === userId) : undefined;
  return structuredClone({
    id,
    type,
    status,
    requestedAt,
    dueOn,
    member: found ? { userId: found.userId, email: found.email, name: found.name } : null,
    doneAt,
    doneBy,
  });
}

/** Pure: a record by User id, without one Member's. */
function without<T>(records: Record<string, T>, userId: string): Record<string, T> {
  const { [userId]: _, ...kept } = records;
  return kept;
}

/**
 * Deletes every record of a Member, and their Access Passes with the grants
 * behind them, as the database's cascades do; empties their requests' Member,
 * and keeps the User id on the deletion request.
 */
function deleteMember(store: SampleStore, userId: string, requestId: string) {
  const others = <T extends { userId: string }>(records: T[]) =>
    records.filter((record) => record.userId !== userId);
  store.members = others(store.members);
  store.memberConsents = others(store.memberConsents);
  store.memberTargetExams = without(store.memberTargetExams, userId);
  store.selectedExams = without(store.selectedExams, userId);
  store.memberActiveDevices = without(store.memberActiveDevices, userId);
  store.memberDeviceSwitches = others(store.memberDeviceSwitches);
  store.accessPasses = others(store.accessPasses);
  store.accessPassGrants = others(store.accessPassGrants);
  store.memberNotices = others(store.memberNotices);
  store.renewalDismissals = others(store.renewalDismissals);
  store.cardMarks = others(store.cardMarks);
  store.studyDays = others(store.studyDays);
  store.deckPositions = others(store.deckPositions);
  store.quizAttempts = others(store.quizAttempts);
  store.reviewerPageViews = others(store.reviewerPageViews);
  store.readerPositions = others(store.readerPositions);
  store.privacyRequests = store.privacyRequests.map((request) => ({
    ...request,
    userId: request.userId === userId ? null : request.userId,
    deletedUserId: request.id === requestId ? userId : request.deletedUserId,
  }));
}

const samplePrivacyRequestsStore: PrivacyRequestsStore = {
  async readRequests() {
    const store = getSampleStore();
    return store.privacyRequests.flatMap((request) => storedRequest(store, request.id) ?? []);
  },

  async withRequest(id, work) {
    const store = getSampleStore();
    const request = store.privacyRequests.find((candidate) => candidate.id === id);
    const stored = storedRequest(store, id);
    if (!request || !stored) return null;
    const { member } = stored;
    const record: PrivacyRequestRecord = {
      ...stored,
      deletedUserId: request.deletedUserId,
      staff: store.staff.map(({ email, role }) => ({ email, role })),
      invites: store.invites.map(({ email }) => ({ email })),
      betaTester: member ? store.betaTesters.some(({ email }) => email === member.email) : false,
    };
    const { write, result } = work(record);
    if (!write) return result;

    // Staff Activity first: should it fail, nothing else is written.
    const deleting = write.deleteMemberOf;
    let activity = deleting
      ? store.staffActivity.map((entry) => withoutDeletedMember(entry, deleting) ?? entry)
      : store.staffActivity;
    if (write.activity) activity = [...activity, write.activity];
    if (activity !== store.staffActivity) store.staffActivity = activity;

    if (deleting) deleteMember(store, deleting, id);
    const { done } = write;
    if (done) {
      store.privacyRequests = store.privacyRequests.map((candidate) =>
        candidate.id === id
          ? { ...candidate, status: "done", doneAt: done.at, doneBy: done.by }
          : candidate,
      );
    }
    return result;
  },

  async readMemberData(userId) {
    const store = getSampleStore();
    const member = store.members.find((candidate) => candidate.userId === userId);
    if (!member) return null;
    const mine = <T extends { userId: string }>(records: T[]) =>
      records.filter((record) => record.userId === userId);
    const device = store.memberActiveDevices[userId];
    return structuredClone({
      member,
      selectedExamCode: store.selectedExams[userId] ?? null,
      targetExams: store.memberTargetExams[userId] ?? [],
      activeDevice: device
        ? { deviceLabel: device.deviceLabel, claimedAt: device.claimedAt }
        : null,
      consents: mine(store.memberConsents),
      accessPasses: mine(store.accessPasses),
      accessPassGrants: mine(store.accessPassGrants),
      cardMarks: mine(store.cardMarks),
      quizAttempts: mine(store.quizAttempts),
      reviewerPageViews: mine(store.reviewerPageViews),
      studyDays: mine(store.studyDays),
      deckPositions: mine(store.deckPositions),
      readerPositions: mine(store.readerPositions),
      deviceSwitches: mine(store.memberDeviceSwitches),
      notices: mine(store.memberNotices),
    });
  },
};

export const {
  listPrivacyRequests,
  getPrivacyRequestForAdmin,
  exportMemberData,
  deleteMemberAccount,
  markPrivacyRequestDone,
} = privacyRequestCalls(samplePrivacyRequestsStore);
