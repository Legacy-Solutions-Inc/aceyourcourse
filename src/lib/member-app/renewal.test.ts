import { describe, expect, it } from "vitest";

import {
  renewalBanner,
  renewalDismissalDay,
  renewalReminders,
  type RenewalInputs,
} from "./renewal";

// The renewal reminders (Phase 4, ticket 12; spec, Phase 4 → Renewal nudges,
// Phase 4 planning decisions → Renewal reminders; stories 141 and 142), pure.
// One per Exam whose Access Pass (paid or granted) ends within the next 7
// Manila days, framed around the Exam Date; dismissed until the next Manila
// day; never for Staff.
//
// "Now" is 17 Nov 2026, 10:00 in Manila (02:00 UTC) unless it says otherwise.
const NOW = new Date("2026-11-17T02:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number, from = NOW) => new Date(from.getTime() + days * DAY).toISOString();

/** A CE pass ending in 5 days (22 Nov), its Exam Date 27 days after that. */
const BASE: RenewalInputs = {
  passes: [{ examCode: "CE", endsAt: inDays(5) }],
  exams: [{ examCode: "CE", examDate: "2026-12-19" }],
  dismissals: [],
  activeStaff: false,
  now: NOW,
};
const remind = (changes: Partial<RenewalInputs>) => renewalReminders({ ...BASE, ...changes });
const texts = (changes: Partial<RenewalInputs>) =>
  remind(changes).map((reminder) => renewalBanner(reminder, plansFor("CE")).text);
/** The unlock route of an Exam with a Plan on sale. */
const plansFor = (examCode: string) => ({
  kind: "plans" as const,
  href: `/app/plans?exam=${examCode}`,
});

describe("renewalReminders", () => {
  it("reminds a Member whose pass ends in 5 days, 27 days before their exam", () => {
    expect(remind({})).toEqual([{ examCode: "CE", endsAt: inDays(5), daysBeforeExam: 27 }]);
  });

  it("reminds on a pass ending in exactly 7 days, and not one ending in 8", () => {
    expect(remind({ passes: [{ examCode: "CE", endsAt: inDays(7) }] })).toHaveLength(1);
    expect(remind({ passes: [{ examCode: "CE", endsAt: inDays(8) }] })).toEqual([]);
  });

  it("reminds on a pass ending later today", () => {
    expect(
      remind({ passes: [{ examCode: "CE", endsAt: "2026-11-17T15:59:00.000Z" }] }),
    ).toHaveLength(1);
  });

  it("never reminds on a pass that has already ended, the instant it ends too", () => {
    expect(remind({ passes: [{ examCode: "CE", endsAt: inDays(-1) }] })).toEqual([]);
    expect(remind({ passes: [{ examCode: "CE", endsAt: NOW.toISOString() }] })).toEqual([]);
  });

  it("gives no day count before the exam when the pass ends on or after the Exam Date", () => {
    for (const examDate of ["2026-11-22", "2026-11-20"]) {
      expect(remind({ exams: [{ examCode: "CE", examDate }] })).toEqual([
        { examCode: "CE", endsAt: inDays(5), daysBeforeExam: null },
      ]);
    }
  });

  it("gives no day count before the exam with no Exam Date, or when the Exam isn't a Target Exam", () => {
    expect(remind({ exams: [{ examCode: "CE", examDate: null }] })[0]?.daysBeforeExam).toBeNull();
    expect(remind({ exams: [] })[0]?.daysBeforeExam).toBeNull();
  });

  it("reminds once per Exam, soonest first", () => {
    expect(
      remind({
        passes: [
          { examCode: "CE", endsAt: inDays(5) },
          { examCode: "ME", endsAt: inDays(2) },
          { examCode: "EE", endsAt: inDays(30) },
        ],
        exams: [
          { examCode: "CE", examDate: "2026-12-19" },
          { examCode: "ME", examDate: null },
        ],
      }),
    ).toEqual([
      { examCode: "ME", endsAt: inDays(2), daysBeforeExam: null },
      { examCode: "CE", endsAt: inDays(5), daysBeforeExam: 27 },
    ]);
  });

  it("hides an Exam's reminder dismissed today, and only that Exam's", () => {
    const passes = [
      { examCode: "CE", endsAt: inDays(5) },
      { examCode: "ME", endsAt: inDays(3) },
    ];
    expect(
      remind({ passes, dismissals: [{ examCode: "CE", day: "2026-11-17" }] }).map(
        (reminder) => reminder.examCode,
      ),
    ).toEqual(["ME"]);
  });

  it("brings a dismissed reminder back the next Manila day", () => {
    expect(remind({ dismissals: [{ examCode: "CE", day: "2026-11-16" }] })).toHaveLength(1);
  });

  it("never reminds Staff", () => {
    expect(remind({ activeStaff: true })).toEqual([]);
  });

  it("matches a pass to its Exam Date and dismissal whatever the case of the code", () => {
    expect(
      remind({
        passes: [{ examCode: "ce", endsAt: inDays(5) }],
        dismissals: [{ examCode: "CE", day: "2026-11-16" }],
      })[0]?.daysBeforeExam,
    ).toBe(27);
    expect(remind({ dismissals: [{ examCode: "ce", day: "2026-11-17" }] })).toEqual([]);
  });

  describe("across Manila midnight", () => {
    it("counts the 7 days in Manila days: 23:59 on the 7th Manila day shows, 00:30 on the 8th doesn't", () => {
      // 23:30 on 17 Nov in Manila, still 17 Nov in UTC.
      const lateEvening = new Date("2026-11-17T15:30:00.000Z");
      // 00:30 on 25 Nov in Manila, 24 Nov in UTC: 7 UTC days off, but 8 Manila days.
      expect(
        remind({
          now: lateEvening,
          passes: [{ examCode: "CE", endsAt: "2026-11-24T16:30:00.000Z" }],
        }),
      ).toEqual([]);
      // 00:30 on 17 Nov in Manila, 16 Nov in UTC; the end is 23:30 on 24 Nov in
      // Manila: 8 UTC days off, but 7 Manila days.
      const pastMidnight = new Date("2026-11-16T16:30:00.000Z");
      expect(
        remind({
          now: pastMidnight,
          passes: [{ examCode: "CE", endsAt: "2026-11-24T15:30:00.000Z" }],
        }),
      ).toHaveLength(1);
    });

    it("counts the days before the exam from the end's Manila date", () => {
      // 00:30 on 22 Nov in Manila (21 Nov in UTC): still 27 days before 19 Dec.
      expect(
        remind({ passes: [{ examCode: "CE", endsAt: "2026-11-21T16:30:00.000Z" }] })[0]
          ?.daysBeforeExam,
      ).toBe(27);
    });

    it("brings a reminder dismissed at 23:30 back at 00:30, the next Manila day", () => {
      const dismissedAt = new Date("2026-11-17T15:30:00.000Z");
      const dismissals = [{ examCode: "CE", day: renewalDismissalDay(dismissedAt) }];
      expect(remind({ now: dismissedAt, dismissals })).toEqual([]);
      // 00:30 on 18 Nov in Manila, still 17 Nov in UTC.
      expect(remind({ now: new Date("2026-11-17T16:30:00.000Z"), dismissals })).toHaveLength(1);
    });
  });
});

describe("renewalDismissalDay", () => {
  it("is the Manila date of the dismissal", () => {
    expect(renewalDismissalDay(NOW)).toBe("2026-11-17");
    expect(renewalDismissalDay(new Date("2026-11-17T16:30:00.000Z"))).toBe("2026-11-18");
  });
});

describe("renewalBanner", () => {
  it("frames a pass ending before the exam around it, renewing from that Exam's Plans", () => {
    expect(
      renewalBanner({ examCode: "CE", endsAt: inDays(5), daysBeforeExam: 27 }, plansFor("CE")),
    ).toEqual({
      examCode: "CE",
      text: "Your CE All-Access ends 22 Nov, 27 days before your exam",
      renew: { kind: "plans", label: "Renew to cover your exam", href: "/app/plans?exam=CE" },
    });
  });

  it("says 1 day before the exam", () => {
    expect(texts({ exams: [{ examCode: "CE", examDate: "2026-11-23" }] })).toEqual([
      "Your CE All-Access ends 22 Nov, 1 day before your exam",
    ]);
  });

  it("gives the plain wording and “Renew access” on or after the Exam Date, or with none", () => {
    expect(
      renewalBanner({ examCode: "ME", endsAt: inDays(5), daysBeforeExam: null }, plansFor("ME")),
    ).toEqual({
      examCode: "ME",
      text: "Your ME All-Access ends 22 Nov",
      renew: { kind: "plans", label: "Renew access", href: "/app/plans?exam=ME" },
    });
  });

  it("asks AYC instead while the Exam has no Plan on sale", () => {
    expect(
      renewalBanner(
        { examCode: "CE", endsAt: inDays(5), daysBeforeExam: 27 },
        { kind: "contact", contactEmail: "hello@example.com" },
      ).renew,
    ).toEqual({ kind: "contact", contactEmail: "hello@example.com" });
  });

  it("dates the end on its Manila day", () => {
    // 00:30 on 22 Nov in Manila, 21 Nov in UTC.
    expect(
      renewalBanner(
        { examCode: "CE", endsAt: "2026-11-21T16:30:00.000Z", daysBeforeExam: null },
        plansFor("CE"),
      ).text,
    ).toBe("Your CE All-Access ends 22 Nov");
  });
});
