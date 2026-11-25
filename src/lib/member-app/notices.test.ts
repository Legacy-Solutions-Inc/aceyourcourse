import { describe, expect, it } from "vitest";

import { noticesToShow, noticeText } from "@/lib/member-app/notices";
import type { MemberNotice } from "@/services/member.types";

// The Member App's in-app notices (spec, Phase 3 planning decisions → In-app
// notices): one dismissible banner per notice, for a grant, an extension or
// the end of access. No email, and no notification centre. A full refund in
// PayMongo leaves one too (Phase 4, ticket 09), naming the Order.

const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";

function notice(overrides: Partial<MemberNotice>): MemberNotice {
  return {
    id: "6a0c8f8e-3f43-4c4a-9d5e-0b2f6c1d7e01",
    userId: BEA,
    examCode: "CE",
    kind: "granted",
    endsAt: "2026-12-19T04:00:00.000Z",
    createdAt: "2026-11-19T04:00:00.000Z",
    dismissedAt: null,
    reference: null,
    ...overrides,
  };
}

describe("noticeText", () => {
  it("says a grant gives All-Access until its end, in Manila", () => {
    expect(noticeText(notice({ kind: "granted" }))).toBe(
      "You now have CE All-Access until 19 Dec 2026",
    );
  });

  it("says an extension moved the end", () => {
    expect(noticeText(notice({ kind: "extended", endsAt: "2026-12-26T04:00:00.000Z" }))).toBe(
      "Your CE access was extended to 26 Dec 2026",
    );
  });

  it("says access has ended", () => {
    expect(noticeText(notice({ kind: "ended", examCode: "ME" }))).toBe("Your ME access has ended");
  });

  it("says a refund was processed and when the pass now ends (ticket 09)", () => {
    expect(
      noticeText(
        notice({ kind: "refunded", reference: "AYC-10483", endsAt: "2026-12-19T04:00:00.000Z" }),
      ),
    ).toBe("Your refund for AYC-10483 was processed. CE All-Access now ends 19 Dec 2026");
  });

  it("says the pass has ended when the refund ended it then", () => {
    expect(
      noticeText(
        notice({
          kind: "refunded",
          reference: "AYC-10483",
          endsAt: "2026-11-19T04:00:00.000Z",
          createdAt: "2026-11-19T04:00:00.000Z",
        }),
      ),
    ).toBe("Your refund for AYC-10483 was processed. CE All-Access has ended");
  });

  it("says the pass has ended when it had ended before the refund", () => {
    expect(
      noticeText(
        notice({
          kind: "refunded",
          reference: "AYC-10483",
          endsAt: "2026-11-10T04:00:00.000Z",
          createdAt: "2026-11-19T04:00:00.000Z",
        }),
      ),
    ).toBe("Your refund for AYC-10483 was processed. CE All-Access has ended");
  });

  it("dates a refund's end in Manila, the next day there just after midnight", () => {
    expect(
      noticeText(
        notice({ kind: "refunded", reference: "AYC-10483", endsAt: "2026-12-19T16:30:00.000Z" }),
      ),
    ).toBe("Your refund for AYC-10483 was processed. CE All-Access now ends 20 Dec 2026");
  });

  it("dates the end in Manila, the next day there just after midnight", () => {
    // 16:30 UTC on 19 Dec is 00:30 on 20 Dec in Manila.
    expect(noticeText(notice({ endsAt: "2026-12-19T16:30:00.000Z" }))).toBe(
      "You now have CE All-Access until 20 Dec 2026",
    );
  });
});

describe("noticesToShow", () => {
  const first = notice({ id: "n1", createdAt: "2026-11-19T04:00:00.000Z" });
  const second = notice({
    id: "n2",
    kind: "extended",
    endsAt: "2026-12-26T04:00:00.000Z",
    createdAt: "2026-11-19T05:00:00.000Z",
  });
  const me = notice({ id: "n3", examCode: "ME", createdAt: "2026-11-19T04:30:00.000Z" });

  it("shows nothing when there are no notices", () => {
    expect(noticesToShow([])).toEqual([]);
  });

  it("shows every notice, newest first, each Exam's too", () => {
    expect(noticesToShow([first, me, second]).map(({ id }) => id)).toEqual(["n2", "n3", "n1"]);
  });

  it("leaves out a dismissed notice, and only that one", () => {
    const dismissed = { ...second, dismissedAt: "2026-11-19T06:00:00.000Z" };
    expect(noticesToShow([first, me, dismissed]).map(({ id }) => id)).toEqual(["n3", "n1"]);
  });
});
