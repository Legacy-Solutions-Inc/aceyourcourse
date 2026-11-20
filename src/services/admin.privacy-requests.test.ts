import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ARMS } from "../../test/admin-arms";
import { sampleActor } from "../../test/admin-inputs";

// The Admin seam's Privacy Requests list (ticket 18; spec, Phase 3 planning
// decisions → Privacy Requests in the Admin; story 133), run against every
// arm. Owners see every Member's requests, soonest due first, each with its
// Member and whether it's overdue; Editors are refused. Carrying them out
// (export, delete, mark done) is ticket 19.
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
