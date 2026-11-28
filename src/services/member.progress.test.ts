import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberAccess } from "@/lib/member-app/access";
import type { QuizChoice } from "@/lib/quizzes/quiz-rules";
import type { AdminCard, AdminQuestion } from "@/services/admin.types";
import { sampleContentId, sampleTopicId } from "@/services/mock/content";
import { sampleUserId } from "@/services/mock/members";
import { createFakeRenderer, fakeStamper } from "@/services/page-images.fake";

import { sampleActor } from "../../test/admin-inputs";
import { MEMBER_ARMS } from "../../test/member-arms";
import { pdfOfPages } from "../../test/reviewer-pdfs";

// ─────────────────────────────────────────────────────────────────────────────
// A Member's progress through the Member seam (spec, Phase 3 → Progress
// calculator, Progress storage, Resume, Corrections never cost progress;
// stories 88–93), run against every arm: the dashboard's read and the
// Library's per-Topic %, made by the pure calculator
// (src/lib/member-app/progress.ts, whose rules progress.test.ts covers) from
// the Member's own records, written here through the study calls as the
// Member App writes them.
// The sample CE content: MSTC's Simple Curves has a Visible, Free Preview
// deck, a Visible quiz and a Published Reviewer PDF with no pages (from
// before uploads); Spiral Curves a Visible deck, a Hidden quiz and a Draft
// Reviewer PDF; Surveying nothing, until an Editor places a 4-page upload
// there; Algebra a Hidden deck. HPGE's Topics have nothing to study yet (no
// cards, questions or pages). Decks and quizzes start empty, so each test
// has an Editor write what it needs. It's 17 Nov 2026, 11:42 in Manila. The
// tester's CE pass ends 90 days after; the lapsed tester's ended 3 days
// before; the stranger has none.
// ─────────────────────────────────────────────────────────────────────────────

const BOOT = new Date("2026-11-17T03:42:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const EDITOR = sampleActor("editor");

const mstc = (name: string) => sampleTopicId("CE", "MSTC", name);
const SIMPLE_CURVES = mstc("Simple Curves");
const SPIRAL_CURVES = mstc("Spiral Curves");
const SURVEYING = mstc("Surveying");
const ALGEBRA = mstc("Algebra");
const HYDROSTATICS = sampleTopicId("CE", "HPGE", "Hydrostatics");
const PASS_DECK = sampleContentId(SPIRAL_CURVES, "deck");
const QUIZ = sampleContentId(SIMPLE_CURVES, "quiz");

const MEMBERS = {
  tester: { email: "tester@example.com", name: "Bea Tester" },
  lapsed: { email: "lapsed@example.com", name: "Lou Lapsed" },
  stranger: { email: "stranger@example.com", name: "Sam Stranger" },
} as const;
type Who = keyof typeof MEMBERS;
const userOf = (who: Who) => sampleUserId(MEMBERS[who].email);

describe.each(MEMBER_ARMS)("Member seam progress ($name)", (arm) => {
  const { seam } = arm;
  let attempts = 0;

  async function accessOf(who: Who): Promise<MemberAccess> {
    return {
      gate: "open",
      device: "active",
      activeStaff: false,
      passes: (await seam.listAccessPasses(userOf(who))).map(({ examCode, endsAt }) => ({
        examCode,
        endsAt,
      })),
      now: new Date(),
    };
  }

  /** An Editor writes cards in a Topic's deck, in order. */
  async function writeCards(topicId: string, count: number): Promise<AdminCard[]> {
    const cards: AdminCard[] = [];
    for (let index = 1; index <= count; index += 1) {
      const added = await arm.admin.createCard(EDITOR, {
        topic: topicId,
        front: `Card ${index}`,
        back: `Back ${index}`,
        note: "",
      });
      if (!added.ok) throw new Error(`Not added: ${JSON.stringify(added)}`);
      cards.push(added.value);
    }
    return cards;
  }

  /** An Editor writes questions in Simple Curves' quiz, each with A correct. */
  async function writeQuestions(count: number): Promise<AdminQuestion[]> {
    const written: AdminQuestion[] = [];
    for (let index = 1; index <= count; index += 1) {
      const added = await arm.admin.createQuestion(EDITOR, {
        topic: SIMPLE_CURVES,
        question: `Question ${index}`,
        choices: { A: "Right", B: "Wrong", C: "Wrong too", D: "Not this" },
        correct: "A",
        explanation: "Because.",
        figure: null,
      });
      if (!added.ok) throw new Error(`Not added: ${JSON.stringify(added)}`);
      written.push(added.value);
    }
    return written;
  }

  /** An Editor's 4-page upload, split, placed under Surveying and Published. */
  async function publishedReviewer(): Promise<string> {
    const path = await arm.uploadReviewerPdf(pdfOfPages(4));
    const recorded = await arm.admin.recordReviewerPdf(EDITOR, { path, fileName: "Surveying.pdf" });
    if (!recorded.ok) throw new Error("The Reviewer PDF wasn't recorded");
    const { id } = recorded.value;
    while ((await arm.admin.runReviewerPdfJob(id, createFakeRenderer())) === "more");
    const placed = await arm.admin.placeReviewerPdf(EDITOR, { id, topic: SURVEYING });
    if (!placed.ok) throw new Error("The Reviewer PDF wasn't placed");
    await arm.admin.setReviewerPdfPublished(EDITOR, id, true);
    return id;
  }

  async function mark(who: Who, card: AdminCard | undefined, verdict: "got" | "again") {
    const marked = await seam.markCard(
      userOf(who),
      { cardId: card?.id ?? "", verdict },
      await accessOf(who),
    );
    if (!marked.ok) throw new Error(`Not marked: ${JSON.stringify(marked)}`);
  }

  /** Submits Simple Curves' quiz, right (A) on the first `right` questions and wrong after. */
  async function takeQuiz(who: Who, questions: AdminQuestion[], right: number) {
    const answers = questions.map((question, index) => ({
      questionId: question.id,
      choice: (index < right ? "A" : "B") as QuizChoice,
    }));
    const attemptId = `6a1f0e1c-5b55-4a51-9d0e-${(attempts++).toString(16).padStart(12, "0")}`;
    const result = await seam.submitQuiz(
      userOf(who),
      { attemptId, quizId: QUIZ, answers },
      await accessOf(who),
    );
    if (!result.ok) throw new Error(`Not scored: ${JSON.stringify(result)}`);
  }

  async function readPages(who: Who, reviewerPdfId: string, ...pages: number[]) {
    for (const page of pages) {
      const read = await seam.readReviewerPage(
        userOf(who),
        { reviewerPdfId, page },
        await accessOf(who),
        fakeStamper,
      );
      if (read.status !== "page") throw new Error(`Not read: ${read.status}`);
    }
  }

  /**
   * The tester's study in progress: 3 of Spiral Curves' 4 cards Got it and 1
   * Review again, stopped at card 3; 1 of Simple Curves' 2 questions right;
   * Surveying's pages 1 and 2 read, stopped at page 2.
   */
  async function testerStudies() {
    const cards = await writeCards(SPIRAL_CURVES, 4);
    const questions = await writeQuestions(2);
    const reviewer = await publishedReviewer();
    const tester = await accessOf("tester");
    await mark("tester", cards[0], "got");
    await mark("tester", cards[1], "got");
    await mark("tester", cards[2], "again");
    await mark("tester", cards[3], "got");
    await seam.saveDeckPosition(
      userOf("tester"),
      { deckId: PASS_DECK, cardId: cards[2]?.id ?? null },
      tester,
    );
    await takeQuiz("tester", questions, 1);
    await readPages("tester", reviewer, 1, 2);
    await seam.saveReaderPosition(
      userOf("tester"),
      { reviewerPdfId: reviewer, page: 2, zoom: 100 },
      tester,
    );
    return { cards, questions, reviewer };
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BOOT);
    await arm.reset();
    for (const who of Object.keys(MEMBERS) as Who[]) {
      await seam.getOrCreateMember({ userId: userOf(who), ...MEMBERS[who] });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getProgress", () => {
    it("gives the dashboard's numbers for a Member with cards, a quiz and pages in progress", async () => {
      const { reviewer } = await testerStudies();

      const progress = await seam.getProgress(userOf("tester"), "CE");

      expect(progress).toMatchObject({
        started: true,
        cards: { got: 3, total: 4 },
        pages: { viewed: 2, total: 4 },
        quizAverage: 50,
        quizzesTaken: 1,
        streak: { current: 1, best: 1, studiedToday: true, today: "2026-11-17" },
      });
      const [mstcProgress, hpge] = progress.subjects;
      // Simple Curves (its quiz) 50, Spiral Curves (its deck) 75, Surveying (its pages) 50;
      // Algebra's deck is Hidden: (50 + 75 + 50) / 3 = 58.3.
      expect(mstcProgress).toMatchObject({
        code: "MSTC",
        percent: 58,
        cards: { got: 3, total: 4 },
        quizAverage: 50,
      });
      expect(mstcProgress?.topics.map(({ name, percent }) => [name, percent])).toEqual([
        ["Simple Curves", 50],
        ["Spiral Curves", 75],
        ["Surveying", 50],
        ["Algebra", null],
      ]);
      // HPGE's Topics have nothing to study yet.
      expect(hpge).toMatchObject({ code: "HPGE", percent: null, quizAverage: null });
      // Simple Curves' Best Score, 50, is below its passing score, 70.
      expect(progress.weakTopics).toEqual([
        expect.objectContaining({
          id: SIMPLE_CURVES,
          subjectCode: "MSTC",
          percent: 50,
          quiz: { quizId: QUIZ, bestScore: 50, passingScore: 70, attempts: 1 },
        }),
      ]);
      expect(progress.resume).toEqual({
        deck: {
          deckId: PASS_DECK,
          subjectCode: "MSTC",
          topicName: "Spiral Curves",
          card: 3,
          cardCount: 4,
          savedAt: BOOT.toISOString(),
        },
        reviewerPdf: {
          reviewerPdfId: reviewer,
          subjectCode: "MSTC",
          topicName: "Surveying",
          page: 2,
          pageCount: 4,
          savedAt: BOOT.toISOString(),
        },
        // No Lesson watched (ticket 04).
        lesson: null,
      });
    });

    it("counts only a card's latest mark, and the Best Score rather than the latest attempt", async () => {
      const [card] = await writeCards(SPIRAL_CURVES, 1);
      const questions = await writeQuestions(2);
      await mark("tester", card, "got");
      await mark("tester", card, "again");
      await takeQuiz("tester", questions, 2);
      await takeQuiz("tester", questions, 0);

      const progress = await seam.getProgress(userOf("tester"), "CE");

      const topics = progress.subjects[0]?.topics ?? [];
      expect(topics.find(({ id }) => id === SPIRAL_CURVES)?.cards).toMatchObject({
        got: 0,
        again: 1,
      });
      expect(topics.find(({ id }) => id === SIMPLE_CURVES)).toMatchObject({
        percent: 100,
        quiz: { bestScore: 100, attempts: 2 },
        weak: false,
      });
      expect(progress.quizAverage).toBe(100);
    });

    it("never counts one Member's records for another", async () => {
      const cards = await writeCards(SIMPLE_CURVES, 2);
      // The Free Preview deck: the lapsed tester can study it without a pass.
      await mark("lapsed", cards[0], "got");
      await mark("lapsed", cards[1], "got");
      await mark("tester", cards[0], "again");

      const tester = await seam.getProgress(userOf("tester"), "CE");
      const lapsed = await seam.getProgress(userOf("lapsed"), "CE");
      const stranger = await seam.getProgress(userOf("stranger"), "CE");

      expect(tester.cards).toEqual({ got: 0, total: 2 });
      expect(lapsed.cards).toEqual({ got: 2, total: 2 });
      expect(stranger).toMatchObject({
        started: false,
        cards: { got: 0, total: 2 },
        streak: { current: 0, best: 0 },
        resume: { deck: null, reviewerPdf: null },
      });
    });

    it("leaves Hidden and unpublished content out", async () => {
      const { reviewer } = await testerStudies();
      await arm.admin.setDeckVisibility(EDITOR, PASS_DECK, false);
      await arm.admin.setReviewerPdfPublished(EDITOR, reviewer, false);

      const progress = await seam.getProgress(userOf("tester"), "CE");

      expect(progress).toMatchObject({
        cards: { got: 0, total: 0 },
        pages: { viewed: 0, total: 0 },
        resume: { deck: null, reviewerPdf: null },
      });
      // Only Simple Curves' quiz is left to count.
      expect(progress.subjects[0]?.percent).toBe(50);
    });

    it("keeps progress visible once the Member's access has ended", async () => {
      await testerStudies();
      // 100 days later: the tester's CE pass ended 10 days ago.
      vi.setSystemTime(new Date(BOOT.getTime() + 100 * DAY));

      const progress = await seam.getProgress(userOf("tester"), "CE");

      expect(progress).toMatchObject({
        started: true,
        cards: { got: 3, total: 4 },
        quizAverage: 50,
        streak: { current: 0, best: 1, studiedToday: false },
      });
      expect(progress.subjects[0]?.percent).toBe(58);
    });

    it("is per Exam, with the Study Streak account-wide", async () => {
      await testerStudies();

      const ce = await seam.getProgress(userOf("tester"), "CE");
      const me = await seam.getProgress(userOf("tester"), "me");

      expect(me).toMatchObject({
        started: false,
        cards: { got: 0, total: 0 },
        quizAverage: null,
        weakTopics: [],
        resume: { deck: null, reviewerPdf: null },
      });
      expect(me.subjects.map(({ code }) => code)).not.toContain("MSTC");
      expect(me.streak).toEqual(ce.streak);
    });

    it("gives a Member who hasn't studied the starter state, and an Exam that isn't one nothing", async () => {
      await writeCards(SPIRAL_CURVES, 2);

      expect(await seam.getProgress(userOf("tester"), "CE")).toMatchObject({
        started: false,
        cards: { got: 0, total: 2 },
        quizAverage: null,
        weakTopics: [],
        streak: { current: 0, best: 0 },
      });
      expect(await seam.getProgress(userOf("tester"), "XX")).toMatchObject({
        started: false,
        subjects: [],
      });
    });

    it("refuses a User id that isn't one", async () => {
      await expect(seam.getProgress("not-a-user", "CE")).rejects.toThrow();
    });
  });

  describe("getTopicPercents", () => {
    it("gives each of the Exam's Topics' % for the Member, null with nothing to study", async () => {
      await testerStudies();

      const percents = await seam.getTopicPercents(userOf("tester"), "CE");

      expect(percents).toMatchObject({
        [SIMPLE_CURVES]: 50,
        [SPIRAL_CURVES]: 75,
        [SURVEYING]: 50,
        [ALGEBRA]: null,
        [HYDROSTATICS]: null,
      });
      // The same numbers as the dashboard's.
      const progress = await seam.getProgress(userOf("tester"), "CE");
      expect(percents).toEqual(
        Object.fromEntries(
          progress.subjects.flatMap(({ topics }) => topics.map(({ id, percent }) => [id, percent])),
        ),
      );
      // Another Member's are their own: the lapsed tester hasn't studied these.
      expect(await seam.getTopicPercents(userOf("lapsed"), "CE")).toMatchObject({
        [SIMPLE_CURVES]: 0,
        [SPIRAL_CURVES]: 0,
      });
    });
  });

  it("counts a Free Preview deck's progress like any other", async () => {
    const [card] = await writeCards(SIMPLE_CURVES, 1);
    await mark("lapsed", card, "got");

    const percents = await seam.getTopicPercents(userOf("lapsed"), "CE");

    // Simple Curves: its deck 100; its quiz, with no questions yet, isn't counted.
    expect(percents[SIMPLE_CURVES]).toBe(100);
  });
});
