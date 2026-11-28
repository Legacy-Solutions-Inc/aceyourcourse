import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeAuthAdmin,
  FAKE_AUTH_FAILURE,
  type FakeAuthAdmin,
} from "@/services/auth-admin.fake";
import type { MemberUser } from "@/services/member.types";
import { DEFAULT_ORDER_QUERY } from "@/lib/admin/orders-list";
import { LAST_OWNER } from "@/lib/admin/staff-rules";
import type { Order } from "@/lib/payments/order-ledger";
import { samplePlanId } from "@/services/mock/plans";
import { ALREADY_DELETED } from "@/lib/member-app/privacy-requests";
import { CONFIRMATION_WRONG } from "@/services/admin.schema";
import {
  AUTH_ADMIN_MISSING,
  FINISH_DELETING,
  NOT_A_DATA_COPY,
  NOT_A_DELETION,
  REQUEST_DONE,
  SIGN_IN_NOT_DELETED,
  STAFF_FIRST,
} from "@/services/privacy-requests.core";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor, sampleEmail } from "../../test/admin-inputs";
import {
  NO_MEMBER_RECORDS,
  type StudyContent,
  studyEverything,
  writeStudyContent,
} from "../../test/member-records";

// The Admin seam's Privacy Requests (tickets 18 and 19; spec, Phase 3
// planning decisions → Privacy Requests in the Admin; stories 133, 133q and
// 133r), run against every arm. Owners see every Member's requests, soonest
// due first, each with its Member and whether it's overdue, and carry them
// out: a data copy's file, a deletion's account, and "Mark done". Editors are
// refused every call. Deleting the Supabase User goes through the fake auth
// admin.
//
// The Members ask through the Member seam, as Account does. "Now" is
// 19 Nov 2026, 10:00 in Manila.
const BOOT = new Date("2026-11-19T02:00:00.000Z");
const DAY = 24 * 60 * 60_000;

const OWNER = sampleActor("owner");
const EDITOR = sampleActor("editor");

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: null,
};

const HOUR = 60 * 60_000;
const isoAt = (ms: number) => new Date(BOOT.getTime() + ms).toISOString();

/**
 * A fixture Order (ticket 14), as a Member's Pay and its outcome leave one:
 * the buyer's, CE 3 months by GCash, live, made `fields.createdAt` (a day
 * ago by default) and Paid two minutes after.
 */
function orderOf(buyer: MemberUser, reference: string, fields: Partial<Order> = {}): Order {
  const createdAt = fields.createdAt ?? isoAt(-DAY);
  const status = fields.status ?? "paid";
  const paid = status === "paid" || status === "refunded";
  const paidAt = paid ? new Date(new Date(createdAt).getTime() + 2 * 60_000).toISOString() : null;
  return {
    // "AYC-10001" → "00000000-0000-4000-8000-000000010001".
    id: `00000000-0000-4000-8000-${reference.slice(4).padStart(12, "0")}`,
    reference,
    userId: buyer.userId,
    examCode: "CE",
    planId: samplePlanId("CE", 90),
    courseId: null,
    planName: "CE All-Access",
    days: 90,
    priceCentavos: 129_900,
    method: "gcash",
    livemode: true,
    checkoutId: null,
    paymentId: paid ? `pay_Sample${reference.slice(4)}` : null,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    statusChangedAt: paidAt ?? createdAt,
    paidWithoutAccount: false,
    paidAlreadyOwned: false,
    ...fields,
    status,
    createdAt,
    paidAt,
  };
}

/** What deleting an account with a payment in progress says, with when it expires in Manila. */
const paymentInProgress = (by: string) =>
  `This Member has a payment in progress. Try again after it’s confirmed or expires (by ${by}).`;

describe.each(ADMIN_ARMS)("Admin seam: Privacy Requests ($name)", (arm) => {
  const { seam, member } = arm;
  const at = (ms: number) => vi.setSystemTime(new Date(BOOT.getTime() + ms));
  const listed = async () => {
    const result = await seam.listPrivacyRequests(OWNER);
    if (!result.ok) throw new Error(`Refused an Owner: ${result.error.kind}`);
    return result.value;
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    await member.getOrCreateMember(BEA);
    await member.getOrCreateMember(SAM);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives an Owner no requests before any Member asks", async () => {
    expect(await seam.listPrivacyRequests(OWNER)).toEqual({ ok: true, value: [], tags: [] });
  });

  it("lists each request with its Member, dates and status", async () => {
    const { request } = await member.requestPrivacy(BEA.userId, "deletion");

    expect(await listed()).toEqual([
      {
        id: request.id,
        type: "deletion",
        status: "open",
        requestedAt: BOOT.toISOString(),
        dueOn: "2026-12-19",
        overdue: false,
        member: BEA,
        doneAt: null,
        doneBy: null,
      },
    ]);
  });

  it("lists every Member's requests, soonest due first", async () => {
    await member.requestPrivacy(BEA.userId, "deletion");
    at(DAY);
    await member.requestPrivacy(SAM.userId, "data-copy");
    at(2 * DAY);
    await member.requestPrivacy(BEA.userId, "data-copy");

    expect((await listed()).map(({ type, member, dueOn }) => [type, member?.email, dueOn])).toEqual(
      [
        ["data-copy", SAM.email, "2026-11-27"],
        ["data-copy", BEA.email, "2026-11-28"],
        ["deletion", BEA.email, "2026-12-19"],
      ],
    );
  });

  it("flags a request still open after its due date, from Manila midnight", async () => {
    await member.requestPrivacy(BEA.userId, "data-copy");

    // 23:59 on 26 Nov in Manila: the due date, not yet past.
    vi.setSystemTime(new Date("2026-11-26T15:59:00.000Z"));
    expect((await listed())[0]).toMatchObject({ dueOn: "2026-11-26", overdue: false });

    // 00:00 on 27 Nov in Manila, still the 26th in UTC.
    vi.setSystemTime(new Date("2026-11-26T16:00:00.000Z"));
    expect((await listed())[0]).toMatchObject({ overdue: true });
  });

  it("keeps a request once its Member's account is deleted, saying nothing of who asked", async () => {
    const { request } = await member.requestPrivacy(BEA.userId, "deletion");
    await member.requestPrivacy(SAM.userId, "data-copy");

    await arm.deleteMemberElsewhere(BEA.userId);

    const after = await listed();
    expect(after).toHaveLength(2);
    expect(after.find(({ id }) => id === request.id)).toEqual({
      id: request.id,
      type: "deletion",
      status: "open",
      requestedAt: BOOT.toISOString(),
      dueOn: "2026-12-19",
      overdue: false,
      member: null,
      doneAt: null,
      doneBy: null,
    });
  });

  it("refuses an Editor", async () => {
    await member.requestPrivacy(BEA.userId, "data-copy");
    expect(await seam.listPrivacyRequests(EDITOR)).toMatchObject({
      ok: false,
      error: { kind: "forbidden", message: "ONLY AN OWNER CAN SEE PRIVACY REQUESTS" },
    });
  });
});

describe.each(ADMIN_ARMS)("Admin seam: carrying out Privacy Requests ($name)", (arm) => {
  const { seam, member } = arm;
  let auth: FakeAuthAdmin;
  let content: StudyContent;

  /** A Member with a record in every table, their device token made of `token`. */
  const studied = (who: MemberUser, token: string) => studyEverything(arm, who, content, token);
  const ask = async (who: MemberUser, type: "data-copy" | "deletion") =>
    (await member.requestPrivacy(who.userId, type)).request.id;
  const detail = async (id: string) => {
    const result = await seam.getPrivacyRequestForAdmin(OWNER, id);
    if (!result.ok) throw new Error(`Refused an Owner: ${result.error.kind}`);
    return result.value;
  };
  const deleteAccount = (requestId: string, confirmation: string, actor = OWNER) =>
    seam.deleteMemberAccount(actor, { requestId, confirmation }, auth);
  const markDone = (requestId: string, actor = OWNER) =>
    seam.markPrivacyRequestDone(actor, { requestId });
  const refusedWith = (formError: string) => ({
    ok: false,
    error: { kind: "invalid", fieldErrors: {}, formError },
  });
  const activityFor = async (requestId: string) =>
    (await arm.staffActivity()).filter(({ entityId }) => entityId === requestId);
  /** A Member using one of the staff list's emails. */
  const memberWithEmail = async (email: string): Promise<MemberUser> => {
    const user = { userId: crypto.randomUUID(), email, name: null };
    await member.getOrCreateMember(user);
    return user;
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    auth = createFakeAuthAdmin();
    content = await writeStudyContent(arm);
    await studied(BEA, "b");
    await studied(SAM, "5");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPrivacyRequestForAdmin", () => {
    it("gives the request, its Member, and that the account can be deleted", async () => {
      const id = await ask(BEA, "deletion");

      expect(await detail(id)).toEqual({
        id,
        type: "deletion",
        status: "open",
        requestedAt: BOOT.toISOString(),
        dueOn: "2026-12-19",
        overdue: false,
        member: BEA,
        doneAt: null,
        doneBy: null,
        deletionBlocked: null,
        deletionUnfinished: false,
        // tester@example.com is on the sample Beta Tester list.
        betaTester: true,
        paidOrders: 0,
      });
    });

    it("counts the paid Orders that deleting the account keeps, Refunded ones too (ticket 14)", async () => {
      await arm.putOrder(orderOf(BEA, "AYC-10001"));
      await arm.putOrder(orderOf(BEA, "AYC-10002", { status: "refunded" }));
      await arm.putOrder(orderOf(BEA, "AYC-10003", { status: "failed" }));
      await arm.putOrder(orderOf(BEA, "AYC-10004", { status: "expired" }));
      await arm.putOrder(orderOf(SAM, "AYC-10005"));

      expect((await detail(await ask(BEA, "deletion"))).paidOrders).toBe(2);
    });

    it("says the account can't be deleted while a payment is in progress, until it expires", async () => {
      await arm.putOrder(orderOf(BEA, "AYC-10001", { status: "pending", createdAt: isoAt(-HOUR) }));
      const id = await ask(BEA, "deletion");

      // Made at 09:00 on 19 Nov in Manila: it expires 24 hours later.
      expect((await detail(id)).deletionBlocked).toBe(paymentInProgress("20 Nov 2026, 9:00 am"));

      vi.setSystemTime(new Date(BOOT.getTime() + 23 * HOUR + 1));
      expect((await detail(id)).deletionBlocked).toBeNull();
    });

    it("says why the account can't be deleted while its email is on the staff list", async () => {
      const editor = await memberWithEmail(sampleEmail("editor"));
      const invited = await memberWithEmail(sampleEmail("invited"));
      const expired = await memberWithEmail(sampleEmail("expired"));
      const owner = await memberWithEmail(sampleEmail("owner"));

      expect((await detail(await ask(editor, "deletion"))).deletionBlocked).toBe(STAFF_FIRST);
      expect((await detail(await ask(invited, "deletion"))).deletionBlocked).toBe(STAFF_FIRST);
      expect((await detail(await ask(expired, "deletion"))).deletionBlocked).toBe(STAFF_FIRST);
      expect((await detail(await ask(owner, "deletion"))).deletionBlocked).toContain(LAST_OWNER);
    });

    it("gives a request whose Member's account is deleted, saying nothing of them", async () => {
      const id = await ask(BEA, "data-copy");
      await arm.deleteMemberElsewhere(BEA.userId);

      expect(await detail(id)).toMatchObject({
        member: null,
        deletionBlocked: null,
        deletionUnfinished: false,
        betaTester: false,
      });
    });

    it("is not-found for a request that isn't there, or an id that isn't one", async () => {
      expect(await seam.getPrivacyRequestForAdmin(OWNER, crypto.randomUUID())).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
      expect(await seam.getPrivacyRequestForAdmin(OWNER, "not-an-id")).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("refuses an Editor", async () => {
      const id = await ask(BEA, "data-copy");
      expect(await seam.getPrivacyRequestForAdmin(EDITOR, id)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
    });
  });

  describe("exportMemberData", () => {
    it("gives the Member's data with every section filled in from their records", async () => {
      const id = await ask(BEA, "data-copy");

      const result = await seam.exportMemberData(OWNER, id);

      if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result.error)}`);
      expect(result.value.filename).toBe(
        `ayc-member-data-2026-11-19-${BEA.userId.slice(0, 8)}.json`,
      );
      const { data } = result.value;
      expect(data).toMatchObject({
        format: "ayc-member-data",
        version: 3,
        exportedAt: BOOT.toISOString(),
        profile: { ...BEA, selectedExamCode: "ME" },
        devices: { activeDevice: { deviceLabel: "Chrome on Android" } },
      });
      expect(data.targetExams.map(({ examCode }) => examCode).sort()).toEqual(["CE", "ME"]);
      expect(data.accessPasses).toEqual([
        expect.objectContaining({
          examCode: "CE",
          grants: [expect.objectContaining({ days: 30 })],
        }),
      ]);
      expect(data.consents).toHaveLength(1);
      expect(data.cardMarks).toEqual([expect.objectContaining({ cardId: content.card.id })]);
      expect(data.quizAttempts).toHaveLength(1);
      expect(data.reviewerPagesViewed).toEqual([
        expect.objectContaining({ reviewerPdfId: content.reviewerPdfId, page: 1 }),
      ]);
      expect(data.studyDays).toEqual(["2026-11-19"]);
      expect(data.resume.decks).toHaveLength(1);
      expect(data.resume.reviewerPdfs).toHaveLength(1);
      expect(data.devices.switches).toHaveLength(1);
      expect(data.notices).toEqual([
        expect.objectContaining({ examCode: "CE", kind: "granted" }),
        expect.objectContaining({ kind: "course-given", courseTitle: "HPGE Crash Course" }),
      ]);
      expect(data.orders).toEqual([]);
      // Version 3 (Phase 5, ticket 07): the Course given her, and the Lesson she watched.
      expect(data.courses).toEqual([
        expect.objectContaining({ title: "HPGE Crash Course", orderReference: null }),
      ]);
      expect(data.lessonProgress).toEqual([expect.objectContaining({ positionSeconds: 30 })]);
    });

    it("adds the Member's Orders, each with its Invoice Request, and no one else's (ticket 14)", async () => {
      const paid = orderOf(BEA, "AYC-10001", { createdAt: isoAt(-2 * DAY) });
      await arm.putOrder(paid);
      await arm.putOrder(orderOf(BEA, "AYC-10002", { status: "failed", method: "maya" }));
      await arm.putOrder(orderOf(SAM, "AYC-10003"));
      const asked = await member.requestInvoice(BEA.userId, "AYC-10001", {
        name: "Sample Builders Inc.",
        address: "12 Sample St, Jaro, Iloilo City",
        tin: "123-456-789-000",
      });
      expect(asked).toEqual({ ok: true });
      const id = await ask(BEA, "data-copy");

      const result = await seam.exportMemberData(OWNER, id);

      if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result.error)}`);
      const { data } = result.value;
      expect(data.version).toBe(3);
      expect(data.orders).toEqual([
        {
          reference: "AYC-10001",
          examCode: "CE",
          planName: "CE All-Access",
          days: 90,
          priceCentavos: 129_900,
          method: "gcash",
          status: "paid",
          livemode: true,
          createdAt: paid.createdAt,
          paidAt: paid.paidAt,
          buyer: { name: BEA.name, email: BEA.email },
          payMongoReference: "pay_Sample10001",
          refunds: [],
          invoiceRequest: {
            name: "Sample Builders Inc.",
            address: "12 Sample St, Jaro, Iloilo City",
            tin: "123-456-789-000",
            requestedAt: BOOT.toISOString(),
            sentAt: null,
          },
        },
        expect.objectContaining({ reference: "AYC-10002", status: "failed", invoiceRequest: null }),
      ]);
      expect(JSON.stringify(data)).not.toContain("AYC-10003");
    });

    it("never includes another Member's data", async () => {
      const id = await ask(BEA, "data-copy");

      const result = await seam.exportMemberData(OWNER, id);

      if (!result.ok) throw new Error("Refused");
      const file = JSON.stringify(result.value.data);
      expect(file).not.toContain(SAM.userId);
      expect(file).not.toContain(SAM.email);
    });

    it("logs the download in Staff Activity, without the Member's email or name", async () => {
      const id = await ask(BEA, "data-copy");

      await seam.exportMemberData(OWNER, id);

      const records = await activityFor(id);
      expect(records).toEqual([
        expect.objectContaining({
          actor: { email: OWNER.email, name: OWNER.name },
          entity: "privacy-request",
          entityId: id,
          action: "exported",
          before: null,
          after: { type: "data-copy", userId: BEA.userId },
        }),
      ]);
      expect(JSON.stringify(records)).not.toContain(BEA.email);
      expect(JSON.stringify(records)).not.toContain(BEA.name);
    });

    it("says “Already deleted” once the Member's account is gone, logging nothing", async () => {
      const id = await ask(BEA, "data-copy");
      await arm.deleteMemberElsewhere(BEA.userId);

      expect(await seam.exportMemberData(OWNER, id)).toEqual(refusedWith(ALREADY_DELETED));
      expect(await activityFor(id)).toEqual([]);
    });

    it("refuses a deletion request: only a data copy has a file", async () => {
      const id = await ask(BEA, "deletion");
      expect(await seam.exportMemberData(OWNER, id)).toEqual(refusedWith(NOT_A_DATA_COPY));
    });

    it("refuses an Editor, logging nothing, and is not-found for a request that isn't there", async () => {
      const id = await ask(BEA, "data-copy");
      expect(await seam.exportMemberData(EDITOR, id)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await activityFor(id)).toEqual([]);
      expect(await seam.exportMemberData(OWNER, crypto.randomUUID())).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });

  describe("deleteMemberAccount", () => {
    it("deletes every record of the account and its Supabase User, and marks the request done", async () => {
      const id = await ask(BEA, "deletion");
      const samBefore = await arm.memberRecords(SAM.userId);

      const result = await deleteAccount(id, BEA.email);

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          id,
          type: "deletion",
          status: "done",
          member: null,
          doneAt: BOOT.toISOString(),
          doneBy: { email: OWNER.email, name: OWNER.name },
        }),
        tags: [],
      });
      expect(await arm.memberRecords(BEA.userId)).toEqual(NO_MEMBER_RECORDS);
      expect(auth.deleted).toEqual([BEA.userId]);
      expect(await arm.memberRecords(SAM.userId)).toEqual(samBefore);
      expect(await seam.getMemberForAdmin(OWNER, BEA.userId)).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });

    it("keeps the request's type, dates and status, and nothing that says who asked", async () => {
      const id = await ask(BEA, "deletion");
      const copy = await ask(BEA, "data-copy");

      await deleteAccount(id, BEA.email);

      const listed = await seam.listPrivacyRequests(OWNER);
      if (!listed.ok) throw new Error("Refused");
      expect(listed.value).toEqual([
        expect.objectContaining({ id: copy, status: "open", member: null }),
        expect.objectContaining({
          id,
          type: "deletion",
          status: "done",
          requestedAt: BOOT.toISOString(),
          dueOn: "2026-12-19",
          member: null,
        }),
      ]);
      expect(JSON.stringify(listed.value)).not.toContain(BEA.email);
    });

    it("takes the email typed with other capitals and spaces around it", async () => {
      const id = await ask(BEA, "deletion");
      expect(await deleteAccount(id, `  ${BEA.email.toUpperCase()} `)).toMatchObject({ ok: true });
    });

    it("records the deletion in Staff Activity with only the request and an opaque Member id", async () => {
      const id = await ask(BEA, "deletion");

      await deleteAccount(id, BEA.email);

      const records = await activityFor(id);
      expect(records).toEqual([
        expect.objectContaining({
          entity: "privacy-request",
          entityId: id,
          action: "account-deleted",
          before: null,
          after: { userId: BEA.userId },
        }),
      ]);
    });

    it("takes the Member's email out of the earlier Staff Activity about their account", async () => {
      // Granting CE recorded Bea's email (studyEverything).
      const id = await ask(BEA, "deletion");
      expect(JSON.stringify(await arm.staffActivity())).toContain(BEA.email);

      await deleteAccount(id, BEA.email);

      const activity = JSON.stringify(await arm.staffActivity());
      expect(activity).not.toContain(BEA.email);
      expect(activity).not.toContain(BEA.name);
      // Sam's grant keeps his.
      expect(activity).toContain(SAM.email);
    });

    it("lets the same Google account sign in again as a brand-new Member", async () => {
      const id = await ask(BEA, "deletion");
      vi.setSystemTime(new Date(BOOT.getTime() + DAY));
      await deleteAccount(id, BEA.email);

      const again = await member.getOrCreateMember(BEA);

      expect(again.joinedAt).toBe(new Date(BOOT.getTime() + DAY).toISOString());
      expect(await member.latestConsent(BEA.userId)).toBeNull();
      expect(await member.listTargetExams(BEA.userId)).toEqual([]);
      expect(await member.listAccessPasses(BEA.userId)).toEqual([]);
      expect(await member.listOpenPrivacyRequests(BEA.userId)).toEqual([]);
      expect(await member.listNotices(BEA.userId)).toEqual([]);
    });

    it("refuses a wrong or empty typed confirmation, deleting and recording nothing", async () => {
      const id = await ask(BEA, "deletion");
      const before = await arm.memberRecords(BEA.userId);

      for (const typed of [SAM.email, "tester@example", "DELETE", ""]) {
        expect(await deleteAccount(id, typed)).toEqual({
          ok: false,
          error: { kind: "invalid", fieldErrors: { confirmation: [CONFIRMATION_WRONG] } },
        });
      }
      expect(await arm.memberRecords(BEA.userId)).toEqual(before);
      expect(auth.deleted).toEqual([]);
      expect(await activityFor(id)).toEqual([]);
    });

    it("refuses an account whose email is on the staff list: “Remove them from Staff first”", async () => {
      for (const email of [sampleEmail("editor"), sampleEmail("invited"), sampleEmail("expired")]) {
        const staff = await memberWithEmail(email);
        const id = await ask(staff, "deletion");

        expect(await deleteAccount(id, email)).toEqual(refusedWith(STAFF_FIRST));
        expect((await arm.memberRecords(staff.userId)).member).toBe(1);
      }
      expect(auth.deleted).toEqual([]);
    });

    it("never deletes the last Owner", async () => {
      const owner = await memberWithEmail(sampleEmail("owner"));
      const id = await ask(owner, "deletion");

      const result = await deleteAccount(id, owner.email);

      expect(result).toMatchObject({ ok: false, error: { kind: "invalid" } });
      expect(!result.ok && result.error.kind === "invalid" && result.error.formError).toContain(
        LAST_OWNER,
      );
      expect((await arm.memberRecords(owner.userId)).member).toBe(1);
      expect(auth.deleted).toEqual([]);
    });

    it("deletes someone removed from Staff", async () => {
      const editor = await memberWithEmail(sampleEmail("editor"));
      const id = await ask(editor, "deletion");
      const removed = await seam.removeStaff(OWNER, sampleEmail("editor"));
      expect(removed.ok).toBe(true);

      expect(await deleteAccount(id, editor.email)).toMatchObject({ ok: true });
      expect(auth.deleted).toEqual([editor.userId]);
    });

    describe("when Supabase can't delete the User", () => {
      // The server logs why, for whoever looks into it.
      let logged: ReturnType<typeof vi.spyOn>;
      beforeEach(() => {
        logged = vi.spyOn(console, "error").mockImplementation(() => {});
      });
      afterEach(() => {
        logged.mockRestore();
      });

      it("says so and leaves the request open, never reporting a half-done deletion as done", async () => {
        const id = await ask(BEA, "deletion");
        auth.failNext();

        expect(await deleteAccount(id, BEA.email)).toEqual(refusedWith(SIGN_IN_NOT_DELETED));
        expect(logged).toHaveBeenCalledWith("A Supabase User wasn't deleted", {
          requestId: id,
          reason: FAKE_AUTH_FAILURE,
        });

        expect(await detail(id)).toMatchObject({
          status: "open",
          doneAt: null,
          member: null,
          deletionUnfinished: true,
        });
        // The Member data went in one step; only the Supabase User is left.
        expect(await arm.memberRecords(BEA.userId)).toEqual(NO_MEMBER_RECORDS);
        expect(auth.deleted).toEqual([]);
      });

      it("finishes on a retry, which needs no typed email: the Member is gone", async () => {
        const id = await ask(BEA, "deletion");
        auth.failNext();
        await deleteAccount(id, BEA.email);

        const retried = await deleteAccount(id, "");

        expect(retried).toMatchObject({ ok: true, value: { status: "done" } });
        expect(auth.deleted).toEqual([BEA.userId]);
        expect(await detail(id)).toMatchObject({ status: "done", deletionUnfinished: false });
      });

      it("deletes again what the Member made by signing in before the retry", async () => {
        const id = await ask(BEA, "deletion");
        auth.failNext();
        await deleteAccount(id, BEA.email);
        await member.getOrCreateMember(BEA);
        await member.recordConsent(BEA.userId, { termsVersion: "2.0", privacyVersion: "2.0" });

        await deleteAccount(id, "");

        expect(await arm.memberRecords(BEA.userId)).toEqual(NO_MEMBER_RECORDS);
      });

      it("can't be marked done until the deletion is finished", async () => {
        const id = await ask(BEA, "deletion");
        auth.failNext();
        await deleteAccount(id, BEA.email);

        expect(await markDone(id)).toEqual(refusedWith(FINISH_DELETING));
      });
    });

    it("deletes nothing on a server that can't delete Supabase Users", async () => {
      const id = await ask(BEA, "deletion");
      const before = await arm.memberRecords(BEA.userId);
      const noSecretKey = createFakeAuthAdmin({ configured: false });

      expect(
        await seam.deleteMemberAccount(
          OWNER,
          { requestId: id, confirmation: BEA.email },
          noSecretKey,
        ),
      ).toEqual(refusedWith(AUTH_ADMIN_MISSING));
      expect(await arm.memberRecords(BEA.userId)).toEqual(before);
      expect(await detail(id)).toMatchObject({ status: "open", deletionUnfinished: false });
      expect(await activityFor(id)).toEqual([]);
    });

    it("says “Already deleted” for a Member whose account is gone, asking Supabase nothing", async () => {
      const id = await ask(BEA, "deletion");
      await arm.deleteMemberElsewhere(BEA.userId);

      expect(await deleteAccount(id, BEA.email)).toEqual(refusedWith(ALREADY_DELETED));
      expect(auth.deleted).toEqual([]);
    });

    it("refuses a data-copy request, and one that's done", async () => {
      const copy = await ask(BEA, "data-copy");
      expect(await deleteAccount(copy, BEA.email)).toEqual(refusedWith(NOT_A_DELETION));

      const id = await ask(SAM, "deletion");
      await deleteAccount(id, SAM.email);
      expect(await deleteAccount(id, SAM.email)).toEqual(refusedWith(REQUEST_DONE));
      expect(auth.deleted).toEqual([SAM.userId]);
    });

    it("refuses an Editor, deleting nothing and asking Supabase nothing", async () => {
      const id = await ask(BEA, "deletion");
      const before = await arm.memberRecords(BEA.userId);

      expect(await deleteAccount(id, BEA.email, EDITOR)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect(await arm.memberRecords(BEA.userId)).toEqual(before);
      expect(auth.deleted).toEqual([]);
    });

    it("is not-found for a request that isn't there, or an id that isn't one", async () => {
      for (const requestId of [crypto.randomUUID(), "not-an-id"]) {
        expect(await deleteAccount(requestId, BEA.email)).toEqual({
          ok: false,
          error: { kind: "not-found" },
        });
      }
    });

    describe("with Orders (ticket 14)", () => {
      it("keeps the Member's Orders with no account, as bought, and the Owner still finds them", async () => {
        const first = orderOf(BEA, "AYC-10001", { createdAt: isoAt(-30 * DAY) });
        const second = orderOf(BEA, "AYC-10002", { method: "maya" });
        const sams = orderOf(SAM, "AYC-10003");
        for (const order of [first, second, sams]) await arm.putOrder(order);
        await member.requestInvoice(BEA.userId, "AYC-10002", {
          name: "Bea Tester",
          address: "Jaro, Iloilo City",
        });
        const id = await ask(BEA, "deletion");

        expect(await deleteAccount(id, BEA.email)).toMatchObject({
          ok: true,
          value: { status: "done" },
        });

        expect(await arm.orders()).toEqual([
          { ...first, userId: null },
          { ...second, userId: null },
          sams,
        ]);
        const listed = await seam.listOrdersForAdmin(OWNER, {
          ...DEFAULT_ORDER_QUERY,
          range: "all",
        });
        if (!listed.ok) throw new Error("Refused an Owner");
        expect(
          listed.value.rows.map(({ reference, userId, buyerName, buyerEmail }) => ({
            reference,
            userId,
            buyerName,
            buyerEmail,
          })),
        ).toEqual([
          { reference: "AYC-10003", userId: SAM.userId, buyerName: null, buyerEmail: SAM.email },
          { reference: "AYC-10002", userId: null, buyerName: BEA.name, buyerEmail: BEA.email },
          { reference: "AYC-10001", userId: null, buyerName: BEA.name, buyerEmail: BEA.email },
        ]);
        const kept = await seam.getOrderForAdmin(OWNER, "AYC-10002");
        expect(kept).toMatchObject({
          ok: true,
          value: {
            memberUserId: null,
            order: { status: "paid", invoice: { name: "Bea Tester", sentAt: null } },
          },
        });
        const csv = await seam.exportOrdersCsv(OWNER, { ...DEFAULT_ORDER_QUERY, range: "all" });
        if (!csv.ok) throw new Error("Refused an Owner");
        expect(csv.value.rows).toBe(3);
        expect(csv.value.csv).toContain(`AYC-10001,`);
        expect(csv.value.csv).toContain(BEA.email);
      });

      it("refuses while the Member has a payment in progress, deleting nothing", async () => {
        await arm.putOrder(
          orderOf(BEA, "AYC-10001", { status: "pending", createdAt: isoAt(-3 * HOUR) }),
        );
        await arm.putOrder(
          orderOf(BEA, "AYC-10002", { status: "pending", createdAt: isoAt(-HOUR) }),
        );
        const id = await ask(BEA, "deletion");
        const before = await arm.memberRecords(BEA.userId);

        // The later of the two expires last: at 09:00 on 20 Nov in Manila.
        expect(await deleteAccount(id, BEA.email)).toEqual(
          refusedWith(paymentInProgress("20 Nov 2026, 9:00 am")),
        );

        expect(await arm.memberRecords(BEA.userId)).toEqual(before);
        expect(auth.deleted).toEqual([]);
        expect(await activityFor(id)).toEqual([]);
        expect(await detail(id)).toMatchObject({ status: "open", member: BEA });
        expect((await arm.orders()).map(({ userId }) => userId)).toEqual([BEA.userId, BEA.userId]);
      });

      it.each([
        ["recorded Expired", "expired"],
        ["Pending past its 24 hours, before the daily sweep records it", "pending"],
      ] as const)("deletes once the payment has expired: %s", async (_when, status) => {
        await arm.putOrder(orderOf(BEA, "AYC-10001", { status, createdAt: isoAt(-25 * HOUR) }));
        const id = await ask(BEA, "deletion");

        expect(await deleteAccount(id, BEA.email)).toMatchObject({ ok: true });

        expect(await arm.orders()).toMatchObject([
          { reference: "AYC-10001", userId: null, status },
        ]);
        expect(auth.deleted).toEqual([BEA.userId]);
      });

      it("never shows the kept Orders in the Member App, not even to a new account for the same person", async () => {
        await arm.putOrder(orderOf(BEA, "AYC-10001"));
        const id = await ask(BEA, "deletion");
        await deleteAccount(id, BEA.email);

        await member.getOrCreateMember(BEA);

        expect(await member.listMemberOrders(BEA.userId)).toEqual([]);
        expect(await member.getMemberOrder(BEA.userId, "AYC-10001")).toBeNull();
        expect(await member.getPaymentAcknowledgement(BEA.userId, "AYC-10001")).toBeNull();
        expect(await seam.getMemberForAdmin(OWNER, BEA.userId)).toMatchObject({
          ok: true,
          value: { orders: [] },
        });
      });
    });

    it("deletes nothing when Staff Activity can't be written", async () => {
      const id = await ask(BEA, "deletion");
      const before = await arm.memberRecords(BEA.userId);
      const repair = await arm.breakStaffActivity();
      try {
        await expect(deleteAccount(id, BEA.email)).rejects.toThrow();
      } finally {
        await repair();
      }
      expect(await arm.memberRecords(BEA.userId)).toEqual(before);
      expect(auth.deleted).toEqual([]);
      expect(await detail(id)).toMatchObject({ status: "open", member: BEA });
    });
  });

  describe("markPrivacyRequestDone", () => {
    it("marks a data copy done, with the date and who", async () => {
      const id = await ask(BEA, "data-copy");
      vi.setSystemTime(new Date(BOOT.getTime() + DAY));

      const result = await markDone(id);

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          id,
          status: "done",
          member: BEA,
          doneAt: new Date(BOOT.getTime() + DAY).toISOString(),
          doneBy: { email: OWNER.email, name: OWNER.name },
          overdue: false,
        }),
        tags: [],
      });
      expect(await member.listOpenPrivacyRequests(BEA.userId)).toEqual([]);
    });

    it("stops a done request being flagged overdue", async () => {
      const id = await ask(BEA, "data-copy");
      vi.setSystemTime(new Date(BOOT.getTime() + 10 * DAY));
      expect((await detail(id)).overdue).toBe(true);

      await markDone(id);

      expect((await detail(id)).overdue).toBe(false);
    });

    it("records it in Staff Activity, without the Member's email or name", async () => {
      const id = await ask(BEA, "data-copy");

      await markDone(id);

      const records = await activityFor(id);
      expect(records).toEqual([
        expect.objectContaining({
          entity: "privacy-request",
          entityId: id,
          action: "mark-done",
          before: { status: "open" },
          after: { status: "done", doneAt: BOOT.toISOString() },
        }),
      ]);
      expect(JSON.stringify(records)).not.toContain(BEA.email);
    });

    it("refuses a request that's already done, recording nothing more", async () => {
      const id = await ask(BEA, "data-copy");
      await markDone(id);

      expect(await markDone(id)).toEqual(refusedWith(REQUEST_DONE));
      expect(await activityFor(id)).toHaveLength(1);
    });

    it("marks a deletion done without deleting the account, for one carried out another way", async () => {
      const id = await ask(BEA, "deletion");

      expect(await markDone(id)).toMatchObject({
        ok: true,
        value: { status: "done", member: BEA },
      });
      expect((await arm.memberRecords(BEA.userId)).member).toBe(1);
      expect(auth.deleted).toEqual([]);
    });

    it("closes a deletion request from Staff, which can't be carried out", async () => {
      const owner = await memberWithEmail(sampleEmail("owner"));
      const id = await ask(owner, "deletion");

      expect(await markDone(id)).toMatchObject({ ok: true, value: { status: "done" } });
      expect((await detail(id)).overdue).toBe(false);
    });

    it("marks done a request whose Member's account is already deleted", async () => {
      const copy = await ask(BEA, "data-copy");
      const deletion = await ask(BEA, "deletion");
      await arm.deleteMemberElsewhere(BEA.userId);

      expect(await markDone(copy)).toMatchObject({ ok: true, value: { status: "done" } });
      expect(await markDone(deletion)).toMatchObject({ ok: true, value: { status: "done" } });
    });

    it("refuses an Editor, and is not-found for a request that isn't there", async () => {
      const id = await ask(BEA, "data-copy");
      expect(await markDone(id, EDITOR)).toMatchObject({
        ok: false,
        error: { kind: "forbidden" },
      });
      expect((await detail(id)).status).toBe("open");
      expect(await markDone(crypto.randomUUID())).toEqual({
        ok: false,
        error: { kind: "not-found" },
      });
    });
  });
});
