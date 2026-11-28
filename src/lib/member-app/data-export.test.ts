import { describe, expect, it } from "vitest";

import type { Order } from "@/lib/payments/order-ledger";

import { buildMemberDataExport, type MemberDataSource, memberDataFilename } from "./data-export";

// A Member's data copy (spec, Phase 3 planning decisions → Privacy Requests
// in the Admin; story 133q): everything kept about one Member, as the JSON
// file an Owner downloads and emails from the support inbox. Built from every
// Member's records, it keeps only the Member's own, without their User id on
// each, and without what isn't theirs: the device token's hash, and who on
// the staff granted a pass. Version 2 (Phase 4, ticket 14) added the Orders,
// version 3 (Phase 5, ticket 07) the Courses owned and Lesson progress; each
// version only adds sections, so a reader of an older file reads a newer one.

const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";
const SAM = "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f";
// 10:00 on 20 Nov 2026 in Manila.
const NOW = new Date("2026-11-20T02:00:00.000Z");

/** An Order of `userId`'s (Phase 4, ticket 14): CE 3 months by GCash, live, Paid. */
const order = (userId: string, reference: string, fields: Partial<Order> = {}): Order => ({
  id: `order-${reference}`,
  reference,
  userId,
  examCode: "CE",
  planId: "plan-ce-90",
  courseId: null,
  planName: "CE All-Access",
  days: 90,
  priceCentavos: 129_900,
  method: "gcash",
  status: "paid",
  livemode: true,
  checkoutId: `cs_${reference}`,
  paymentId: `pay_${reference}`,
  buyerName: "Bea Tester",
  buyerEmail: "tester@example.com",
  createdAt: "2026-11-08T01:00:00.000Z",
  paidAt: "2026-11-08T01:02:00.000Z",
  statusChangedAt: "2026-11-08T01:02:00.000Z",
  paidWithoutAccount: false,
  paidAlreadyOwned: false,
  ...fields,
});

/** Bea's records and Sam's, side by side, as the sample data holds them. */
function bothMembers(): MemberDataSource {
  return {
    member: {
      userId: BEA,
      email: "tester@example.com",
      name: "Bea Tester",
      joinedAt: "2026-11-01T01:00:00.000Z",
    },
    selectedExamCode: "CE",
    targetExams: [
      {
        examCode: "CE",
        memberExamDate: null,
        addedAt: "2026-11-01T01:05:00.000Z",
        removedAt: null,
      },
      {
        examCode: "ME",
        memberExamDate: "2027-04-20",
        addedAt: "2026-11-02T01:05:00.000Z",
        removedAt: "2026-11-03T01:05:00.000Z",
      },
    ],
    activeDevice: { deviceLabel: "Chrome on Android", claimedAt: "2026-11-10T01:00:00.000Z" },
    consents: [
      {
        userId: SAM,
        termsVersion: "2.0",
        privacyVersion: "2.0",
        agreedAt: "2026-11-01T00:00:00.000Z",
      },
      {
        userId: BEA,
        termsVersion: "2.0",
        privacyVersion: "2.0",
        agreedAt: "2026-11-01T01:01:00.000Z",
      },
    ],
    accessPasses: [
      { userId: BEA, examCode: "CE", endsAt: "2027-02-01T00:00:00.000Z" },
      { userId: SAM, examCode: "CE", endsAt: "2027-03-01T00:00:00.000Z" },
    ],
    accessPassGrants: [
      {
        userId: BEA,
        examCode: "CE",
        days: 90,
        startsAt: "2026-11-03T00:00:00.000Z",
        endsAt: "2027-02-01T00:00:00.000Z",
        reason: "Beta tester",
        grantedBy: { email: "angel@aceyourcourse.ph", name: "Angel Reyes" },
        grantedAt: "2026-11-03T00:00:00.000Z",
        orderId: null,
      },
      {
        userId: SAM,
        examCode: "CE",
        days: 30,
        startsAt: "2026-11-04T00:00:00.000Z",
        endsAt: "2027-03-01T00:00:00.000Z",
        reason: "Sam's grant",
        grantedBy: { email: "angel@aceyourcourse.ph", name: "Angel Reyes" },
        grantedAt: "2026-11-04T00:00:00.000Z",
        orderId: null,
      },
    ],
    cardMarks: [
      { userId: BEA, cardId: "card-1", verdict: "got", markedAt: "2026-11-05T01:00:00.000Z" },
      { userId: SAM, cardId: "card-1", verdict: "again", markedAt: "2026-11-05T02:00:00.000Z" },
    ],
    quizAttempts: [
      {
        id: "attempt-sam",
        userId: SAM,
        quizId: "quiz-1",
        submittedAt: "2026-11-06T01:00:00.000Z",
        correctCount: 1,
        questionCount: 2,
        score: 50,
        passingScore: 70,
        answers: [],
      },
      {
        id: "attempt-bea",
        userId: BEA,
        quizId: "quiz-1",
        submittedAt: "2026-11-06T02:00:00.000Z",
        correctCount: 2,
        questionCount: 2,
        score: 100,
        passingScore: 70,
        answers: [{ questionId: "q-1", choice: "A", isCorrect: true }],
      },
    ],
    reviewerPageViews: [
      { userId: BEA, reviewerPdfId: "pdf-1", page: 2, viewedAt: "2026-11-07T01:00:00.000Z" },
      { userId: SAM, reviewerPdfId: "pdf-1", page: 1, viewedAt: "2026-11-07T02:00:00.000Z" },
    ],
    studyDays: [
      { userId: SAM, day: "2026-11-05" },
      { userId: BEA, day: "2026-11-05" },
      { userId: BEA, day: "2026-11-06" },
    ],
    deckPositions: [
      { userId: BEA, deckId: "deck-1", cardId: "card-1", savedAt: "2026-11-05T01:00:00.000Z" },
      { userId: SAM, deckId: "deck-1", cardId: "card-2", savedAt: "2026-11-05T02:00:00.000Z" },
    ],
    readerPositions: [
      {
        userId: SAM,
        reviewerPdfId: "pdf-1",
        page: 1,
        zoom: 100,
        savedAt: "2026-11-07T02:00:00.000Z",
      },
      {
        userId: BEA,
        reviewerPdfId: "pdf-1",
        page: 2,
        zoom: 125,
        savedAt: "2026-11-07T01:00:00.000Z",
      },
    ],
    deviceSwitches: [
      { userId: BEA, deviceLabel: "Safari on iOS", switchedAt: "2026-11-02T01:00:00.000Z" },
      { userId: SAM, deviceLabel: "Firefox on Windows", switchedAt: "2026-11-02T02:00:00.000Z" },
      { userId: BEA, deviceLabel: "Chrome on Android", switchedAt: "2026-11-10T01:00:00.000Z" },
    ],
    notices: [
      {
        id: "notice-bea",
        userId: BEA,
        examCode: "CE",
        kind: "granted",
        endsAt: "2027-02-01T00:00:00.000Z",
        createdAt: "2026-11-03T00:00:00.000Z",
        dismissedAt: "2026-11-03T01:00:00.000Z",
        reference: null,
        courseTitle: null,
      },
      {
        id: "notice-sam",
        userId: SAM,
        examCode: "CE",
        kind: "granted",
        endsAt: "2027-03-01T00:00:00.000Z",
        createdAt: "2026-11-04T00:00:00.000Z",
        dismissedAt: null,
        reference: null,
        courseTitle: null,
      },
    ],
    // Newest first, as the Admin reads them (ticket 14).
    orders: [
      {
        // Made 25 hours ago and never confirmed: every screen shows it Expired.
        order: order(BEA, "AYC-10003", {
          status: "pending",
          method: "maya",
          checkoutId: null,
          paymentId: null,
          createdAt: "2026-11-19T01:00:00.000Z",
          paidAt: null,
          statusChangedAt: "2026-11-19T01:00:00.000Z",
        }),
        invoice: null,
        refunds: [],
      },
      {
        order: order(SAM, "AYC-10002", { buyerName: null, buyerEmail: "stranger@example.com" }),
        invoice: null,
        refunds: [],
      },
      {
        order: order(BEA, "AYC-10001"),
        invoice: {
          orderId: "order-AYC-10001",
          name: "Sample Builders Inc.",
          address: "12 Sample St, Jaro, Iloilo City",
          tin: "123-456-789-000",
          requestedAt: "2026-11-09T01:00:00.000Z",
          sentAt: "2026-11-10T01:00:00.000Z",
          sentBy: { email: "angel@aceyourcourse.ph", name: "Angel" },
        },
        refunds: [
          {
            id: "ref_pending",
            orderId: "order-AYC-10001",
            amountCentavos: 10_000,
            status: "pending",
            refundedAt: null,
          },
          {
            id: "ref_done",
            orderId: "order-AYC-10001",
            amountCentavos: 30_000,
            status: "succeeded",
            refundedAt: "2026-11-11T01:00:00.000Z",
          },
        ],
      },
    ],
    // Version 3 (Phase 5, ticket 07): the Courses owned, and Lesson progress.
    courseOwnerships: [
      {
        userId: BEA,
        courseId: "course-hpge",
        title: "HPGE Crash Course",
        examCode: "CE",
        since: "2026-11-12T01:00:00.000Z",
        orderReference: null,
      },
      {
        userId: SAM,
        courseId: "course-psad",
        title: "PSAD Masterclass",
        examCode: "CE",
        since: "2026-11-09T07:30:00.000Z",
        orderReference: "AYC-10002",
      },
      {
        userId: BEA,
        courseId: "course-psad",
        title: "PSAD Masterclass",
        examCode: "CE",
        since: "2026-11-08T01:02:00.000Z",
        orderReference: "AYC-10001",
      },
    ],
    lessonProgress: [
      {
        userId: BEA,
        lessonId: "lesson-curves",
        positionSeconds: 140,
        furthestSeconds: 600,
        doneAt: "2026-11-13T01:10:00.000Z",
        watchedAt: "2026-11-14T01:00:00.000Z",
      },
      {
        userId: SAM,
        lessonId: "lesson-sam",
        positionSeconds: 10,
        furthestSeconds: 10,
        doneAt: null,
        watchedAt: "2026-11-13T02:00:00.000Z",
      },
      {
        userId: BEA,
        lessonId: "lesson-leveling",
        positionSeconds: 30,
        furthestSeconds: 30,
        doneAt: null,
        watchedAt: "2026-11-13T01:00:00.000Z",
      },
    ],
  };
}

describe("buildMemberDataExport", () => {
  it("gives every section of the Member's data, and only theirs", () => {
    expect(buildMemberDataExport(bothMembers(), NOW)).toEqual({
      format: "ayc-member-data",
      // Version 2 added the Member's Orders (ticket 14), version 3 their Courses and
      // Lesson progress (Phase 5, ticket 07); every other section is as version 1's.
      version: 3,
      exportedAt: NOW.toISOString(),
      profile: {
        userId: BEA,
        email: "tester@example.com",
        name: "Bea Tester",
        joinedAt: "2026-11-01T01:00:00.000Z",
        selectedExamCode: "CE",
      },
      targetExams: [
        {
          examCode: "CE",
          memberExamDate: null,
          addedAt: "2026-11-01T01:05:00.000Z",
          removedAt: null,
        },
        {
          examCode: "ME",
          memberExamDate: "2027-04-20",
          addedAt: "2026-11-02T01:05:00.000Z",
          removedAt: "2026-11-03T01:05:00.000Z",
        },
      ],
      consents: [
        { termsVersion: "2.0", privacyVersion: "2.0", agreedAt: "2026-11-01T01:01:00.000Z" },
      ],
      accessPasses: [
        {
          examCode: "CE",
          endsAt: "2027-02-01T00:00:00.000Z",
          grants: [
            {
              days: 90,
              startsAt: "2026-11-03T00:00:00.000Z",
              endsAt: "2027-02-01T00:00:00.000Z",
              reason: "Beta tester",
              grantedAt: "2026-11-03T00:00:00.000Z",
            },
          ],
        },
      ],
      cardMarks: [{ cardId: "card-1", verdict: "got", markedAt: "2026-11-05T01:00:00.000Z" }],
      quizAttempts: [
        {
          id: "attempt-bea",
          quizId: "quiz-1",
          submittedAt: "2026-11-06T02:00:00.000Z",
          correctCount: 2,
          questionCount: 2,
          score: 100,
          passingScore: 70,
          answers: [{ questionId: "q-1", choice: "A", isCorrect: true }],
        },
      ],
      reviewerPagesViewed: [
        { reviewerPdfId: "pdf-1", page: 2, viewedAt: "2026-11-07T01:00:00.000Z" },
      ],
      studyDays: ["2026-11-05", "2026-11-06"],
      resume: {
        decks: [{ deckId: "deck-1", cardId: "card-1", savedAt: "2026-11-05T01:00:00.000Z" }],
        reviewerPdfs: [
          { reviewerPdfId: "pdf-1", page: 2, zoom: 125, savedAt: "2026-11-07T01:00:00.000Z" },
        ],
      },
      devices: {
        activeDevice: { deviceLabel: "Chrome on Android", claimedAt: "2026-11-10T01:00:00.000Z" },
        switches: [
          { deviceLabel: "Safari on iOS", switchedAt: "2026-11-02T01:00:00.000Z" },
          { deviceLabel: "Chrome on Android", switchedAt: "2026-11-10T01:00:00.000Z" },
        ],
      },
      notices: [
        {
          id: "notice-bea",
          examCode: "CE",
          kind: "granted",
          endsAt: "2027-02-01T00:00:00.000Z",
          createdAt: "2026-11-03T00:00:00.000Z",
          dismissedAt: "2026-11-03T01:00:00.000Z",
          // A refund's notice names its Order (Phase 4, ticket 09), a Course's its
          // Course (Phase 5, ticket 07); this one is a grant.
          reference: null,
          courseTitle: null,
        },
      ],
      // Oldest first; each as bought, as every screen shows it now, with the
      // refunds that went through and the Invoice Request.
      orders: [
        {
          reference: "AYC-10001",
          examCode: "CE",
          planName: "CE All-Access",
          days: 90,
          priceCentavos: 129_900,
          method: "gcash",
          status: "paid",
          livemode: true,
          createdAt: "2026-11-08T01:00:00.000Z",
          paidAt: "2026-11-08T01:02:00.000Z",
          buyer: { name: "Bea Tester", email: "tester@example.com" },
          payMongoReference: "pay_AYC-10001",
          refunds: [{ amountCentavos: 30_000, refundedAt: "2026-11-11T01:00:00.000Z" }],
          invoiceRequest: {
            name: "Sample Builders Inc.",
            address: "12 Sample St, Jaro, Iloilo City",
            tin: "123-456-789-000",
            requestedAt: "2026-11-09T01:00:00.000Z",
            sentAt: "2026-11-10T01:00:00.000Z",
          },
        },
        {
          reference: "AYC-10003",
          examCode: "CE",
          planName: "CE All-Access",
          days: 90,
          priceCentavos: 129_900,
          method: "maya",
          status: "expired",
          livemode: true,
          createdAt: "2026-11-19T01:00:00.000Z",
          paidAt: null,
          buyer: { name: "Bea Tester", email: "tester@example.com" },
          payMongoReference: null,
          refunds: [],
          invoiceRequest: null,
        },
      ],
      // Oldest first, each with its source: the Paid Order's reference, or none when given.
      courses: [
        {
          courseId: "course-psad",
          title: "PSAD Masterclass",
          examCode: "CE",
          since: "2026-11-08T01:02:00.000Z",
          orderReference: "AYC-10001",
        },
        {
          courseId: "course-hpge",
          title: "HPGE Crash Course",
          examCode: "CE",
          since: "2026-11-12T01:00:00.000Z",
          orderReference: null,
        },
      ],
      // Oldest watched first.
      lessonProgress: [
        {
          lessonId: "lesson-leveling",
          positionSeconds: 30,
          furthestSeconds: 30,
          doneAt: null,
          watchedAt: "2026-11-13T01:00:00.000Z",
        },
        {
          lessonId: "lesson-curves",
          positionSeconds: 140,
          furthestSeconds: 600,
          doneAt: "2026-11-13T01:10:00.000Z",
          watchedAt: "2026-11-14T01:00:00.000Z",
        },
      ],
    });
  });

  it("keeps every section a version 1 or 2 file had, so their readers read version 3", () => {
    const file = buildMemberDataExport(bothMembers(), NOW);
    // Version 1's sections (ticket 19), then version 2's Orders (ticket 14).
    const VERSION_1 = [
      "format",
      "version",
      "exportedAt",
      "profile",
      "targetExams",
      "consents",
      "accessPasses",
      "cardMarks",
      "quizAttempts",
      "reviewerPagesViewed",
      "studyDays",
      "resume",
      "devices",
      "notices",
    ];
    const VERSION_2 = [...VERSION_1, "orders"];

    expect(Object.keys(file)).toEqual([...VERSION_2, "courses", "lessonProgress"]);
    // A version 2 Order is read the same: every field it had, as it had it.
    expect(Object.keys(file.orders[0] ?? {})).toEqual([
      "reference",
      "examCode",
      "planName",
      "days",
      "priceCentavos",
      "method",
      "status",
      "livemode",
      "createdAt",
      "paidAt",
      "buyer",
      "payMongoReference",
      "refunds",
      "invoiceRequest",
    ]);
  });

  it("never names another Member, or who on the staff granted a pass", () => {
    const file = JSON.stringify(buildMemberDataExport(bothMembers(), NOW));
    expect(file).not.toContain(SAM);
    expect(file).not.toContain("Sam's grant");
    expect(file).not.toContain("attempt-sam");
    expect(file).not.toContain("notice-sam");
    expect(file).not.toContain("Firefox on Windows");
    expect(file).not.toContain("angel@aceyourcourse.ph");
    // Sam's Order, and who on the staff marked an invoice sent (ticket 14).
    expect(file).not.toContain("AYC-10002");
    expect(file).not.toContain("stranger@example.com");
    expect(file).not.toContain('"Angel"');
    // Sam's Course and Lesson progress (Phase 5, ticket 07).
    expect(file).not.toContain("lesson-sam");
    expect(file).not.toContain("2026-11-09T07:30:00.000Z");
  });

  it("gives a Member with nothing kept yet every section, empty", () => {
    const source = bothMembers();
    const empty: MemberDataSource = {
      ...source,
      member: { ...source.member, userId: "0c0ffee0-0000-4000-8000-000000000000", name: null },
      selectedExamCode: null,
      targetExams: [],
      activeDevice: null,
    };

    expect(buildMemberDataExport(empty, NOW)).toMatchObject({
      profile: { name: null, selectedExamCode: null },
      targetExams: [],
      consents: [],
      accessPasses: [],
      cardMarks: [],
      quizAttempts: [],
      reviewerPagesViewed: [],
      studyDays: [],
      resume: { decks: [], reviewerPdfs: [] },
      devices: { activeDevice: null, switches: [] },
      notices: [],
      orders: [],
      courses: [],
      lessonProgress: [],
    });
  });

  it("puts each list in time order, whatever order the records came in", () => {
    const source = bothMembers();
    const shuffled: MemberDataSource = {
      ...source,
      deviceSwitches: [...source.deviceSwitches].reverse(),
      studyDays: [...source.studyDays].reverse(),
    };

    const file = buildMemberDataExport(shuffled, NOW);
    expect(file.devices.switches.map(({ deviceLabel }) => deviceLabel)).toEqual([
      "Safari on iOS",
      "Chrome on Android",
    ]);
    expect(file.studyDays).toEqual(["2026-11-05", "2026-11-06"]);
  });
});

describe("memberDataFilename", () => {
  it("names the file by the Manila day and the start of the Member's id, never their email", () => {
    expect(memberDataFilename(BEA, NOW)).toBe("ayc-member-data-2026-11-20-8f4b1f0e.json");
  });

  it("counts the day in Manila", () => {
    // 00:30 on 21 Nov in Manila, still the 20th in UTC.
    expect(memberDataFilename(BEA, new Date("2026-11-20T16:30:00.000Z"))).toBe(
      "ayc-member-data-2026-11-21-8f4b1f0e.json",
    );
  });
});
