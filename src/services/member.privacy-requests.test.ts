import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MEMBER_ARMS } from "../../test/member-arms";

// The Member seam's Privacy Requests (ticket 18; spec, Phase 3 → Privacy
// Requests; stories 111 and 112), run against every arm. A Member asks from
// Account for a copy of their data (due in 7 days) or for their account to be
// deleted (due in 30), counted in Manila days. While one of a type is open,
// asking again makes nothing and gives the open one. A Member only ever reads
// or makes their own.
//
// "Now" is 19 Nov 2026, 10:00 in Manila.
const BOOT = new Date("2026-11-19T02:00:00.000Z");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const BEA = {
  userId: "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21",
  email: "tester@example.com",
  name: "Bea Tester",
};
const SAM = {
  userId: "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f",
  email: "stranger@example.com",
  name: "Sam Stranger",
};

describe.each(MEMBER_ARMS)("Member seam: Privacy Requests ($name)", (arm) => {
  const { seam } = arm;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    await seam.getOrCreateMember(BEA);
    await seam.getOrCreateMember(SAM);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives a Member who has asked for nothing no open request", async () => {
    expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([]);
  });

  it("makes a data copy request, open and due in 7 days", async () => {
    const { request, created } = await seam.requestPrivacy(BEA.userId, "data-copy");

    expect(created).toBe(true);
    expect(request).toEqual({
      id: expect.stringMatching(UUID),
      userId: BEA.userId,
      type: "data-copy",
      status: "open",
      requestedAt: BOOT.toISOString(),
      dueOn: "2026-11-26",
    });
    expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([request]);
  });

  it("makes a deletion request, due in 30 days", async () => {
    const { request } = await seam.requestPrivacy(BEA.userId, "deletion");
    expect(request).toMatchObject({ type: "deletion", status: "open", dueOn: "2026-12-19" });
  });

  it("dues a request asked for just after Manila midnight from that day", async () => {
    // 00:30 on 20 Nov in Manila, still the 19th in UTC.
    vi.setSystemTime(new Date("2026-11-19T16:30:00.000Z"));
    const { request } = await seam.requestPrivacy(BEA.userId, "data-copy");
    expect(request.dueOn).toBe("2026-11-27");
  });

  it("gives the open request again, making nothing, when the Member asks twice", async () => {
    const first = await seam.requestPrivacy(BEA.userId, "deletion");
    vi.setSystemTime(new Date(BOOT.getTime() + 60 * 60_000));

    const again = await seam.requestPrivacy(BEA.userId, "deletion");

    expect(again).toEqual({ request: first.request, created: false });
    expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([first.request]);
    expect(await arm.privacyRequests()).toHaveLength(1);
  });

  it("keeps one of each type open together, oldest first", async () => {
    const copy = await seam.requestPrivacy(BEA.userId, "data-copy");
    vi.setSystemTime(new Date(BOOT.getTime() + 60_000));
    const deletion = await seam.requestPrivacy(BEA.userId, "deletion");

    expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([
      copy.request,
      deletion.request,
    ]);
  });

  it("makes a new request once the last one of its type is done", async () => {
    const first = await seam.requestPrivacy(BEA.userId, "data-copy");
    await arm.finishPrivacyRequest(first.request.id);
    expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([]);

    const next = await seam.requestPrivacy(BEA.userId, "data-copy");

    expect(next.created).toBe(true);
    expect(next.request.id).not.toBe(first.request.id);
    expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([next.request]);
  });

  describe("one Member and another", () => {
    it("never gives one Member another's requests", async () => {
      await seam.requestPrivacy(BEA.userId, "data-copy");
      expect(await seam.listOpenPrivacyRequests(SAM.userId)).toEqual([]);
    });

    it("makes a Member their own request, though another's of the type is open", async () => {
      const bea = await seam.requestPrivacy(BEA.userId, "deletion");
      const sam = await seam.requestPrivacy(SAM.userId, "deletion");

      expect(sam.created).toBe(true);
      expect(sam.request).toMatchObject({ userId: SAM.userId, type: "deletion" });
      expect(sam.request.id).not.toBe(bea.request.id);
      expect(await seam.listOpenPrivacyRequests(BEA.userId)).toEqual([bea.request]);
    });
  });

  it("throws for a User id that isn't one, a type that isn't one, and a User who isn't a Member", async () => {
    await expect(seam.listOpenPrivacyRequests("not-a-uuid")).rejects.toThrow();
    await expect(seam.requestPrivacy("not-a-uuid", "data-copy")).rejects.toThrow();
    await expect(
      seam.requestPrivacy(BEA.userId, "everything" as unknown as "data-copy"),
    ).rejects.toThrow();
    await expect(
      seam.requestPrivacy("3f1a5c2e-9b7d-4e6f-8a1b-2c3d4e5f6a7b", "deletion"),
    ).rejects.toThrow();
    expect(await arm.privacyRequests()).toEqual([]);
  });
});
