import { describe, expect, it } from "vitest";

import { buildMemberDataExport, type MemberDataSource, memberDataFilename } from "./data-export";

// A Member's data copy (spec, Phase 3 planning decisions → Privacy Requests
// in the Admin; story 133q): everything kept about one Member, as the JSON
// file an Owner downloads and emails from the support inbox. Built from every
// Member's records, it keeps only the Member's own, without their User id on
// each, and without what isn't theirs: the device token's hash, and who on
// the staff granted a pass.

const BEA = "8f4b1f0e-6c1d-4c8e-9a51-0d6f3a5b7c21";
const SAM = "1c9d7e52-3b0a-4f6e-8d2c-5a4b3c2d1e0f";
// 10:00 on 20 Nov 2026 in Manila.
const NOW = new Date("2026-11-20T02:00:00.000Z");

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
      },
      {
        id: "notice-sam",
        userId: SAM,
        examCode: "CE",
        kind: "granted",
        endsAt: "2027-03-01T00:00:00.000Z",
        createdAt: "2026-11-04T00:00:00.000Z",
        dismissedAt: null,
      },
    ],
  };
}

describe("buildMemberDataExport", () => {
  it("gives every section of the Member's data, and only theirs", () => {
    expect(buildMemberDataExport(bothMembers(), NOW)).toEqual({
      format: "ayc-member-data",
      version: 1,
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
        },
      ],
    });
  });

  it("never names another Member, or who on the staff granted a pass", () => {
    const file = JSON.stringify(buildMemberDataExport(bothMembers(), NOW));
    expect(file).not.toContain(SAM);
    expect(file).not.toContain("Sam's grant");
    expect(file).not.toContain("attempt-sam");
    expect(file).not.toContain("notice-sam");
    expect(file).not.toContain("Firefox on Windows");
    expect(file).not.toContain("angel@aceyourcourse.ph");
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
